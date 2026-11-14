const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
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
const actor=role=>({userId:role+'User',email:role+'@test.local',name:role,isAdmin:false,permissions:{read:[],write:[],eventStages:[],supplyRoles:[role],flowRoles:role==='inventory'?['inventory']:[],warehouses:role==='inventory'?['quarantine','raw']:[],warehouseResponsibilities:role==='inventory'?[{warehouseId:'warehouse:receipt-fixture',role:'inventory'}]:[]}});
async function source(mode,b={},status=200,user){const body={id:crypto.randomUUID(),mode,...(b.planId?{revision:current(b.planId).revision}:{}),...b};const go=()=>sourcing.POST(request('/api/sourcing','POST',body));const r=user?await context.run(user,go):await go(),d=await r.json();assert.equal(r.status,status,mode+': '+JSON.stringify(d));return {...d,operationId:body.id};}
async function detail(id,user){const go=()=>sourcing.GET(request('/api/sourcing?id='+id));const r=user?await context.run(user,go):await go();assert.equal(r.status,200);return r.json();}
async function reviews(workspace,user,status=200){const go=()=>sourcing.GET(request('/api/sourcing?reviewInbox='+workspace));const r=user?await context.run(user,go):await go();assert.equal(r.status,status);return r.json();}


(async()=>{
 identity=owner;await auth.session();require('./helpers/receiving-warehouse.cjs')(sql);const now=new Date().toISOString(),future=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
 const put=(type,data,id=crypto.randomUUID())=>{sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);return id};
 for(const role of ['inventory','engineering','domestic','commerce_manager','ceo','finance']){const a=actor(role);sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',?,?,1,?,?)").run(a.userId,a.email,a.name,a.userId,JSON.stringify(a.permissions),now,now);}
 await op('material',{code:'41',name:'Procurement material',unit:'عدد',specs:'V1',fields:[{key:'visual',label:'Visual',type:'text',unit:'',min:'',max:'',required:true}],revision:0});let material=entities('material')[0];await source('routes',{materialId:material.id,revision:material.revision,routes:['domestic']});material=entities('material')[0];
 async function fixture(count=3){
  const pid=(await source('direct_request',{confirmed:true,reference:'TEST',materialId:material.id,materialRevision:material.revision,quantity:'10',needPriority:'planned',needBy:future,notes:'procurement test'})).planId;
  const line=current(pid).data.lines[0],qs=[];
  for(let i=0;i<count;i++){const supplierId=put('supplier',{name:'Supplier '+i,route:'domestic',active:true}),supplierLinkId=put('supplier_material',{supplierId,materialId:material.id,status:'approved',specs:'V1',unit:'عدد',supplierRevision:1,reviewDue:future,requiredDocumentIds:[]});qs.push(put('sourcing_quote',{planId:pid,partCode:'41',round:line.round,route:'domestic',supplierId,supplierLinkId,supplier:'Supplier '+i,quantity:10000,unit:'عدد',specs:'V1',technical:'pass',unitPrice:String(10+i),totalRial:String(100+10*i),currency:'IRR',fxRate:'1',extrasRial:'0',validUntil:future,eta:future,paymentTerms:'cash'}));}
  return {pid,qs};
 }
 const order=id=>entities('purchase_order').find(o=>o.id===id),quote=id=>entities('sourcing_quote').find(q=>q.id===id);
 const {pid,qs}=await fixture();const award={planId:pid,partCode:'41',quoteId:qs[0],notes:'Selected by supply manager with actual evidence'};
 await source('award',award,403,actor('domestic'));await source('award',award,403,actor('ceo'));
 const oid=(await source('award',award,200,actor('commerce_manager'))).operationId;
 assert.equal(order(oid).data.state,'awaiting_funding');assert.ok((await reviews('finance',actor('finance'))).items.some(x=>x.quoteId===qs[0]));
 await source('issue_order',{planId:pid,orderId:oid,reference:'Budget'},409,actor('finance'));
 await source('financial_review',{planId:pid,quoteId:qs[0],quoteRevision:quote(qs[0]).revision,result:'pass',notes:'Price checked'},200,actor('finance'));
 await source('finance',{planId:pid,status:'approved',budgetRial:'10000',availableOn:now.slice(0,10),notes:'Budget'},200,actor('finance'));
 await source('issue_order',{planId:pid,orderId:oid,reference:'Budget reference'},200,actor('finance'));assert.equal(order(oid).data.state,'issued');
 const urgent=await fixture(1);await source('award',{...award,planId:urgent.pid,quoteId:urgent.qs[0]},409,actor('commerce_manager'));
 const ex=(await source('request_exception',{planId:urgent.pid,partCode:'41',kind:'urgent',title:'Urgent equipment stoppage',evidence:'Stoppage report 123',quoteId:urgent.qs[0],quoteRevision:1,notes:'Cannot wait for normal review',confirmed:true},200,actor('domestic'))).operationId;
 assert.ok(sql.prepare("SELECT 1 FROM duty_runs WHERE assignee='ceoUser' AND state='open' AND json_extract(data,'$.sourcePlanId')=?").get(urgent.pid));
 await source('decide_exception',{planId:urgent.pid,exceptionId:ex,decision:'approve',notes:'Authorized this exact quote',confirmed:true},403,actor('finance'));
 await source('decide_exception',{planId:urgent.pid,exceptionId:ex,decision:'approve',notes:'Authorized this exact quote',confirmed:true},200,actor('ceo'));
 const urgentBody={id:crypto.randomUUID(),...award,planId:urgent.pid,quoteId:urgent.qs[0],revision:current(urgent.pid).revision};
 const uoid=(await source('award',urgentBody,200,actor('commerce_manager'))).operationId;await source('award',urgentBody,200,actor('commerce_manager'));assert.equal(entities('purchase_order').filter(o=>o.id===uoid).length,1);
 assert.equal(order(uoid).data.state,'issued');assert.equal(order(uoid).data.urgentFinance.state,'pending');assert.ok((await reviews('finance',actor('finance'))).items.some(x=>x.taskKey==='urgent_finance:'+uoid));
 await source('review_urgent_finance',{planId:urgent.pid,orderId:uoid,orderRevision:order(uoid).revision,result:'fail',notes:'Unexpected price discrepancy',confirmed:true},200,actor('finance'));
 const problem=current(urgent.pid).data.exceptions.find(x=>x.kind==='unforeseen');assert.ok(problem);assert.equal(order(uoid).data.urgentFinance.state,'fail');
 await source('decide_exception',{planId:urgent.pid,exceptionId:problem.id,decision:'development',notes:'Add explicit approved handling for this case',confirmed:true},200,actor('ceo'));
 let x=current(urgent.pid).data.exceptions.find(x=>x.id===problem.id);assert.ok(entities('development_request').find(r=>r.id===x.developmentId&&r.data.sourceExceptionId===x.id));
 await source('decide_exception',{planId:urgent.pid,exceptionId:x.id,decision:'development',notes:'duplicate',confirmed:true},409,actor('ceo'));
 await source('decide_exception',{planId:urgent.pid,exceptionId:x.id,decision:'assign',ownerRole:'domestic',notes:'Resolve with supplier using existing credit procedure',confirmed:true},200,actor('ceo'));
 await source('complete_exception',{planId:urgent.pid,exceptionId:x.id,notes:'Wrong role',confirmed:true},403,actor('finance'));
 await source('complete_exception',{planId:urgent.pid,exceptionId:x.id,notes:'Supplier credit recorded; reference C-1',confirmed:true},200,actor('domestic'));
 assert.equal(current(urgent.pid).data.exceptions.find(y=>y.id===x.id).state,'completed');
 const blocked=await fixture();const block=(await source('request_exception',{planId:blocked.pid,partCode:'41',kind:'unforeseen',title:'Unmodeled case',evidence:'Delivery requirement',notes:'Need executive decision',confirmed:true},200,actor('inventory'))).operationId;
 await source('award',{...award,planId:blocked.pid,quoteId:blocked.qs[0]},409,actor('commerce_manager'));
 const sameRevision=current(blocked.pid).revision;const attempts=await Promise.all(['reject','assign'].map(decision=>context.run(actor('ceo'),()=>sourcing.POST(request('/api/sourcing','POST',{id:crypto.randomUUID(),mode:'decide_exception',planId:blocked.pid,revision:sameRevision,exceptionId:block,decision,ownerRole:'domestic',notes:'Concurrent decision',confirmed:true})))));assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
 const ro=(await mint('read')).token;assert.ok((await call('request_procurement_exception',{id:crypto.randomUUID(),planId:pid,revision:current(pid).revision,kind:'unforeseen',partCode:'41',title:'x',evidence:'x',notes:'x',confirmed:true},ro)).error);

 const receiving=require('./helpers/receiving-warehouse.cjs')(sql);
 await op('receipt',{warehouseId:receiving.id,materialId:material.id,purchaseOrderId:oid,day:now.slice(0,10),quantity:'12',supplier:order(oid).data.supplier,discrepancyNotes:'Two excess units',notes:'Physical count 12'});
 let receipt=entities('receipt').find(r=>r.data.purchaseOrderId===oid);assert.ok(receipt.data.purchaseHold);
 await op('incoming_qc',{receiptId:receipt.id,accepted:'12',values:{visual:'pass'},notes:'Quality checked'});receipt=entities('receipt').find(r=>r.id===receipt.id);
 await op('shelve',{receiptId:receipt.id,confirmed:true,placed:true},409);assert.equal(stock(receipt.id,'raw'),0);
 await source('resolve_purchase_receipt',{planId:pid,receiptId:receipt.id,receiptRevision:receipt.revision,orderId:oid,orderRevision:order(oid).revision,notes:'Still insufficient approved quantity',confirmed:true},409,actor('domestic'));
 const correction=put('purchase_order',{...order(oid).data,quantity:12000,totalRial:'120',state:'issued',procurementVersion:2});
 await source('resolve_purchase_receipt',{planId:pid,receiptId:receipt.id,receiptRevision:receipt.revision,orderId:correction,orderRevision:1,notes:'Replacement approved order covers physical quantity',confirmed:true},200,actor('domestic'));
 receipt=entities('receipt').find(r=>r.id===receipt.id);assert.equal(receipt.data.purchaseHold,null);assert.equal(receipt.data.purchaseOrderId,correction);assert.equal(stock(receipt.id,'raw'),0,'resolution does not physically shelve');
 const qcOrder=put('purchase_order',{...order(oid).data,quantity:5000,totalRial:'50',state:'issued'});
 await op('receipt',{warehouseId:receiving.id,materialId:material.id,purchaseOrderId:qcOrder,day:now.slice(0,10),quantity:'5',supplier:order(oid).data.supplier,notes:'Physical count 5'});
 let rejected=entities('receipt').find(r=>r.data.purchaseOrderId===qcOrder);await op('incoming_qc',{receiptId:rejected.id,accepted:'3',values:{visual:'Partial rejection'},notes:'Two rejected units'});rejected=entities('receipt').find(r=>r.id===rejected.id);const originalQC=JSON.stringify(rejected.data.qc);
 const concession={planId:pid,receiptId:rejected.id,receiptRevision:rejected.revision,quantity:'1',notes:'Technical concession for documented noncritical defect',confirmed:true};
 await source('accept_receipt_concession',concession,403,actor('domestic'));await source('accept_receipt_concession',concession,200,actor('engineering'));
 rejected=entities('receipt').find(r=>r.id===rejected.id);assert.equal(rejected.data.accepted,4000);assert.equal(rejected.data.rejected,1000);assert.equal(JSON.stringify(rejected.data.qc),originalQC);assert.equal(stock(rejected.id,'raw'),0);
 const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){sql.exec('BEGIN');for(const table of Object.keys(reset.resetTables))sql.exec('DELETE FROM '+table+' WHERE '+reset.resetWhere(table,scope));assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='sourcing_plan'").get().n,0);assert.ok(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='development_request'").get().n>0);sql.exec('ROLLBACK');}
 sql.exec("UPDATE reset_control SET phase='maintenance'");await source('request_exception',{planId:pid,kind:'unforeseen',partCode:'41',title:'freeze',evidence:'freeze',notes:'freeze',confirmed:true},423,actor('inventory'));sql.exec("UPDATE reset_control SET phase='testing'");
 console.log('PASS procurement workflow: supply selection; mandatory finance; three quotes; CEO urgent exception; pending financial inbox; negative role tests; idempotence; concurrent decisions; linked development; scoped blocking; read-only MCP; reset freeze.');
})().catch(e=>{console.error(e);process.exit(1)});
