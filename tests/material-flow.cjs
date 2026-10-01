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
 await op('build',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'1'}],notes:''},400);
 const before=stock(r1.id,'line');await op('build',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'100'}],notes:'test deficit'},409);assert.equal(stock(r1.id,'line'),before);
 await op('build',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'1'},{batchId:r2.id,quantity:'1'}],notes:''});assert.equal(stock(r1.id,'line'),7000);assert.equal(stock(builds[0].id,'finished'),0);
 await op('build',{deviceId:builds[0].id,allocations:[{batchId:r1.id,quantity:'2'}]},400);
 async function qc(verdict,value){const r=await qualityApi.POST(request('/api/quality/reports','POST',{requestId:crypto.randomUUID(),deviceId:builds[0].id,templateId:template.id,verdict,values:{purity:value},cause:'part',notes:'inspection'}));assert.equal(r.status,201,JSON.stringify(await r.json()));}
 await qc('fail','70');await op('repair',{deviceId:builds[0].id,oldBatchId:r1.id,newBatchId:r2.id,quantity:'1',reason:'bad part',cause:'part'});assert.equal(stock(r1.id,'nonconforming'),1000);assert.equal(stock(r2.id,'line'),0);
 await qc('pass','94');assert.equal(entities('finaltest').length,2);assert.equal(entities('repair').length,1);assert.equal(entities('finaltest')[0].data.verdict,'fail');
 await op('reject',{batchId:r1.id,quantity:'1',reason:'visual defect'});assert.equal(stock(r1.id,'line'),6000);assert.equal(stock(r1.id,'nonconforming'),2000);
 await op('supply',{materialId:'material:01',quantity:'5',notes:'planned need'});await op('supply',{materialId:'material:01',quantity:'5',notes:'duplicate'},409);
 assert.equal((await flow.GET()).status,200);
 const worker={userId:'worker',email:'worker@example.com',name:'Worker',isAdmin:false,permissions:{read:['batch'],write:['batch'],eventStages:[],flowRoles:['production']}};
 const denied=await load('lib/mcp/context.ts').mcpActor.run(worker,()=>flow.POST(request('/api/flow','POST',{id:crypto.randomUUID(),mode:'incoming_qc',receiptId:r1.id,accepted:'8',rejected:'2',values:{purity:'92'},notes:'not authorized'})));assert.equal(denied.status,403);
 identity=null;assert.equal((await flow.GET()).status,401);
 console.log('Material flow passed: partial incoming QC, quarantine, slot conflicts, FIFO/split batches, idempotency, role checks, serial capacity, assembler, stock rollback, actual consumption, repair and retained retest, procurement deduplication.');
})().catch(e=>{console.error(e);process.exit(1)});
