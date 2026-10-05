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
 const today=load('lib/duties.ts').dayAt(),later=new Date(Date.now()+10*86400000).toISOString().slice(0,10),future=new Date(Date.now()+20*86400000).toISOString().slice(0,10),now=new Date().toISOString();
 for(const role of ['sales','ceo','inventory','engineering','finance','domestic','foreign']){const a=actor(role);sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'تست','active',?,?,1,?,?)").run(a.userId,a.email,a.name,a.userId,JSON.stringify(a.permissions),now,now);}
 const p=await create('product',{code:'SUP',name:'SupplyDevice',group:'G',model:'M',warrantyMonths:'12',status:'فعال'});
 const fields=[{key:'purity',label:'Purity',type:'number',unit:'%',min:'90',max:'96',required:true}];
 await op('material',{code:'01',name:'Part',unit:'عدد',specs:'V1',defaultLocation:'A-1-1-1',reorderPoint:'0',targetStock:'0',fields,qcOwner:'',warehouseOwner:'',procurementOwner:'',revision:0});
 const bom=await operate({mode:'bom',productId:p.id,previousVersion:0,lines:[{partCode:'01',name:'Part',unit:'عدد',quantity:'2'}]});
 let material=entities('material')[0];await source('routes',{materialId:material.id,revision:material.revision,routes:['domestic','foreign']},403,actor('sales'));
 await source('routes',{materialId:material.id,revision:material.revision,routes:['domestic','foreign']},200,actor('engineering'));
 await op('receipt',{materialId:material.id,day:today,quantity:'4',supplier:'Stock'});const stocked=entities('receipt')[0];await op('incoming_qc',{receiptId:stocked.id,accepted:'4',rejected:'0',values:{purity:'92'},notes:'pass'});await op('shelve',{receiptId:stocked.id,location:'A-1-1-1'});
 const created=await source('create',{productId:p.id,count:5,origin:'forecast',needBy:future,reference:'FORECAST-1',notes:'sales forecast'},200,actor('sales')),pid=created.planId;
 assert.equal(current(pid).data.state,'pending');assert.ok(sql.prepare("SELECT 1 FROM duty_runs WHERE assignee='ceoUser' AND state='open'").get());
 await source('calculate',{planId:pid,notes:'not approved'},400,actor('inventory'));
 await source('approve',{planId:pid,count:5,needBy:future,notes:'approved'},403,actor('sales'));
 await source('approve',{planId:pid,count:5,needBy:future,notes:'approved'},200,actor('ceo'));
 assert.equal(current(pid).data.bom.version,1);
 await operate({mode:'bom',productId:p.id,previousVersion:1,lines:[{partCode:'01',name:'Part',unit:'عدد',quantity:'3'}]});assert.equal(current(pid).data.bom.lines[0].quantity,'2');
 await source('calculate',{planId:pid,notes:'stock checked'},200,actor('inventory'));
 let d=await detail(pid);assert.equal(d.lines[0].required,10000);assert.equal(d.lines[0].stock,4000);assert.equal(d.lines[0].shortage,6000);assert.equal(d.work.filter(w=>w.role==='domestic'||w.role==='foreign').length,2);
 // Customer allocation within forecast does not create additional demand.
 await source('create',{productId:p.id,count:2,origin:'customer',forecastId:pid,needBy:future,reference:'CUSTOMER-1'},200,actor('sales'));assert.equal(entities('sourcing_plan').length,1);
 await source('create',{productId:p.id,count:4,origin:'customer',forecastId:pid,needBy:future,reference:'OVER'},400,actor('sales'));
 const other=(await source('create',{productId:p.id,count:1,origin:'forecast',needBy:future,reference:'FORECAST-2'})).planId;
 await source('approve',{planId:other,count:1,needBy:future,notes:'approved'});await source('calculate',{planId:other,notes:'cannot reserve twice'});assert.equal((await detail(other)).lines[0].stock,0);
 // Physical raw->line transfer preserves holds; consuming held inventory is atomic and blocked.
 const rq=await op('request',{materialId:material.id,quantity:'4',notes:'line'});const requestId=entities('request')[0].id;
 await op('issue',{requestId,allocations:[{batchId:stocked.id,location:'A-1-1-1',quantity:'4'}],reason:''});assert.equal(stock(stocked.id,'line'),4000);
 await op('reject',{batchId:stocked.id,quantity:'1',reason:'attempt to consume reservation'},409);assert.equal(stock(stocked.id,'line'),4000);
 const quote={planId:pid,partCode:'01',supplier:'Domestic',unitPrice:'10',currency:'IRR',fxRate:'1',fxDate:today,fxSource:'approved rate',extrasRial:'0',costNotes:'included',eta:later,validUntil:future,paymentTerms:'cash',specs:'V1',reference:'Q1',unavailable:false};
 const qd=(await source('quote',{...quote,route:'domestic'},200,actor('domestic'))).operationId;
 await source('award',{planId:pid,partCode:'01',quoteId:qd,notes:'selected'},400,actor('ceo'));
 const qf=(await source('quote',{...quote,route:'foreign',supplier:'Foreign',unitPrice:'1',currency:'USD',fxRate:'5',extrasRial:'5',reference:'Q2'},200,actor('foreign'))).operationId;
 assert.equal(entities('purchase_order').length,0);assert.equal(entities('sourcing_quote').find(q=>q.id===qf).data.totalRial,'35');
 await source('award',{planId:pid,partCode:'01',quoteId:qf,notes:'selected'},400,actor('ceo'));
 for(const qid of [qd,qf])await source('technical',{planId:pid,quoteId:qid,quoteRevision:entities('sourcing_quote').find(q=>q.id===qid).revision,result:'pass',notes:'matches approved spec'},200,actor('engineering'));
 const engineering=await detail(pid,actor('engineering'));assert.equal(engineering.quotes.length,2);assert.equal(engineering.quotes[0].data.totalRial,undefined);assert.equal(engineering.plan.data.finance.budgetRial,undefined);
 const domestic=await detail(pid,actor('domestic'));assert.equal(domestic.quotes.length,1);assert.equal(domestic.quotes[0].data.route,'domestic');
 await source('award',{planId:pid,partCode:'01',quoteId:qd,notes:'x'},400,actor('ceo'));
 const awardBody={id:crypto.randomUUID(),planId:pid,revision:current(pid).revision,partCode:'01',quoteId:qf,notes:'best landed cost, approved technical spec'};
 const race=await Promise.all([awardBody,{...awardBody,id:crypto.randomUUID(),quoteId:qd}].map(body=>context.run(actor('ceo'),()=>sourcing.POST(request('/api/sourcing','POST',{id:body.id,mode:'award',revision:body.revision,...body})))));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);const winner=entities('purchase_order')[0];const order=winner.id;assert.equal(order,awardBody.id);await source('award',awardBody,200,actor('ceo'));
 assert.equal(entities('purchase_order').length,1);assert.equal(entities('purchase_order')[0].data.route,'foreign');assert.equal(entities('purchase_order')[0].data.quantity,6000);
 await source('award',{planId:pid,partCode:'01',quoteId:qd,notes:'another purchase route'},409,actor('ceo'));
 await source('issue_order',{planId:pid,orderId:order,reference:'F1'},400,actor('finance'));
 await source('finance',{planId:pid,status:'approved',budgetRial:'30',availableOn:today,notes:'test budget'},200,actor('finance'));
 await source('issue_order',{planId:pid,orderId:order,reference:'F1'},400,actor('finance'));
 await source('finance',{planId:pid,status:'approved',budgetRial:'100',availableOn:today,notes:'sufficient approved budget'},200,actor('finance'));
 await source('issue_order',{planId:pid,orderId:order,reference:'F2'},200,actor('finance'));
 d=await detail(pid);assert.equal(d.lines[0].pipeline,6000);assert.equal(d.lines[0].shortage,0);
 await source('track',{planId:pid,orderId:order,stage:'shipped',eta:later,reference:'SHIP',notes:'shipped'},200,actor('foreign'));
 await source('track',{planId:pid,orderId:order,stage:'paid',eta:later,reference:'PAY',notes:'payment recorded'},200,actor('finance'));assert.equal(entities('purchase_order')[0].data.state,'shipped');
 await source('track',{planId:pid,orderId:order,stage:'preparing',eta:later,reference:'BACK',notes:'invalid downgrade'},400,actor('foreign'));
 const receiveBody={id:crypto.randomUUID(),planId:pid,orderId:order,day:today,quantity:'4',notes:'partial arrival'};
 await source('receive',receiveBody,200,actor('inventory'));await source('receive',receiveBody,200,actor('inventory'));
 let arrival=entities('receipt').find(r=>r.data.purchaseOrderId===order);assert.ok(arrival);assert.equal(stock(arrival.id,'quarantine'),4000);assert.equal((await detail(pid)).lines[0].stock,4000);
 await source('ready',{planId:pid,notes:'not QC yet'},400,actor('inventory'));
 await source('receive',{planId:pid,orderId:order,day:today,quantity:'3',notes:'overpending'},400,actor('inventory'));
 await op('incoming_qc',{receiptId:arrival.id,accepted:'3',rejected:'1',values:{purity:'93'},notes:'1 rejected'});await op('shelve',{receiptId:arrival.id,location:'A-1-1-2'});
 d=await detail(pid);assert.equal(d.lines[0].stock,7000);assert.equal(d.lines[0].pipeline,3000);
 await source('close_order',{planId:pid,orderId:order,notes:'incomplete'},400,actor('inventory'));
 await source('receive',{planId:pid,orderId:order,day:today,quantity:'3',invoiceQuantity:'3',discrepancyNotes:'Replacement for one quality-rejected unit plus balance',notes:'balance plus replacement'},200,actor('inventory'));
 arrival=entities('receipt').filter(r=>r.data.purchaseOrderId===order).find(r=>r.data.state==='pending_qc');await op('incoming_qc',{receiptId:arrival.id,accepted:'3',rejected:'0',values:{purity:'94'},notes:'pass'});await op('shelve',{receiptId:arrival.id,location:'A-1-1-3'});
 await source('close_order',{planId:pid,orderId:order,notes:'fully accepted'},200,actor('inventory'));
 assert.equal((await detail(pid)).lines[0].stock,10000);await source('ready',{planId:pid,notes:'all stock checked'},200,actor('inventory'));
 await source('release',{planId:pid,reference:'PRODUCTION-PLAN-1',notes:'handed to production'},200,actor('inventory'));assert.equal(sql.prepare('SELECT COUNT(*) n FROM sourcing_holds WHERE plan_id=?').get(pid).n,0);assert.equal(stock(stocked.id,'line'),4000);
 // Missing BOM goes to R&D and resumes only with a matching real BOM.
 const p2=await create('product',{code:'SUP2',name:'No BOM',group:'G',model:'M',warrantyMonths:'12',status:'فعال'}),missing=(await source('create',{productId:p2.id,count:1,origin:'customer',needBy:future,reference:'MISSING'})).planId;
 await source('approve',{planId:missing,count:1,needBy:future,notes:'approved'});assert.equal(current(missing).data.state,'waiting_bom');
 await source('calculate',{planId:missing,notes:'no BOM'},400);await operate({mode:'bom',productId:p2.id,previousVersion:0,lines:[{partCode:'01',name:'Part',unit:'عدد',quantity:'1'}]});
 const bom2=sql.prepare('SELECT id FROM bom_versions WHERE product_id=?').get(p2.id).id;await source('bom',{planId:missing,bomId:bom2,notes:'released engineering BOM'},200,actor('engineering'));assert.equal(current(missing).data.state,'approved');
 const outsider={...actor('none'),permissions:{read:[],write:[],eventStages:[]}};assert.equal((await context.run(outsider,()=>sourcing.GET(request('/api/sourcing')))).status,403);
 token=(await mint('read')).token;assert.ok(!(await call('get_sourcing_plan',{planId:pid})).error);assert.ok((await call('followup_sourcing_plan',{id:crypto.randomUUID(),planId:missing,revision:current(missing).revision,notes:'MCP',confirmed:true})).error);
 token=(await mint('read_write')).token;assert.ok(!(await call('followup_sourcing_plan',{id:crypto.randomUUID(),planId:missing,revision:current(missing).revision,notes:'MCP',confirmed:true})).error);
 // Already prepared line materials stay available to their existing serials.
 const protectedBatch=stocked.id;
 sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('prepared-fixture','build',?,1,?,?)").run(JSON.stringify({state:'prepared',materials:[{partCode:'01',batchId:protectedBatch,quantity:4000}]}),now,now);
 const protectedPlan=(await source('create',{productId:p2.id,count:8,origin:'forecast',needBy:future,reference:'PROTECTED'})).planId;
 await source('approve',{planId:protectedPlan,count:8,needBy:future,notes:'new need'});await source('calculate',{planId:protectedPlan,notes:'respect existing assembly'});assert.equal((await detail(protectedPlan)).lines[0].stock,6000);assert.equal((await detail(protectedPlan)).lines[0].shortage,2000);assert.equal(sql.prepare("SELECT COUNT(*) n FROM sourcing_holds WHERE plan_id=? AND source_id=?").get(protectedPlan,protectedBatch).n,0);
 console.log('Sourcing passed: role checks, frozen BOM, R&D gate, stock reservations, forecast deduplication, dual RFQ / single award, landed cost, budget, partial QC receipts/replacements, readiness, task projection, MCP permissions and idempotency.');
})().catch(e=>{console.error(e);process.exit(1)});
