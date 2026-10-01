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
(async()=>{
 identity=owner;await auth.session();
 auth.checkOrigin(new Request('http://127.0.0.1:3000/api/flow',{headers:{origin:'https://company.test','x-forwarded-host':'company.test','x-forwarded-proto':'https'}}));
 assert.throws(()=>auth.checkOrigin(new Request('http://127.0.0.1:3000/api/flow',{headers:{origin:'https://evil.test','x-forwarded-host':'company.test','x-forwarded-proto':'https'}})),e=>e.status===403);
const p=await create('product',{code:'FLOW',name:'FlowDevice',group:'G',model:'M',warrantyMonths:'12',status:'فعال'});
 const fields=[{key:'purity',label:'Purity',type:'number',unit:'%',min:'90',max:'96',required:true}];
 const tr=await templateApi.POST(request('/api/quality/templates','POST',{productId:p.id,title:'QC',fields,previousVersion:0}));assert.equal(tr.status,201);const template=(await tr.json()).template;
 const bomId=crypto.randomUUID();await operate({mode:'bom',id:bomId,productId:p.id,previousVersion:0,lines:[{partCode:'01',name:'Part',unit:'عدد',quantity:'2'}]});
 await op('material',{code:'01',name:'Part',unit:'عدد',specs:'V1',defaultLocation:'A-1-1-1',reorderPoint:'5',targetStock:'15',fields,qcOwner:'',warehouseOwner:'',procurementOwner:'',revision:0});
 for(const day of ['2026-09-29','2026-09-30'])await op('receipt',{materialId:'material:01',day,quantity:'10',supplier:'Supplier',specs:'V1'});
 const [r1,r2]=entities('receipt');assert.equal(stock(r1.id,'quarantine'),10000);
 await op('shelve',{receiptId:r1.id,location:'A-1-1-1'},400);
 await op('incoming_qc',{receiptId:r1.id,accepted:'10',rejected:'0',values:{purity:'70'},notes:'bad'},400);
 await op('incoming_qc',{receiptId:r1.id,accepted:'8',rejected:'2',values:{purity:'92'},notes:'2 damaged'});
 await op('incoming_qc',{receiptId:r1.id,accepted:'8',rejected:'2',values:{purity:'92'},notes:'repeat'},409);
 await op('incoming_qc',{receiptId:r2.id,accepted:'10',rejected:'0',values:{purity:'94'},notes:'all checked'});
 const shelfId=crypto.randomUUID();await op('shelve',{id:shelfId,receiptId:r1.id,location:'A-1-1-1'});await op('shelve',{id:shelfId,receiptId:r1.id,location:'A-1-1-1'});assert.equal(stock(r1.id,'raw'),8000);assert.equal(stock(r1.id,'quarantine'),2000);
 await op('shelve',{receiptId:r2.id,location:'A-1-1-1'},409);assert.equal(stock(r2.id,'quarantine'),10000);
 await op('shelve',{receiptId:r2.id,location:'A-1-1-2'});
 await operate({mode:'move',batchId:r1.id,from:'raw',to:'line',quantity:'1'},400);
 const req=crypto.randomUUID();await op('request',{id:req,materialId:'material:01',quantity:'10',notes:'daily'});
 await op('issue',{requestId:req,allocations:[{batchId:r2.id,location:'A-1-1-2',quantity:'10'}],reason:''},400);
 await op('issue',{requestId:req,allocations:[{batchId:r1.id,location:'A-1-1-1',quantity:'8'},{batchId:r2.id,location:'A-1-1-2',quantity:'2'}],reason:''});assert.equal(stock(r1.id,'line'),8000);
 await op('issue',{requestId:req,allocations:[{batchId:r1.id,location:'A-1-1-1',quantity:'8'},{batchId:r2.id,location:'A-1-1-2',quantity:'2'}]},409);
 await op('capacity',{productId:p.id,capacity:2,smallLabels:3,revision:0});
 await op('plan',{productId:p.id,count:3,design:'1',reason:''},400);
 await op('plan',{productId:p.id,count:2,design:'1',reason:''});const builds=entities('build');assert.equal(builds.length,2);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM serial_reservations').get().n,2);
 await op('build',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'2'}]},400);
 await op('assign',{deviceIds:builds.map(x=>x.id),assembler:'Assembler 1',reason:''});
 await op('prepare',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'1'}],notes:''},400);
 const before=stock(r1.id,'line');await op('prepare',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'100'}],notes:'test deficit'},409);assert.equal(stock(r1.id,'line'),before);
 await op('prepare',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'1'},{batchId:r2.id,quantity:'1'}],notes:'split batch technical reason'});assert.equal(stock(r1.id,'line'),8000);
 await op('build',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'1'},{batchId:r2.id,quantity:'1'}]},400);
 async function qc(verdict,value,did=builds[0].id){const r=await qualityApi.POST(request('/api/quality/reports','POST',{requestId:crypto.randomUUID(),deviceId:did,templateId:template.id,verdict,values:{purity:value},cause:'part',notes:'inspection'}));assert.equal(r.status,201,JSON.stringify(await r.json()));}
 await qc('fail','70');await op('repair',{deviceId:builds[0].id,oldBatchId:r1.id,newBatchId:r2.id,quantity:'1',reason:'bad part',cause:'part'});assert.equal(stock(r1.id,'nonconforming'),1000);assert.equal(stock(r2.id,'line'),2000);
 await qc('pass','94');assert.equal(entities('finaltest').length,2);assert.equal(entities('repair').length,1);assert.equal(entities('finaltest')[0].data.verdict,'fail');
 const finalize={id:crypto.randomUUID(),deviceId:builds[0].id,allocations:[{batchId:r2.id,quantity:'2'}],notes:''};await op('build',finalize);await op('build',finalize);assert.equal(stock(r2.id,'line'),0);
 await op('reject',{batchId:r1.id,quantity:'1',reason:'visual defect'});assert.equal(stock(r1.id,'line'),6000);assert.equal(stock(r1.id,'nonconforming'),2000);
 await op('prepare',{deviceId:builds[1].id,allocations:[{batchId:r1.id,quantity:'2'}],notes:''});await qc('pass','93',builds[1].id);await qc('fail','70',builds[1].id);await op('build',{deviceId:builds[1].id,allocations:[{batchId:r1.id,quantity:'2'}],notes:''},400);await qc('pass','93',builds[1].id);
 const finalize2={deviceId:builds[1].id,allocations:[{batchId:r1.id,quantity:'2'}],notes:''};await op('build',finalize2);
 const fulfillment=load('app/api/fulfillment/route.ts');
 async function finish(mode,b={},status=200,actor){const req=()=>fulfillment.POST(request('/api/fulfillment','POST',{id:crypto.randomUUID(),mode,...b}));const r=actor?await load('lib/mcp/context.ts').mcpActor.run(actor,req):await req();const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
 const actor=(role,warehouses=[])=>({userId:role+'User',email:role+'@test.local',name:role,isAdmin:false,permissions:{read:[],write:[],eventStages:[],flowRoles:[role],warehouses}});
 const wh=actor('inventory',['finished']),noWh=actor('inventory',['raw']),salesActor=actor('sales'),prod=actor('production'),log=actor('logistics');
 const handoff={id:crypto.randomUUID(),deviceIds:builds.map(x=>x.id),packaged:true,notes:''};
 await finish('handoff',handoff,400,prod); // cannot claim unprinted serials
 await op('print',{planId:entities('plan')[0].id,notes:'physical print requested'});
 await finish('handoff',handoff,200,prod);await finish('handoff',handoff,200,prod);
 assert.equal(stock(builds[0].id,'finished'),0);assert.equal(stock(r1.id,'line'),4000);
 await finish('receive',{handoffId:handoff.id,deviceIds:[builds[0].id],notes:'partial delivery'},403,noWh);
 await finish('receive',{handoffId:handoff.id,deviceIds:[builds[0].id],notes:''},400,wh);
 const receive={id:crypto.randomUUID(),handoffId:handoff.id,deviceIds:[builds[0].id],notes:'partial delivery'};await finish('receive',receive,200,wh);await finish('receive',receive,200,wh);assert.equal(stock(builds[0].id,'finished'),1000);
 await finish('receive',{handoffId:handoff.id,deviceIds:[builds[0].id],notes:'again'},409,wh);
 const partyId=crypto.randomUUID();await finish('party',{id:partyId,name:'Representative',kind:'representative',address:'Test city',phone:'123',active:true},200,salesActor);
 await finish('reserve',{productId:p.id,partyId,count:2,deviceIds:[],notes:''},409,salesActor);
 const saleId=crypto.randomUUID();await finish('reserve',{id:saleId,productId:p.id,partyId,count:1,deviceIds:[],notes:''},200,salesActor);
 await finish('reserve',{productId:p.id,partyId,count:1,deviceIds:[builds[0].id],notes:''},409,salesActor); // cannot double reserve
 assert.equal(stock(builds[0].id,'finished'),1000); // reservation is not exit
 await finish('receive',{handoffId:handoff.id,deviceIds:[builds[1].id],notes:''},200,wh);
 const carrierId=crypto.randomUUID(),now=new Date().toISOString();sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'تدارکات','active',?,?,1,?,?)").run(carrierId,'carrier@example.com','Carrier',log.userId,JSON.stringify(log.permissions),now,now);
 const dispatch={id:crypto.randomUUID(),saleId,deviceIds:[builds[1].id],carrierId,handedOver:true,reason:'serial substitution',receiptReference:'R1'};
 await finish('dispatch',dispatch,403,salesActor);await finish('dispatch',{...dispatch,reason:''},400,wh);
 await finish('dispatch',dispatch,200,wh);await finish('dispatch',dispatch,200,wh);assert.equal(stock(builds[1].id,'finished'),0);assert.equal(stock(builds[1].id,'in_transit'),1000);assert.equal(entities('build').find(x=>x.id===builds[0].id).data.state,'finished');
 await finish('cancel_sale',{saleId,reason:'too late'},400,salesActor);
 await finish('acknowledge',{saleId,notes:''},403,{...log,userId:'wrongCarrier'});await finish('acknowledge',{saleId,notes:'received'},200,log);
 const cancelled=crypto.randomUUID();await finish('reserve',{id:cancelled,productId:p.id,partyId,count:1,deviceIds:[builds[0].id],notes:''},200,salesActor);await finish('cancel_sale',{saleId:cancelled,reason:'customer cancelled'},200,salesActor);assert.equal(entities('build').find(x=>x.id===builds[0].id).data.state,'finished');
 assert.equal(stock(r1.id,'line'),4000);assert.equal(stock(r2.id,'line'),0); // no double consumption at warehouse receipt or dispatch
 const outsider=await load('lib/mcp/context.ts').mcpActor.run({...log,userId:'wrongCarrier'},()=>fulfillment.GET());assert.equal((await outsider.json()).sales.length,0);
 token=(await mint('read')).token;assert.ok(!(await call('get_fulfillment')).error);assert.ok((await call('reserve_finished_sale',{id:crypto.randomUUID(),partyId,productId:p.id,count:1,deviceIds:[],notes:'',confirmed:true})).error);
 token=(await mint('read_write')).token;const mcpSale=crypto.randomUUID();assert.ok(!(await call('reserve_finished_sale',{id:mcpSale,partyId,productId:p.id,count:1,deviceIds:[],notes:'',confirmed:true})).error);assert.ok(!(await call('cancel_finished_sale',{id:crypto.randomUUID(),saleId:mcpSale,reason:'MCP test',confirmed:true})).error);
 const raceBodies=[1,2].map(()=>({id:crypto.randomUUID(),mode:'reserve',partyId,productId:p.id,count:1,deviceIds:[builds[0].id],notes:''}));const race=await Promise.all(raceBodies.map(b=>fulfillment.POST(request('/api/fulfillment','POST',b))));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 console.log('Fulfillment passed: pre-QC materials, print gate, partial receipt, warehouse scope, reservation collision, serial swap, physical dispatch, idempotency, carrier-only acknowledgment, cancellation, no double consumption.');
 await op('supply',{materialId:'material:01',quantity:'5',notes:'planned need'});await op('supply',{materialId:'material:01',quantity:'5',notes:'duplicate'},409);
 assert.equal((await flow.GET()).status,200);
 const worker={userId:'worker',email:'worker@example.com',name:'Worker',isAdmin:false,permissions:{read:['batch'],write:['batch'],eventStages:[],flowRoles:['production']}};
 const denied=await load('lib/mcp/context.ts').mcpActor.run(worker,()=>flow.POST(request('/api/flow','POST',{id:crypto.randomUUID(),mode:'incoming_qc',receiptId:r1.id,accepted:'8',rejected:'2',values:{purity:'92'},notes:'not authorized'})));assert.equal(denied.status,403);
 identity=null;assert.equal((await flow.GET()).status,401);
 console.log('Material flow passed: partial incoming QC, quarantine, slot conflicts, FIFO/split batches, idempotency, role checks, serial capacity, assembler, stock rollback, actual consumption, repair and retained retest, procurement deduplication.');
})().catch(e=>{console.error(e);process.exit(1)});
