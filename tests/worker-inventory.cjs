const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}



const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/worker-inventory/route.ts'),profiles=load('app/api/role-profiles/route.ts');
const admin={userId:'owner',email:'owner@example.com',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};let user=admin;
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-11-06','2026-11-06');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
const balance=(id,wh)=>sql.prepare('SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse=?').get(id,wh)?.quantity||0;
const request=(path,body)=>new Request('https://test.local'+path,{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)});
async function post(body,status=200){const r=await ctx.run(user,()=>api.POST(request('/api/worker-inventory',body))),v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
const body=(mode,extra={})=>({id:crypto.randomUUID(),confirmed:true,mode,...extra});
(async()=>{
const positionOp={id:crypto.randomUUID(),confirmed:true,mode:'production_position',title:'Production position 1'};
let r=await ctx.run(admin,()=>profiles.POST(request('/api/role-profiles',positionOp))),p=await r.json();assert.equal(r.status,200);const position=p.id;
r=await ctx.run(admin,()=>profiles.POST(request('/api/role-profiles',positionOp)));assert.equal((await r.json()).repeated,true);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,0,'No person/account created');
r=await ctx.run(admin,()=>profiles.GET(new Request('https://test.local/api/role-profiles')));const catalog=await r.json();assert.ok(catalog.profiles.some(p=>p.id==='central-store'));assert.ok(!catalog.profiles.some(p=>p.id==='firmware'));
entity('lot','routine_lot',{route:{name:'Intermediate',partCode:'22',unit:'عدد',version:1,steps:[{title:'Make',bom:[{partCode:'11',unit:'عدد',quantity:1000}]}]},ready:[0],movements:[],received:0,cost:null});
entity('job','routine_job',{custodyVersion:2,memberId:position,memberName:'Production position 1',lotId:'lot',state:'open',stage:0,remaining:10,step:{bom:[{partCode:'11',unit:'عدد',quantity:1000}]},outputs:[],history:[]});
sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('raw','batch',?,'2026-11-06')").run(JSON.stringify({code:'RAW',partCode:'11',unit:'عدد',status:'تأیید'}));
sql.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES('opening','opening','{}','owner','2026-11-06',1)").run();
sql.prepare("INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES('raw@line','raw','line',15000)").run();sql.prepare("INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES('opening','opening','raw','line',15000)").run();
const qrScan=load('lib/batch-qr.ts').batchQrText({id:'raw',data:JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get('raw').payload)},'https://test.local');
const wh='worker:'+position,allocation=body('allocate',{positionId:position,batchId:'raw',quantity:'8',scannedCode:qrScan});
await post({...allocation,scannedCode:'wrong'},400);assert.equal(balance('raw','line'),15000);
await post(allocation);await post(allocation);assert.equal(balance('raw',wh),8000);assert.equal(balance('raw','line'),7000);
const physical=body('physical_output',{jobId:'job',revision:1,good:10});await post(physical);const output='worker-output:'+physical.id;
await post(body('physical_output',{jobId:'job',revision:2,good:1}),400);
const shortage=await post(body('receive_output',{outputId:output,revision:1}));assert.equal(shortage.pending,true);assert.equal(row(output).data.state,'awaiting_materials');assert.equal(row('job').data.outputs.length,0);assert.equal(balance('raw',wh),8000);assert.equal(row('lot').data.received,0);
await post(body('allocate',{positionId:position,batchId:'raw',quantity:'2',scannedCode:'raw'}));
// Changing a current route does not rewrite the frozen mission BOM.
entity('new-route','routine_route',{partCode:'22',version:2,steps:[{bom:[{partCode:'11',quantity:2000}]}]});
const receive=body('receive_output',{outputId:output,revision:2});await post(receive);await post(receive);const received=row(output).data;
assert.equal(received.state,'received');assert.equal(received.routeVersion,1);assert.equal(balance('raw',wh),0);assert.equal(balance('raw','line'),5000,'No second line consumption');assert.equal(balance(received.batchId,'line'),10000);assert.equal(row('job').data.outputs[0].good,10);assert.equal(row('job').data.outputs[0].consumed[0].quantity,10000);
await post(body('receive_output',{outputId:output,revision:3}),409);
await post(body('allocate',{positionId:position,batchId:'raw',quantity:'3',scannedCode:'RAW'}));
const reject=body('reject_parts',{positionId:position,batchId:'raw',quantity:'1',scannedCode:'RAW',reason:'Failed incoming part during assembly'});await post(reject);const nc='worker-nc:'+reject.id;assert.equal(balance('raw',wh),2000);assert.equal(balance('raw','nonconforming'),1000);
await post(body('assign_diagnosis',{nonconformingId:nc,revision:1,positionId:position}));
await post(body('repair_complete',{nonconformingId:nc,revision:2,quantity:'1',reason:'Fixed and returned'}));assert.equal(balance('raw','nonconforming'),0);assert.equal(balance('raw','line'),3000);
await post(body('return_to_line',{positionId:position,batchId:'raw',quantity:'1',scannedCode:'RAW'}));assert.equal(balance('raw',wh),1000);assert.equal(balance('raw','line'),4000);
user={userId:'qc',name:'QC',isAdmin:false,permissions:{read:[],write:[],eventStages:[],flowRoles:['qc']}};await post(body('allocate',{positionId:position,batchId:'raw',quantity:'1',scannedCode:'RAW'}),403);
let denied=await ctx.run(user,()=>profiles.GET(new Request('https://test.local/api/role-profiles')));assert.equal(denied.status,403);

user=admin;
entity('raw','receipt',{batchId:'raw',materialId:'material:11',state:'stored',expiry:'',day:'2026-11-06'});
sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('product','product',?,'2026-11-06')").run(JSON.stringify({name:'Device',code:'301',model:'M'}));
sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('device:SERIAL1','device',?,'2026-11-06')").run(JSON.stringify({product:'product',code:'SERIAL1',model:'M'}));
const criteria=[{key:'visual',label:'Visual',type:'result',unit:'',min:'',max:'',required:true}];
sql.prepare('INSERT INTO quality_templates(id,product_id,version,title,fields,created,created_by) VALUES(?,?,?,?,?,?,?)').run('template','product',1,'QC',JSON.stringify(criteria),'2026-11-06','owner');
entity('device:SERIAL1','build',{workflowVersion:3,planId:'finished-plan',templateId:'template',bomId:'finished-bom',assemblerId:position,assembler:'Production position 1',state:'prepared',materials:[{batchId:'raw',partCode:'11',quantity:1000}],latestQc:null});
await post(body('package_finished',{deviceId:'device:SERIAL1',revision:1,positionId:position}),400);
const quality=load('app/api/quality/reports/route.ts');
let qc=await ctx.run(admin,()=>quality.POST(request('/api/quality/reports',{requestId:crypto.randomUUID(),deviceId:'device:SERIAL1',templateId:'template',values:{visual:'pass'},verdict:'pass',notes:'Checked serial'})));assert.equal(qc.status,201,JSON.stringify(await qc.json()));
await post(body('package_finished',{deviceId:'device:SERIAL1',revision:2,positionId:position}));assert.equal(balance('raw',wh),1000,'Packaging does not consume');
await post(body('receive_finished',{deviceId:'device:SERIAL1',revision:3,scannedCode:'wrong'}),400);
const finalReceipt=body('receive_finished',{deviceId:'device:SERIAL1',revision:3,scannedCode:'SERIAL1'});await post(finalReceipt);await post(finalReceipt);assert.equal(balance('raw',wh),0);assert.equal(balance('device:SERIAL1','line_finished'),1000);assert.equal(row('device:SERIAL1').data.lineReceived,true);
entity('finished-plan','plan',{});entity('printed','print',{planId:'finished-plan'});entity('central','material_warehouse',{name:'Central',active:true,warehouseType:'storage',locations:[]});
const fulfill=load('app/api/fulfillment/route.ts');
async function finish(mode,extra){const id=crypto.randomUUID(),r=await ctx.run(admin,()=>fulfill.POST(request('/api/fulfillment',{id,mode,confirmed:true,...extra}))),d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return id;}
const handoff=await finish('handoff',{warehouseId:'central',deviceIds:['device:SERIAL1'],packaged:true,notes:'Physical dispatch'});assert.equal(balance('device:SERIAL1','line_finished'),0);assert.equal(balance('device:SERIAL1','product_transit'),1000);
await finish('receive',{handoffId:handoff,warehouseId:'central',deviceIds:['device:SERIAL1'],notes:'Central receipt'});assert.equal(balance('device:SERIAL1','product_transit'),0);assert.equal(balance('device:SERIAL1','finished'),1000);assert.equal(balance('raw','line'),4000,'No extra central receipt consumption');
console.log('PASS serial QC -> packaging -> line scan/worker consumption -> central handoff -> central receipt, with conserved product custody and retries.');
await post(body('allocate',{positionId:position,batchId:'raw',quantity:'1',scannedCode:'RAW'}));
user=admin;beforeBatch=()=>sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='job'").run();const before=balance('raw',wh);await post(body('return_to_line',{positionId:position,batchId:'raw',quantity:'1',scannedCode:'RAW'}),409);assert.equal(balance('raw',wh),before,'Concurrent snapshot rollback');

await post(body('count_policy',{positionId:position,everyDays:7,active:true}));await load('lib/inventory-counts.ts').syncWorkerCounts();assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='worker_count_round'").get().n,1);
await post(body('dispatch_to_central',{batchId:'raw',quantity:'1',warehouseId:'central',scannedCode:'RAW'}));const tr=sql.prepare("SELECT * FROM flow_entities WHERE type='line_return'").get();let transfer=JSON.parse(tr.data);assert.equal(balance('raw','line_return_transit'),1000);
await post(body('receive_from_line',{transferId:tr.id,revision:tr.revision,quantity:'0.5',scannedCode:'RAW',location:'A-1-1-1'}));assert.equal(JSON.parse(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(tr.id).data).state,'discrepancy');assert.equal(balance('raw','raw'),0);
await post(body('revise_line_return',{transferId:tr.id,revision:tr.revision+1,quantity:'0.5',reason:'Both keepers verified actual physical count'}));await post(body('receive_from_line',{transferId:tr.id,revision:tr.revision+2,quantity:'0.5',scannedCode:'RAW',location:'A-1-1-1'}));assert.equal(balance('raw','raw'),500);assert.equal(balance('raw','line_return_transit'),0);assert.equal(sql.prepare("SELECT quantity FROM flow_slots WHERE location='central|A-1-1-1'").get().quantity,500);
console.log('PASS worker count schedule and mandatory line-to-central physical scan, discrepancy return/revision, two-sided agreement and stock conservation.');

sql.exec("UPDATE reset_control SET phase='maintenance'");const frozen=balance('raw',wh);await post(body('return_to_line',{positionId:position,batchId:'raw',quantity:'0.1',scannedCode:'RAW'}),423);assert.equal(balance('raw',wh),frozen,'Reset freeze blocks the whole new worker transaction');sql.exec("UPDATE reset_control SET phase='idle'");
console.log('PASS person-independent role profiles and worker custody: no account, scan match, allocation, physical pending shortage, receive-only frozen BOM consumption, no double line decrement, performance attribution, nonconforming/repair, returns, replay, role denial and concurrent rollback.');
})().catch(e=>{console.error(e);process.exit(1)});
