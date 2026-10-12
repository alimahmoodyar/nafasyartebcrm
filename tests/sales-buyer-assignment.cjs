const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const context=load('lib/mcp/context.ts').mcpActor,permissions=load('lib/permissions.ts'),sales=load('app/api/sales/route.ts'),quoteApi=load('app/api/sales/quote/route.ts'),files=load('app/api/sales/files/route.ts'),accounts=load('app/api/sales/accounts/route.ts'),fulfillment=load('app/api/fulfillment/route.ts'),transport=load('app/api/transport/route.ts'),catalog=load('lib/mcp/tools.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next;};
const base='https://test.local',today=load('lib/duties.ts').dayAt(),past=load('lib/duties.ts').addDay(today,-20),future=load('lib/duties.ts').addDay(today,20),now=new Date().toISOString();
const request=(path,body,origin=base)=>new Request(base+path,{method:body?'POST':'GET',headers:{origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const actor=(id,roles,extra={})=>({userId:'local:'+id,email:id+'@example.com',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],salesRoles:roles,...extra}});
const admin={...actor('admin',[]),isAdmin:true,permissions:permissions.allPermissions},manager=actor('manager',['manager']),staff=actor('staff',['staff']),finance=actor('finance',['finance']),viewer=actor('viewer',['viewer']),warehouse=actor('warehouse',[],{flowRoles:['inventory'],warehouses:['quarantine','finished']}),driver=actor('driver',[],{transportRoles:['driver']}),transportManager=actor('transport',[],{transportRoles:['manager']});
const member=u=>sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',NULL,?,1,?,?)").run(u.userId.slice(6),u.email,u.name,JSON.stringify(u.permissions),now,now);
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
const entity=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null;};
const all=type=>sql.prepare('SELECT * FROM flow_entities WHERE type=?').all(type).map(r=>({...r,data:JSON.parse(r.data)}));
async function post(api,path,body,u=admin,status=200){const r=await context.run(u,()=>api.POST(request(path,body)));const d=await r.json();assert.equal(r.status,status,body.mode+': '+JSON.stringify(d));return {...d,body};}
let a,b,rep,other;
let representativeSequence=1234500000;
const op=(mode,extra={},u=finance,status=200)=>post(sales,'/api/sales',{id:crypto.randomUUID(),mode,...(mode==='agent'&&!extra.agentId?{nationalId:String(++representativeSequence),mobile:'09123456789'}:{}),agentId:a,confirmed:true,notes:'Verified source',...extra},u,status);
const get=async(u=rep,agent='',status=200)=>{const r=await context.run(u,()=>sales.GET(request('/api/sales'+(agent?'?agent='+agent:''))));assert.equal(r.status,status);return r.json();};
const balance=async()=>((await get()).accounts[0]);
const quote=(qty=3,u=rep)=>post(quoteApi,'/api/sales/quote',{agentId:a,items:[{productId:'product',quantity:qty}]},u);
const version=id=>entity(id).revision;
async function upload(u=rep,extra={},status=201){const meta={id:crypto.randomUUID(),agentId:a,confirmed:true,title:'Evidence',...extra},form=new FormData();form.set('metadata',JSON.stringify(meta));form.set('file',new File(['%PDF-test'],'receipt.pdf'));const r=await context.run(u,()=>files.POST(new Request(base+'/api/sales/files',{method:'POST',headers:{origin:base},body:form})));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return {...d,meta};}
const network=load('app/api/sales/network/route.ts'),contract=load('lib/sales-network-contract.ts');
const nw=(mode,extra={},u=manager,status=200)=>post(network,'/api/sales/network',{id:crypto.randomUUID(),mode,...(mode==='template'?{effectiveFrom:today,productPrices:[{productId:'product',unitPrice:'1000'}]}:{}),...(mode==='agent'&&!extra.agentId?{nationalId:String(++representativeSequence),mobile:'09123456789'}:{}),confirmed:true,agentId:a,notes:'Actual recorded decision',...extra},u,status);
(async()=>{
 const plain=v=>JSON.parse(JSON.stringify(v)),modern=(id,roles)=>({...actor(id,[]),permissions:permissions.validatePermissions({roleAssignment:{roles}})});
 const second=modern('second',['home_sales','delivery','sales_viewer']),treasurer=modern('treasurer',['treasurer']),inactive=actor('inactive',['staff']),external=actor('external',['staff'],{salesAgentId:'foreign'});
 for(const u of [manager,staff,finance,viewer,second,treasurer,inactive,external])member(u);
 sql.prepare("UPDATE app_members SET status='disabled' WHERE id='inactive'").run();
 a='buyer';const buyer={name:'Existing buyer',active:true,kind:'representative',ownerId:'staff',financeId:'finance',managerId:'manager',contactDays:30,reorderDays:60,creditLimit:'100000',termDays:30,nationalId:'PRIVATE_NATIONAL',mobile:'PRIVATE_MOBILE',address:'PRIVATE_ADDRESS',contractRef:'PRIVATE_CONTRACT'};
 seed(a,'sales_agent',buyer);seed('inactive-buyer','sales_agent',{...buyer,active:false});seed('referrer','sales_agent',{...buyer,kind:'referrer'});
 seed('snapshot','sales_invoice',{agentId:a,amount:'900',day:today,reference:'INV-1',installments:[{id:'one',due:future,amount:'900'}],salesTerms:{cashBps:5000,days:30},lines:[{productId:'product',quantity:1,unitPrice:'900'}]});
 const snapshot=plain(entity('snapshot')),counts=()=>({members:sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,buyers:all('sales_agent').length}),initialCounts=counts();
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('product','product',?,?)").run(JSON.stringify({name:'Device',model:'N1',code:'P1',status:'فعال'}),now);
 seed('price','sales_price',{agentId:'',productId:'product',unitPrice:'1000',active:true,reference:'PRICE'});
 const assignmentGet=async(u,status=200)=>{const r=await context.run(u,()=>network.GET(request('/api/sales/network?assignments=1')));assert.equal(r.status,status,await r.clone().text());assert.match(r.headers.get('cache-control')||'',/no-store/);return r.json();};
 const assign=(u,extra={},status=200)=>post(network,'/api/sales/network',{id:crypto.randomUUID(),mode:'assign',confirmed:true,agentId:a,revision:version(a),ownerId:'second',...extra},u,status);
 let list=await assignmentGet(manager);assert.deepEqual(list.buyers.map(v=>v.id),[a]);assert.equal(list.buyers[0].ownerName,'staff');
 for(const id of ['staff','second','manager'])assert.ok(list.members.some(m=>m.id===id));
 for(const id of ['finance','viewer','treasurer','inactive','external'])assert.ok(!list.members.some(m=>m.id===id),'Cannot assign to '+id);
 assert.ok(!/PRIVATE|creditLimit|installments|password|permissions/.test(JSON.stringify(list)),'Assignment directory exposes only minimal choices');
 const principal=u=>({user:u,scope:'write',tokenId:null});
 assert.deepEqual(plain(await catalog.executeTool('get_sales_buyer_assignments',{},base,principal(manager))),list,'MCP reads same assignment directory');
 for(const u of [staff,second,finance,viewer,treasurer,external]){
  await assignmentGet(u,403);await assign(u,{},403);
  await assert.rejects(()=>catalog.executeTool('get_sales_buyer_assignments',{},base,principal(u)),e=>e.status===403);
  await assert.rejects(()=>catalog.executeTool('assign_sales_buyer',{id:crypto.randomUUID(),confirmed:true,agentId:a,revision:1,ownerId:'second'},base,principal(u)),e=>e.status===403);
 }
 await assign(manager,{confirmed:false},400);await assign(manager,{id:'bad'},400);await assign(manager,{revision:0},409);
 for(const ownerId of ['finance','viewer','treasurer','inactive','external','unknown',''])await assign(manager,{ownerId},400);
 await assign(manager,{agentId:'inactive-buyer',revision:1},400);await assign(manager,{agentId:'referrer',revision:1},400);
 const wrongOrigin=await context.run(manager,()=>network.POST(request('/api/sales/network',{id:crypto.randomUUID(),mode:'assign',confirmed:true,agentId:a,revision:1,ownerId:'second'},'https://other.local')));assert.equal(wrongOrigin.status,403);
 const args={id:crypto.randomUUID(),confirmed:true,agentId:a,revision:version(a),ownerId:'second'};
 await assert.rejects(()=>catalog.executeTool('assign_sales_buyer',args,base,{...principal(manager),scope:'read'}));
 await assert.rejects(()=>catalog.executeTool('assign_sales_buyer',{...args,confirmed:false},base,principal(manager)));
 await catalog.executeTool('assign_sales_buyer',args,base,principal(manager));
 assert.equal(entity(a).data.ownerId,'second');assert.equal(version(a),2);
 list=await assignmentGet(manager);assert.equal(list.buyers.find(b=>b.id===a).ownerId,'second');assert.equal(list.buyers.find(b=>b.id===a).revision,2,'Confirmed directory reflects the stored assignment');
 assert.equal((await catalog.executeTool('assign_sales_buyer',args,base,principal(manager))).repeated,true);assert.equal(version(a),2);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM access_audit WHERE action='sales_network_assign'").get().n,1,'One audit record for repeated command');
 await assert.rejects(()=>catalog.executeTool('assign_sales_buyer',{...args,ownerId:'staff'},base,principal(manager)),e=>e.status===409);
 for(const [key,value]of Object.entries(buyer))if(key!=='ownerId')assert.deepEqual(entity(a).data[key],value,'Preserve buyer '+key);
 assert.deepEqual(counts(),initialCounts,'No buyer or login is created');assert.deepEqual(plain(entity('snapshot')),snapshot,'Existing invoice snapshot untouched');
 assert.equal(entity(a).data.history.at(-1).actor,manager.userId);
 await get(staff,a,404);await quote(1,staff).then(()=>assert.fail('Old owner cannot quote'),e=>assert.match(e.message,/404|دسترسی/));
 const after=await get(second);assert.equal(after.agents.find(v=>v.id===a).canOperate,true);const ownedQuote=await quote(1,second);const newSale=await op('order',{agentId:a,items:[{productId:'product',quantity:1}],quoteHash:ownedQuote.quoteHash,requestSource:{channel:'phone',contactName:'Actual buyer',day:today,reference:'TEST-CALL'}},second);assert.equal(entity(newSale.body.id).data.agentId,a,'New owner registers an actual sale');
 const readonly=await get(viewer);assert.equal(readonly.agents.find(v=>v.id===a).canOperate,false);
 await assign(manager,{revision:1},409);
 // An assignee disabled after validation must roll back the ownership change.
 const oldBatch=db.batch;db.batch=async stmts=>{db.batch=oldBatch;sql.prepare("UPDATE app_members SET status='disabled' WHERE id='staff'").run();return oldBatch(stmts);};
 const raceId=crypto.randomUUID();await assign(manager,{id:raceId,ownerId:'staff'},409);assert.equal(entity(a).data.ownerId,'second');assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(raceId),undefined);
 sql.prepare("UPDATE app_members SET status='active' WHERE id='staff'").run();await assign(manager,{ownerId:'staff'});assert.equal(entity(a).data.ownerId,'staff');
 list=await assignmentGet(manager);assert.equal(list.buyers.filter(b=>b.ownerId==='second').length,0);assert.equal(list.buyers.filter(b=>b.ownerId==='staff').length,1,'Directory moves the buyer between owners without duplicate assignment rows');
 assert.equal((await get(second)).agents.find(v=>v.id===a).canOperate,false,'Report viewer remains read-only after ownership removal');
 await get(staff,a);await quote(1,staff);assert.deepEqual(plain(entity('snapshot')),snapshot);
 // Cached session permissions cannot override a manager's revoked stored role.
 sql.prepare("UPDATE app_members SET permissions=? WHERE id='manager'").run(JSON.stringify(viewer.permissions));await assignmentGet(manager,403);await assign(manager,{},403);
 const workspace=load('lib/assistant-workspace.ts'),policy=load('lib/assistant-policy.ts');
 for(const message of ['برای ثبت فروش نماینده باید تخصیص بدهم کجا برم؟','این خریدار را به کارشناس فروش تخصیص بده','مسئول فروش نماینده را تغییر بده','نماینده موجود را واگذار کن']){
  const draft=workspace.requestedOperationForm(message,{tool:'sales_apply',args:{mode:'agent',agentId:''}},catalog.tools);assert.equal(draft.tool,'assign_sales_buyer');assert.equal(draft.section,'sales');assert.equal(draft.schema.properties.revision.uiHidden,true);
  assert.equal(workspace.requestedOperationForm(message,null,catalog.tools.filter(t=>policy.assistantToolAvailable(staff,t.name))),undefined);
 }
 assert.equal(workspace.requestedOperationForm('نماینده جدید ایجاد کن',null,catalog.tools).args.mode,'agent');
 const choices=workspace.operationChoices(catalog.tools.filter(t=>t.write),policy.actionSection,()=>true,policy.actionTitles);
 assert.equal(choices.filter(v=>v.tool==='assign_sales_buyer').length,1);assert.ok(!choices.some(v=>v.tool==='sales_network_apply'&&v.args.mode==='assign'));
 console.log('PASS buyer assignment: minimal manager-only directory, HTTP/MCP parity, confirmation, scoped ownership transfer, revocation, stale versions, live roles, concurrency rollback, idempotency/audit and preserved buyer/invoice/account data.');
})().catch(e=>{console.error(e);process.exitCode=1});
