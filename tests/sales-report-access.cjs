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

const monitor=load('lib/sales-monitor.ts'),monitorApi=load('app/api/sales/monitor/route.ts'),contract=load('lib/sales-monitor-contract.ts'),calendar=load('lib/persian-date.ts');
const config=contract.monitorDefaults;
const nowClock=new Date();
const watch=(mode,extra={},u=manager,status=200)=>post(monitorApi,'/api/sales/monitor',{id:crypto.randomUUID(),mode,confirmed:true,notes:'Verified actual follow-up',...extra},u,status);
async function view(u=manager,query='',status=200){const r=await context.run(u,()=>monitorApi.GET(request('/api/sales/monitor'+query)));assert.equal(r.status,status,await r.clone().text());return r.json();}
(async()=>{
 const modern=(id,roles)=>({...actor(id,[]),permissions:permissions.validatePermissions({roleAssignment:{roles}})});
 const sellerA=modern('seller-A',['home_sales','delivery','sales_viewer']),sellerB=modern('seller-B',['home_sales']),ceo=modern('ceo-reader',['ceo']),reader=modern('report-reader',['sales_report_viewer']),treasurer=modern('treasurer',['treasurer']);
 for(const u of [manager,finance,sellerA,sellerB,viewer,ceo,reader,treasurer])member(u);
 a='buyer-A';b='buyer-B';
 const buyer=(id,name,ownerId)=>seed(id,'sales_agent',{name,ownerId,financeId:'finance',managerId:'manager',kind:'representative',active:true,creditLimit:'10000',termDays:30,contactDays:30,reorderDays:60,province:'',city:''});
 buyer(a,'OWNED_BUYER_A','seller-A');buyer(b,'PRIVATE_BUYER_B','seller-B');buyer('buyer-C','VIEWER_OWNED_BUYER','viewer');
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('product','product',?,?)").run(JSON.stringify({name:'Device',status:'فعال'}),now);
 const invoice=(id,agentId,amount,reference)=>seed(id,'sales_invoice',{agentId,day:today,reference,amount,discount:'0',lines:[{productId:'product',name:'Device',quantity:1,unitPrice:amount,unitNet:amount,net:amount}],installments:[{id:'1',due:future,amount}]});
 invoice('invoice-A',a,'100','INVOICE_A');invoice('invoice-B',b,'900','PRIVATE_INVOICE_B');invoice('invoice-C','buyer-C','40','VIEWER_INVOICE');
 seed('order-B','sales_order',{agentId:b,code:'PRIVATE_ORDER_B',amount:'900',discount:'0',termDays:30,state:'submitted',milestone:'waiting_stock',promisedDay:future,lines:[{productId:'product',name:'Device',quantity:1,unitPrice:'900',unitNet:'900',net:'900'}],history:[]});
 seed('goal-A','sales_goal',{agentId:a,title:'OWN_GOAL',state:'active',start:past,end:future,basis:'net',amount:'200',productIds:[],version:1});seed('goal-B','sales_goal',{agentId:b,title:'PRIVATE_GOAL_B',state:'active',start:past,end:future,basis:'net',amount:'1000',productIds:[],version:1});
 seed('alert-A','sales_alert',{agentId:a,ownerId:'seller-A',state:'open',title:'OWN_ALERT',kind:'overdue',summary:'Owned follow-up',history:[],due:future});
 // An alert still addressed to the old expert must not leak a newly transferred buyer.
 seed('alert-B','sales_alert',{agentId:b,ownerId:'seller-A',state:'open',title:'PRIVATE_ALERT_B',kind:'overdue',summary:'PRIVATE_ALERT_EVIDENCE_B',history:[],due:future});
 seed('file-B','sales_file',{agentId:b,title:'PRIVATE_FILE_B',filename:'private.pdf',key:'private-file-B'});
 seed('bank-account','treasury_account',{title:'Payment routing',kind:'bank',state:'active',currency:'IRR',number:'BANK_ROUTING_ONLY_FOR_PAYMENTS'});
 seed('report-snapshot','sales_report',{kind:'daily',start:past,end:today,asOf:now,summary:['MANAGEMENT_REPORT_ARCHIVE'],byAgent:[{id:a},{id:b}],history:[]});
 const read=async(api,path,u,status=200)=>{const r=await context.run(u,()=>api.GET(request(path)));assert.equal(r.status,status,await r.clone().text());if(status===200)assert.match(r.headers.get('cache-control')||'',/no-store/);return r.json();};
 const networkApi=load('app/api/sales/network/route.ts'),access=load('lib/sales-access.ts'),navigation=load('lib/navigation-access.ts'),assistant=load('lib/assistant-policy.ts');
 const writes=()=>sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;
 const businessSnapshot=()=>JSON.stringify(sql.prepare('SELECT * FROM flow_entities ORDER BY id').all());
 const beforeWrites=writes(),beforeBusiness=businessSnapshot(),archiveBefore=JSON.stringify(entity('report-snapshot'));
 for(const u of [sellerA]){
  const personal=await read(sales,'/api/sales',u);assert.deepEqual(personal.agents.map(a=>a.id),['buyer-A']);assert.equal(personal.reports.netSales,'100');assert.ok(!JSON.stringify(personal).includes('PRIVATE_'),'Main report excludes other buyer identity, orders, invoices and files');assert.equal(personal.roles.reportRead,false);
  const net=await read(networkApi,'/api/sales/network',u);assert.deepEqual(net.agents.map(a=>a.id),['buyer-A']);assert.ok(!JSON.stringify(net).includes('PRIVATE_'));
  const watchData=await read(monitorApi,'/api/sales/monitor',u);assert.deepEqual(watchData.alerts.map(a=>a.id),['alert-A']);assert.deepEqual(watchData.goals.map(g=>g.id),['goal-A']);assert.deepEqual(watchData.agents.map(a=>a.id),['buyer-A']);assert.equal(watchData.reports.length,0);assert.equal(watchData.policy,null);assert.ok(!JSON.stringify(watchData).includes('PRIVATE_'),'Monitor excludes stale ownership, unrelated goals and evidence');
  await read(sales,'/api/sales?agent='+b,u,404);await read(files,'/api/sales/files?id=file-B',u,404);await read(monitorApi,'/api/sales/monitor?report=report-snapshot',u,403);await read(monitorApi,'/api/sales/monitor?preview=daily',u,403);
  const mcp=await catalog.executeTool('get_sales',{},base,{user:u,scope:'read',tokenId:null});assert.ok(!JSON.stringify(mcp).includes('PRIVATE_'));const mcpWatch=await catalog.executeTool('get_sales_monitor',{},base,{user:u,scope:'read',tokenId:null});assert.ok(!JSON.stringify(mcpWatch).includes('PRIVATE_'));await assert.rejects(()=>catalog.executeTool('get_sales_monitor',{report:'report-snapshot'},base,{user:u,scope:'read',tokenId:null}),e=>e.status===403);
  await watch('followup',{alertId:'alert-B',revision:1,nextAction:'Must be denied'},u,404);
 }
 const ownViewer=await read(sales,'/api/sales',viewer);assert.deepEqual(ownViewer.agents.map(a=>a.id),['buyer-C']);assert.ok(!JSON.stringify(ownViewer).includes('PRIVATE_'));assert.equal((await read(monitorApi,'/api/sales/monitor',viewer)).canFollowup,false);
 for(const u of [ceo,reader]){
  assert.equal(access.salesReportRead(u),true);assert.equal(access.salesManager(u),false);assert.equal(access.salesStaff(u),false);assert.equal(access.salesFinance(u),false);assert.equal(navigation.canOpenSection(u,'sales'),true);assert.equal(navigation.canOpenSection(u,'sales-bank'),false);assert.equal(navigation.canOpenSection(u,'users'),false);
  for(const tool of ['sales_apply','sales_network_apply','sales_monitor_apply','sales_lead_apply','sales_bank_apply','assign_sales_buyer','get_sales_template_workspace','preview_sales_order'])assert.equal(assistant.assistantToolAvailable(u,tool),false,'No operational assistant tool '+tool);
  const all=await read(sales,'/api/sales',u);assert.equal(all.agents.length,3);assert.equal(all.reports.netSales,'1040');assert.ok(all.agents.every(a=>!a.canOperate));assert.equal(all.receivingAccounts.length,0,'A reporting role does not expose bank routing details');
  const monitor=await read(monitorApi,'/api/sales/monitor',u);assert.equal(monitor.manager,false);assert.equal(monitor.reportRead,true);assert.equal(monitor.canFollowup,false);assert.equal(monitor.finance,false);assert.equal(monitor.policy,null);assert.equal(monitor.alerts.length,2);assert.equal(monitor.reports.length,1);
  assert.ok((await read(monitorApi,'/api/sales/monitor?report=report-snapshot',u)).report.data.summary.includes('MANAGEMENT_REPORT_ARCHIVE'));assert.ok((await read(monitorApi,'/api/sales/monitor?preview=daily',u)).report.data.byAgent.some(a=>a.id===b));
  assert.ok((await catalog.executeTool('get_sales_monitor',{report:'report-snapshot'},base,{user:u,scope:'read',tokenId:null})).report.data.summary.includes('MANAGEMENT_REPORT_ARCHIVE'));
  for(const mode of ['configure','goal','retire_goal','scan','assign','review_goal','report_read','followup','acknowledge','recover_check'])await watch(mode,{alertId:'alert-A',revision:1,reportId:'report-snapshot'},u,403);
  for(const mode of ['agent','price','target','order','payment','terms','opening','opening_review'])await op(mode,{agentId:a},u,403);
  await assert.rejects(()=>catalog.executeTool('sales_monitor_apply',{id:crypto.randomUUID(),mode:'scan',confirmed:true,data:{}},base,{user:u,scope:'read_write',tokenId:null}),e=>e.status===403);
 }
 assert.equal(writes(),beforeWrites,'Read/preview and denied writes create no business operation');assert.equal(businessSnapshot(),beforeBusiness,'Read-only reports and denied writes preserve every business record; denial audit is allowed');assert.equal(sql.prepare('SELECT COUNT(*) n FROM duty_runs').get().n,0,'Read-only reporting does not create tasks');assert.equal(JSON.stringify(entity('report-snapshot')),archiveBefore,'Archived reports remain immutable');
 for(const u of [manager,admin]){const d=await read(monitorApi,'/api/sales/monitor',u);assert.equal(d.manager,true);assert.equal(d.reportRead,true);assert.equal(d.canFollowup,true);assert.equal(d.agents.length,3);assert.ok((await read(monitorApi,'/api/sales/monitor?report=report-snapshot',u)).report);}
 await read(sales,'/api/sales',treasurer,403);await read(monitorApi,'/api/sales/monitor',treasurer,403);
 const transferred=entity(a);sql.prepare('UPDATE flow_entities SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify({...transferred.data,ownerId:'seller-B'}),a);assert.equal((await read(sales,'/api/sales',sellerA)).agents.length,0);assert.equal((await read(monitorApi,'/api/sales/monitor',sellerA)).alerts.length,0,'Transferred buyer alerts disappear even when their owner assignment is stale');
 // A cached CEO session/MCP actor cannot retain removed management-report rights.
 sql.prepare("UPDATE app_members SET permissions=? WHERE id='ceo-reader'").run(JSON.stringify(viewer.permissions));assert.equal((await read(sales,'/api/sales',ceo)).roles.reportRead,false);assert.equal((await read(monitorApi,'/api/sales/monitor',ceo)).reports.length,0);await read(monitorApi,'/api/sales/monitor?report=report-snapshot',ceo,403);await assert.rejects(()=>catalog.executeTool('get_sales_monitor',{report:'report-snapshot'},base,{user:ceo,scope:'read',tokenId:null}),e=>e.status===403);
 sql.prepare("UPDATE app_members SET status='disabled' WHERE id='report-reader'").run();await read(sales,'/api/sales',reader,403);await read(monitorApi,'/api/sales/monitor',reader,403);
 console.log('PASS sales report security: combined expert/viewer ownership, other-buyer/evidence isolation, transferred alerts, CEO/management read-only reports and previews, no operational grants, HTTP/MCP parity, live revocation, immutable archives and no write side effects.');
})().catch(e=>{console.error(e);process.exit(1)});
