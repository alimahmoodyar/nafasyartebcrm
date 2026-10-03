const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const production=load('app/api/production/route.ts'),recordsApi=load('app/api/records/route.ts');
async function create(kind,data){const r=await recordsApi.POST(request('/api/records','POST',{kind,data}));const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));return d.record;}
async function operate(b,status=200){const r=await production.POST(request('/api/production','POST',{id:crypto.randomUUID(),...b}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}

const flow=load('app/api/flow/route.ts'),templateApi=load('app/api/quality/templates/route.ts'),qualityApi=load('app/api/quality/reports/route.ts');
async function op(mode,b={},status=200){const r=await flow.POST(request('/api/flow','POST',{id:crypto.randomUUID(),mode,...b}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const entities=type=>sql.prepare('SELECT * FROM flow_entities WHERE type=? ORDER BY created,id').all(type).map(x=>({...x,data:JSON.parse(x.data)}));
const stock=(id,wh)=>sql.prepare('SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse=?').get(id,wh)?.quantity||0;
// Serialize test transactions as D1 does; callers may still read the same stale version.
let batchTail=Promise.resolve();const rawBatch=db.batch.bind(db);db.batch=stmts=>{const next=batchTail.then(()=>rawBatch(stmts));batchTail=next.catch(()=>{});return next};
const sourcing=load('app/api/sourcing/route.ts'),context=load('lib/mcp/context.ts').mcpActor;
const current=id=>entities('sourcing_plan').find(p=>p.id===id);
const actor=role=>({userId:role+'User',email:role+'@test.local',name:role,isAdmin:false,permissions:{read:[],write:[],eventStages:[],supplyRoles:[role],flowRoles:role==='inventory'?['inventory']:[],warehouses:role==='inventory'?['quarantine','raw']:[]}});
async function source(mode,b={},status=200,user){const body={id:crypto.randomUUID(),mode,...(b.planId?{revision:current(b.planId).revision}:{}),...b};const go=()=>sourcing.POST(request('/api/sourcing','POST',body));const r=user?await context.run(user,go):await go(),d=await r.json();assert.equal(r.status,status,mode+': '+JSON.stringify(d));return {...d,operationId:body.id};}
async function detail(id,user){const go=()=>sourcing.GET(request('/api/sourcing?id='+id));const r=user?await context.run(user,go):await go();assert.equal(r.status,200);return r.json();}
(async()=>{
 identity=owner;await auth.session();
 const repl=load('lib/replenishment.ts'),api=load('app/api/replenishment/route.ts'),cal=load('lib/workflow-calendar.ts'),sync=load('lib/sourcing.ts').syncSourcingFollowups;
 const today=load('lib/duties.ts').dayAt(),later=new Date(Date.now()+2*86400000).toISOString().slice(0,10),future=new Date(Date.now()+20*86400000).toISOString().slice(0,10),now=new Date().toISOString();
 const c={...cal.defaultCalendar,holidays:['2026-10-03']};
 assert.equal(cal.addWorkingMinutes(new Date('2026-09-30T13:00:00Z'),120,c),'2026-10-04T06:00:00.000Z');
 assert.equal(cal.workingMinutes(new Date('2026-09-30T13:00:00Z'),new Date('2026-10-04T06:00:00Z'),c),120);
 assert.equal(cal.workingNow(new Date('2026-10-02T08:00:00Z'),c),false);
 assert.equal(cal.validCalendar({...c,holidays:['2026-02-30']}),false);
 assert.equal((await repl.scanReplenishment()).enabled,false);
 for(const role of Object.keys(repl.replenishmentRoles)){const a=actor(role);if(role==='qc')a.permissions.flowRoles=['qc'];sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',?,?,1,?,?)").run(a.userId,a.email,a.name,a.userId,JSON.stringify(a.permissions),now,now);}
 async function config(policy,revision,status=200,user){const fn=()=>api.POST(request('/api/replenishment','POST',{mode:'policy',confirmed:true,revision,policy}));const r=user?await context.run(user,fn):await fn();assert.equal(r.status,status,await r.text());}
 const policy={...repl.defaultPolicy,enabled:true,owners:Object.fromEntries(Object.keys(repl.replenishmentRoles).map(r=>[r,r+'User'])),supervisor:'ceoUser'};
 await config(policy,0,403,actor('inventory'));await config({...policy,owners:{}},0,400);await config(policy,0);await config(policy,0,409);
 await op('material',{code:'91',name:'Auto part',unit:'عدد',specs:'V1',defaultLocation:'A-1-1-1',reorderPoint:'4',targetStock:'6',fields:[{key:'purity',label:'Purity',type:'number',min:'90',max:'96',unit:'%',required:true}],qcOwner:'qcUser',warehouseOwner:'inventoryUser',procurementOwner:'',revision:0});
 let material=entities('material')[0];await source('routes',{materialId:material.id,revision:material.revision,routes:['domestic','foreign']});material=entities('material')[0];
 assert.equal((await repl.shortageSnapshot(material)).proposed,6000);
 await Promise.all([repl.scanReplenishment(),repl.scanReplenishment()]);await sync();
 assert.equal(entities('sourcing_plan').length,1);const pid=entities('sourcing_plan')[0].id;
 let tasks=sql.prepare("SELECT * FROM duty_runs WHERE state='open'").all();assert.equal(tasks.length,1);assert.equal(tasks[0].assignee,'inventoryUser');
 const tasksApi=load('app/api/tasks/route.ts');const manual=await tasksApi.POST(request('/api/tasks','POST',{id:crypto.randomUUID(),mode:'submit',taskId:tasks[0].id,revision:tasks[0].revision,note:'pretend complete'}));assert.equal(manual.status,400);
 await assert.rejects(()=>load('lib/duties.ts').taskAccess(tasks[0].id,{...actor('inventory'),permissions:{supplyRoles:[],flowRoles:[],warehouses:[]}}),/دسترسی/);
 await source('stock_confirm',{planId:pid,quantity:'6',needBy:future,notes:'confirmed'},403,actor('sales'));
 await source('stock_reject',{planId:pid,notes:'Count not reliable yet'},200,actor('inventory'));await repl.scanReplenishment();assert.equal(current(pid).data.state,'stock_rejected');
 // Changed reorder target is a fresh inventory snapshot, so rejected need is revisited.
 sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.targetStock',7000),revision=revision+1 WHERE id=?").run(material.id);
 await repl.scanReplenishment();assert.equal(current(pid).data.state,'stock_check');
 await source('stock_confirm',{planId:pid,quantity:'6',needBy:future,notes:'physical count checked'},200,actor('inventory'));assert.equal(current(pid).data.lines[0].required,6000);
 await source('finish_replenishment',{planId:pid,notes:'too early'},400,actor('inventory'));
 const quote={planId:pid,partCode:'91',supplier:'Domestic',unitPrice:'10',currency:'IRR',fxRate:'1',fxDate:today,fxSource:'rate',extrasRial:'0',costNotes:'included',eta:later,validUntil:future,paymentTerms:'cash',specs:'V1',reference:'Q1',unavailable:false};
 const qd=(await source('quote',{...quote,route:'domestic'},200,actor('domestic'))).operationId;
 await source('award',{planId:pid,partCode:'91',quoteId:qd,notes:'only one quote'},400,actor('ceo'));
 await source('quote',{...quote,route:'foreign',unavailable:true,reason:'not available'},200,actor('foreign'));
 await source('technical',{planId:pid,quoteId:qd,quoteRevision:entities('sourcing_quote')[0].revision,result:'pass',notes:'matches spec'},200,actor('engineering'));
 const order=(await source('award',{planId:pid,partCode:'91',quoteId:qd,notes:'only available approved route'},200,actor('ceo'))).operationId;
 await source('finance',{planId:pid,status:'approved',budgetRial:'100',availableOn:today,notes:'budget'},200,actor('finance'));
 await source('issue_order',{planId:pid,orderId:order,reference:'F1'},200,actor('finance'));
 await repl.scanReplenishment();assert.equal(entities('sourcing_plan').length,1);
 await source('receive',{planId:pid,orderId:order,day:today,quantity:'6',notes:'arrived'},200,actor('inventory'));
 let arrival=entities('receipt')[0];await sync();assert.ok(sql.prepare("SELECT 1 FROM duty_runs WHERE assignee='qcUser' AND state='open'").get());
 await source('finish_replenishment',{planId:pid,notes:'quarantine is not stock'},400,actor('inventory'));
 await op('incoming_qc',{receiptId:arrival.id,accepted:'5',rejected:'1',values:{purity:'93'},notes:'one failure'});await sync();assert.ok(sql.prepare("SELECT 1 FROM duty_runs WHERE assignee='inventoryUser' AND template_id LIKE '%shelve:%' AND state='open'").get());
 await source('finish_replenishment',{planId:pid,notes:'not shelved'},400,actor('inventory'));await op('shelve',{receiptId:arrival.id,location:'A-1-1-1'});
 await source('close_order',{planId:pid,orderId:order,notes:'partial'},400,actor('inventory'));
 await source('receive',{planId:pid,orderId:order,day:today,quantity:'1',notes:'replacement'},200,actor('inventory'));
 arrival=entities('receipt').find(r=>r.data.state==='pending_qc');await op('incoming_qc',{receiptId:arrival.id,accepted:'1',rejected:'0',values:{purity:'93'},notes:'pass'});await op('shelve',{receiptId:arrival.id,location:'A-1-1-2'});
 await source('close_order',{planId:pid,orderId:order,notes:'complete'},200,actor('inventory'));
 const before=sql.prepare("SELECT SUM(quantity) n FROM inventory_balances WHERE warehouse='raw'").get().n;
 await source('finish_replenishment',{planId:pid,notes:'all received and accepted'},200,actor('inventory'));
 assert.equal(current(pid).data.state,'completed');assert.equal(sql.prepare('SELECT COUNT(*) n FROM sourcing_holds WHERE plan_id=?').get(pid).n,0);assert.equal(sql.prepare("SELECT SUM(quantity) n FROM inventory_balances WHERE warehouse='raw'").get().n,before);
 await repl.scanReplenishment();assert.equal(entities('sourcing_plan').length,1);
 // Work-hour reminders deduplicate and never send on weekends.
 const task=tasks[0],due='2026-10-03T05:30:00.000Z';task.due=due;task.data=JSON.stringify({...JSON.parse(task.data),calendar:cal.defaultCalendar});
 assert.equal(repl.replenishmentNotices(task,new Date('2026-10-02T08:00:00Z')).length,0);
 const at=new Date('2026-10-03T08:00:00Z');await db.batch(repl.replenishmentNotices(task,at));const count=sql.prepare('SELECT COUNT(*) n FROM duty_notices').get().n;await db.batch(repl.replenishmentNotices(task,at));assert.equal(sql.prepare('SELECT COUNT(*) n FROM duty_notices').get().n,count);
 const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){const where=reset.resetWhere('flow_entities',scope);assert.ok(sql.prepare('SELECT 1 FROM flow_entities WHERE id=? AND '+where).get('replenishment-policy'));}
 // Existing generic freeze trigger also protects new policy entities.
 console.log('Replenishment passed: work calendar, policy authorization/CAS, concurrent deduplication, rejection/reopen, single accountable owner, dual RFQ, partial QC and replacement, completion releases holds without double stock, quiet hours and reminder deduplication, reset scope.');
})().catch(e=>{console.error(e);process.exit(1)});
