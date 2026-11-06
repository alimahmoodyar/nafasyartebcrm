const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}





const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/inventory-counts/route.ts');
const admin={userId:'owner',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};let user=admin;
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-11-06','2026-11-06');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
const balance=()=>sql.prepare("SELECT quantity FROM inventory_balances WHERE item_id='batch' AND warehouse='raw'").get().quantity;
const operation=(mode,data={})=>({id:crypto.randomUUID(),confirmed:true,mode,...data});
async function post(b,status=200){const r=await ctx.run(user,()=>api.POST(new Request('https://test.local/api/inventory-counts',{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(b)}))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function movement(q,body={}){const id=crypto.randomUUID(),helpers=load('lib/stocktake-lock.ts'),extra=await helpers.annualCountMovementStatements(db,id,body,[{itemId:'batch',stage:'raw',delta:q}]);await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'test','{}','owner','now',1)").bind(id),...extra,db.prepare("UPDATE inventory_balances SET quantity=quantity+? WHERE item_id='batch' AND warehouse='raw'").bind(q),db.prepare("UPDATE flow_slots SET quantity=quantity+? WHERE location='central|A-1-1-1'").bind(q),db.prepare("INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,'batch','raw',?)").bind(id,id,q)]);}
(async()=>{
entity('central','material_warehouse',{active:true,warehouseType:'storage',name:'Central'});entity('batch','receipt',{warehouseId:'central',state:'stored'});entity('need','request',{state:'pending'});
sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('batch','batch',?,'now')").run(JSON.stringify({code:'B1',partCode:'11',part:'Raw',unit:'unit'}));
sql.prepare("INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES('batch@raw','batch','raw',100000)").run();sql.prepare("INSERT INTO flow_slots(location,batch_id,quantity) VALUES('central|A-1-1-1','batch',100000)").run();
await post(operation('policy',{warehouseId:'central',everyDays:7,itemCount:1,dueHours:24,escalateHours:48,priorityCodes:[],active:true}));
let c=sql.prepare("SELECT id FROM flow_entities WHERE type='inventory_count'").get().id;
await post(operation('count',{caseId:c,revision:row(c).revision,items:[{key:'raw:central|A-1-1-1',scannedCode:'WRONG',quantity:'90'}]}),400);
await post(operation('count',{caseId:c,revision:row(c).revision,items:[{key:'raw:central|A-1-1-1',scannedCode:'B1',quantity:'90'}]}));assert.equal(row(c).data.state,'review');
await assert.rejects(()=>movement(-91000));assert.equal(balance(),100000,'Shortage cannot be issued; rollback preserved');await movement(-20000);assert.equal(balance(),80000,'Certain stock continues without whole warehouse halt');
await post(operation('finance_approve',{caseId:c,revision:row(c).revision}),400);
const approve=operation('finance_approve',{caseId:c,revision:row(c).revision,unknownCause:true});await post(approve);await post(approve);assert.equal(balance(),70000,'Count delta preserves subsequent issue');assert.equal(row(c).data.unknownCause,true);
const annual=await post(operation('annual_start',{warehouseId:'central',reservationNotes:'Needs counted and physically separated',reservations:[{key:'raw:central|A-1-1-1',quantity:'10',referenceId:'need'}]}));c=annual.id;
await assert.rejects(()=>movement(-1000));await assert.rejects(()=>movement(1000));await assert.rejects(()=>load('lib/stocktake-lock.ts').assertWarehouseNotCounting(db,'central'));
await movement(-4000,{requestId:'need'});assert.equal(balance(),66000);assert.equal(row(c).data.reservations[0].remaining,6000);
await assert.rejects(()=>movement(-7000,{requestId:'need'}));assert.equal(balance(),66000);
await post(operation('count',{caseId:c,revision:row(c).revision,items:[{key:'raw:central|A-1-1-1',scannedCode:'B1',quantity:'60'}]}));
await post(operation('finance_approve',{caseId:c,revision:row(c).revision,rootCause:'No difference'}));assert.equal(row(c).data.state,'awaiting_reopen');await assert.rejects(()=>movement(-1000));
await post(operation('ceo_approve',{caseId:c,revision:row(c).revision}));assert.equal(row(c).data.state,'completed');await movement(-1000);assert.equal(balance(),65000);

entity('worker-difference','worker_count',{positionId:'position',batchId:'batch',expected:1000,actual:500,state:'discrepancy',reason:'Count verified'});sql.prepare("INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES('batch@worker:position','batch','worker:position',1000)").run();await post(operation('resolve_discrepancy',{caseId:'worker-difference',revision:1,rootCause:'Miscount at worker handoff'}));assert.equal(sql.prepare("SELECT quantity FROM inventory_balances WHERE warehouse='worker:position'").get().quantity,500);assert.equal(row('worker-difference').data.state,'completed');
user={userId:'worker',name:'Worker',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};await post(operation('policy',{warehouseId:'central'}),403);
console.log('PASS continuous/annual stocktake: scheduled cycle, scan validation, shortage holds, ongoing deliveries, explicit unknown cause, delta correction, retry, frozen request quotas, blocked nonfrozen/inbound moves, finance + CEO reopening and role denial.');
})().catch(e=>{console.error(e);process.exit(1)});
