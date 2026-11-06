const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let barcode;let cookieValues={};let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='@bwip-js/generic')return barcode;if(n==='next/headers')return {cookies:async()=>({get:key=>cookieValues[key]?{value:cookieValues[key]}:undefined})};if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,Headers,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}





const ctx=load('lib/mcp/context.ts').mcpActor,flow=load('app/api/flow/route.ts'),files=load('app/api/receipt-observations/files/route.ts'),notes=load('app/api/receipt-observations/route.ts');
const admin={userId:'owner',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};let user=admin;
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-11-06','2026-11-06');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
const request=(url,body)=>new Request('https://test.local'+url,{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)});
async function post(api,b,status=200){const r=await ctx.run(user,()=>api.POST(request('/api/test',b))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
function employee(id,permissions){sql.prepare("INSERT INTO app_members(id,email,subject,name,unit,status,permissions,created,updated) VALUES(?,?,?,?,'test','active',?,'now','now')").run(id,id+'@test',id,id,JSON.stringify(permissions));}


(async()=>{barcode=await import('@bwip-js/generic');
const wh=require('./helpers/receiving-warehouse.cjs')(sql,{inventorySubjects:['receiver']}),review=load('lib/profile-review.ts'),profiles=load('lib/role-profiles.ts'),queue=load('lib/profile-work.ts');
const field={key:'check',label:'Check',type:'result',required:true};
entity('material:11','material',{code:'11',name:'Oring',unit:'عدد',fields:[field]});
const ws=()=>sql.prepare("SELECT id,data FROM flow_entities WHERE type='material_warehouse'").all().map(r=>({...r,data:JSON.parse(r.data)}));
const central=review.profileSession(admin,'central-store',ws()),quality=review.profileSession(admin,'quality',ws());
assert.ok(!profiles.roleProfiles.find(p=>p.id==='central-store').links.some(l=>l.title==='جانمایی پس از کنترل کیفیت'));
const made=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'material:11',warehouseId:wh.id,day:'2026-11-06',quantity:'4'}),rid=made.receiptId;
assert.equal((await queue.profileWork(central)).work.filter(w=>w.id===rid+':shelve').length,0);assert.equal((await queue.profileWork(central)).pendingQuality,1);assert.ok((await queue.profileWork(quality)).work.some(w=>w.id===rid+':qc'));
const qc={userId:'local:'+wh.qcId,name:'Actual inspector',isAdmin:false,permissions:JSON.parse(sql.prepare('SELECT permissions FROM app_members WHERE id=?').get(wh.qcId).permissions)};
user=qc;await post(flow,{id:crypto.randomUUID(),mode:'incoming_qc',receiptId:rid,accepted:'3',values:{check:'pass'},notes:'One defective'});
assert.ok((await queue.profileWork(central)).work.some(w=>w.id===rid+':shelve'));assert.equal((await queue.profileWork(central)).pendingQuality,0);
const receiver={userId:'receiver',name:'Actual receiver',isAdmin:false,permissions:JSON.parse(sql.prepare("SELECT permissions FROM app_members WHERE subject='receiver'").get().permissions)};
const operation=()=>({id:crypto.randomUUID(),mode:'shelve',receiptId:rid,location:'A-B-C-D',materialRevision:row('material:11').revision,placed:true,confirmed:true});
user=receiver;await post(flow,operation(),409);assert.equal(row(rid).data.state,'awaiting_warehouse');
function address(loc){const m=row('material:11');sql.prepare('UPDATE flow_entities SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify({...m.data,defaultLocations:{[wh.id]:loc}}),m.id)}
address('A-B-C-D');await post(flow,{...operation(),placed:false},400);await post(flow,{...operation(),confirmed:false},400);await post(flow,{...operation(),location:'X-B-C-D'},409);const stale=operation();address('A-B-C-E');await post(flow,stale,409);address('A-B-C-D');
user=qc;await post(flow,operation(),403);user=review.profileSession(admin,'line-store',ws());await post(flow,operation(),403);
user=receiver;const unchanged=row(rid);sql.exec("UPDATE reset_control SET phase='maintenance'");await post(flow,operation(),423);assert.equal(row(rid).revision,unchanged.revision);sql.exec("UPDATE reset_control SET phase='testing'");
beforeBatch=()=>address('A-B-C-E');await post(flow,operation(),409);assert.equal(row(rid).data.state,'awaiting_warehouse');address('A-B-C-D');
const ok=operation();await post(flow,ok);await post(flow,ok);assert.equal(row(rid).data.state,'stored');assert.equal(row(rid).data.placementConfirmation.actor,receiver.userId);assert.equal(row(rid).data.qc.actor,qc.userId);assert.equal(sql.prepare("SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse='raw'").get(rid).quantity,3000);assert.equal(sql.prepare("SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse='quarantine'").get(rid).quantity,1000);assert.ok(!(await queue.profileWork(central)).work.some(w=>w.sourceId===rid));
const tasksApi=load('app/api/tasks/route.ts');user=central;const taskResponse=await ctx.run(user,()=>tasksApi.GET(new Request('https://test.local/api/tasks')));assert.equal(taskResponse.status,200,await taskResponse.clone().text());assert.equal((await taskResponse.json()).profileReview.id,'central-store');
const reportApi=load('app/api/receipt-report/route.ts');user=admin;const report=await ctx.run(user,()=>reportApi.GET(new Request('https://test.local/api/receipt-report?id='+rid)));assert.equal(report.status,200);const html=await report.text();assert.ok(html.includes('width:38mm;height:38mm'));assert.ok(html.includes('<svg'));assert.ok(!html.includes('max-width:160mm'));assert.ok(html.includes(JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get(rid).payload).code));
const tools=load('lib/mcp/tools.ts');const tool=tools.discoverTools().find(t=>t.name==='shelve_approved_batch');assert.ok(tool.inputSchema.properties.placed);assert.ok(tool.inputSchema.properties.materialRevision);
console.log('PASS position process queue: QC gate, no fake tasks, owner-independent scope and closure; ordinary warehouse/QC accounts, master-only address, explicit physical confirmation, stale/racing master, freeze rollback, idempotency, real actor and MCP schema.');
})().catch(e=>{console.error(e);process.exit(1)});
