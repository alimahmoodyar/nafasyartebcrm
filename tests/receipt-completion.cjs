const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let barcodeModule=null;let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='@bwip-js/generic')return barcodeModule;if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}





const ctx=load('lib/mcp/context.ts').mcpActor,flow=load('app/api/flow/route.ts'),files=load('app/api/receipt-observations/files/route.ts'),notes=load('app/api/receipt-observations/route.ts');
const admin={userId:'owner',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};let user=admin;
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-11-06','2026-11-06');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
const request=(url,body)=>new Request('https://test.local'+url,{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)});
async function post(api,b,status=200){const r=await ctx.run(user,()=>api.POST(request('/api/test',b))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
function employee(id,permissions){sql.prepare("INSERT INTO app_members(id,email,subject,name,unit,status,permissions,created,updated) VALUES(?,?,?,?,'test','active',?,'now','now')").run(id,id+'@test',id,id,JSON.stringify(permissions));}

(async()=>{
barcodeModule=await import('@bwip-js/generic');
const wh=require('./helpers/receiving-warehouse.cjs')(sql),report=load('app/api/receipt-report/route.ts');
const actor=role=>({userId:role,name:role,isAdmin:false,permissions:{read:[],write:[],eventStages:[],supplyRoles:[role]}});
for(const role of ['domestic','foreign','finance'])employee(role,actor(role).permissions);
entity('both','material',{code:'10100022',name:'Both routes',unit:'unit',fields:[],sourcingRoutes:['domestic','foreign']});
entity('domestic-only','material',{code:'10100023',name:'Domestic only',unit:'unit',fields:[],sourcingRoutes:['domestic']});
const receipt=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'both',warehouseId:wh.id,day:'2026-11-06',quantity:'10',receiptNote:'Received box dented <script>unsafe</script>'});
const caseId=receipt.quantityObservationId,originalBatch=receipt.receiptId;
const work=load('lib/role-profiles.ts').materialProfileWork;
assert.ok(work('domestic',[row(caseId)]).length);assert.ok(work('foreign',[row(caseId)]).length);
const restricted=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'domestic-only',warehouseId:wh.id,day:'2026-11-06',quantity:'2'});
assert.equal(row(restricted.quantityObservationId).data.route,'domestic');assert.equal(work('foreign',[row(restricted.quantityObservationId)]).length,0);
const get=async(api,url)=>ctx.run(user,()=>api.GET(new Request('https://test.local'+url)));
user=actor('foreign');assert.equal((await get(notes,'/api/receipt-observations?id='+encodeURIComponent(restricted.quantityObservationId))).status,404);
user=admin;
let res=await get(report,'/api/receipt-report?id='+encodeURIComponent(originalBatch)+'&format=json'),data=await res.json();assert.equal(res.status,200);assert.equal(data.warehouse,'Synthetic receiving store');assert.equal(data.registeredBy,'Owner');assert.equal(data.quantity,10);assert.equal(data.supplier,'');assert.equal(data.notes[0].body,'Received box dented <script>unsafe</script>');
entity('po-domestic','purchase_order',{materialId:'both',quantity:10000,unit:'unit',state:'issued',supplier:'Local supplier',route:'domestic',totalRial:'SECRET-PRICE',quoteId:'quote-private',quoteSnapshot:{reference:'PRIVATE-DOC',unitPrice:'SECRET-UNIT'}});
entity('po-foreign','purchase_order',{materialId:'both',quantity:12000,unit:'unit',state:'shipped',supplier:'Foreign supplier',route:'foreign',totalRial:'SECRET-PRICE'});
entity('wrong-material','purchase_order',{materialId:'domestic-only',quantity:10000,unit:'unit',state:'issued',supplier:'Wrong',route:'domestic'});
user=actor('domestic');res=await get(notes,'/api/receipt-observations?view=purchase-orders&id='+encodeURIComponent(caseId));data=await res.json();assert.equal(res.status,200);assert.deepEqual(Array.from(data.orders,o=>o.id),['po-domestic']);assert.ok(!JSON.stringify(data).includes('SECRET'));
const complete={id:crypto.randomUUID(),mode:'complete_purchase',confirmed:true,observationId:caseId,revision:1,purchaseOrderId:'po-domestic',purchaseOrderRevision:1,body:'Purchase identified from sourcing evidence'};
user=actor('finance');await post(notes,complete,404);
user=actor('foreign');await post(notes,complete,409);
user=actor('domestic');await post(notes,{...complete,purchaseOrderId:'wrong-material'},409);
const quantityBefore=sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n;
await post(notes,complete);await post(notes,complete);
assert.equal(row(caseId).data.state,'resolved');assert.equal(row(caseId).data.resolution.route,'domestic');assert.equal(row(originalBatch).data.purchaseOrderId,'po-domestic');assert.equal(row(originalBatch).data.state,'awaiting_qc_template');assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n,quantityBefore,'No duplicate stock or new batch');assert.equal(work('foreign',[row(caseId)]).length,0);assert.equal(work('domestic',[row(caseId)]).length,0);
const closed=sql.prepare("SELECT data FROM flow_entities WHERE type='inbox_thread' AND json_extract(data,'$.receiptObservationId')=?").all(caseId).map(r=>JSON.parse(r.data));assert.equal(closed.length,2);assert.ok(closed.every(t=>t.state==='completed'&&t.resolution));
user=actor('foreign');await post(notes,{...complete,id:crypto.randomUUID(),purchaseOrderId:'po-foreign'},409);
user=admin;res=await get(report,'/api/receipt-report?id='+encodeURIComponent(originalBatch));const html=await res.text();assert.equal(res.status,200);assert.ok(html.includes('Local supplier'));assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(!html.includes('SECRET'));assert.ok(!html.includes('PRIVATE-DOC'));assert.ok(html.includes('<svg'));assert.ok(html.includes('رسید ورود کالا به انبار'));
user=actor('finance');assert.equal((await get(report,'/api/receipt-report?id='+encodeURIComponent(originalBatch))).status,403);
// Two submitters read the same case: the second loses atomically, not a last-write-wins update.
user=admin;const race=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'both',warehouseId:wh.id,day:'2026-11-06',quantity:'3'}),raceId=race.quantityObservationId;
const resolve={id:crypto.randomUUID(),mode:'complete_purchase',confirmed:true,observationId:raceId,revision:1,purchaseOrderId:'po-foreign',purchaseOrderRevision:1,body:'Identified foreign purchase'};
beforeBatch=()=>sql.prepare('UPDATE flow_entities SET revision=revision+1 WHERE id=?').run(raceId);
await post(notes,resolve,409);assert.equal(row(race.receiptId).data.purchaseOrderId,'');assert.equal(row(raceId).data.state,'open');assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(resolve.id),undefined);
const next={...resolve,id:crypto.randomUUID(),revision:2};sql.exec("UPDATE reset_control SET phase='maintenance'");await post(notes,next,423);sql.exec("UPDATE reset_control SET phase='testing'");assert.equal(row(race.receiptId).data.purchaseOrderId,'');
await post(notes,next);assert.equal(row(raceId).data.state,'resolved');const followup=row(row(race.receiptId).data.quantityObservationId);assert.equal(followup.data.automatic.kind,'quantity_review');assert.equal(followup.data.state,'open');assert.equal(followup.data.route,'foreign');
console.log('PASS receipt completion: material routes, role accounts, source-backed purchase, one finalizer, replay, concurrent revision rollback, freeze rollback, separate quantity review, unchanged stock, standard private printable receipt and barcode.');
})().catch(e=>{console.error(e);process.exit(1)});
