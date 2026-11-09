const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let cookieValues={};let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='next/headers')return {cookies:async()=>({get:key=>cookieValues[key]?{value:cookieValues[key]}:undefined})};if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,Headers,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}





const ctx=load('lib/mcp/context.ts').mcpActor,flow=load('app/api/flow/route.ts'),files=load('app/api/receipt-observations/files/route.ts'),notes=load('app/api/receipt-observations/route.ts');
const admin={userId:'owner',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};let user=admin;
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-11-06','2026-11-06');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
const request=(url,body)=>new Request('https://test.local'+url,{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)});
async function post(api,b,status=200){const r=await ctx.run(user,()=>api.POST(request('/api/test',b))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
function employee(id,permissions){sql.prepare("INSERT INTO app_members(id,email,subject,name,unit,status,permissions,created,updated) VALUES(?,?,?,?,'test','active',?,'now','now')").run(id,id+'@test',id,id,JSON.stringify(permissions));}

(async()=>{
const fixturePlacement=()=>{const r=row('material:12');sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify({...r.data,defaultLocations:{...(r.data.defaultLocations||{}),[wh.id]:'A-B-C-D'}}),r.id);};

const wh=require('./helpers/receiving-warehouse.cjs')(sql),auth=load('lib/authorization.ts'),review=load('lib/profile-review.ts'),profiles=load('lib/role-profiles.ts'),navigation=load('lib/navigation-access.ts');
entity('line-wh','material_warehouse',{name:'Line',active:true,warehouseType:'production_line',locations:[]});
entity('material:11','material',{code:'11',name:'First',unit:'عدد',fields:[{key:'check',label:'Check',type:'result',required:true}],sourcingRoutes:['domestic']});
entity('material:12','material',{code:'12',name:'Second',unit:'عدد',fields:[{key:'right',label:'Right',type:'result',required:true}],sourcingRoutes:['foreign']});
const profileApi=load('app/api/role-profiles/route.ts');
const ws=()=>sql.prepare("SELECT id,data FROM flow_entities WHERE type='material_warehouse'").all().map(r=>({...r,data:JSON.parse(r.data)}));
entity('scope-buyer-a','sales_agent',{name:'Buyer A',kind:'representative',active:true});
entity('scope-buyer-b','sales_agent',{name:'Buyer B',kind:'representative',active:true});
entity('scope-inactive','sales_agent',{name:'Inactive',kind:'representative',active:false});
for(const profile of profiles.roleProfiles){
 cookieValues[review.profileReviewCookie]=profile.id+(profile.id==='sales-representative'?'~scope-buyer-a':'');const actual=await ctx.run(admin,()=>auth.session());assert.equal(actual.userId,admin.userId);assert.equal(actual.name,admin.name);assert.equal(actual.isAdmin,false,profile.id);assert.equal(actual.profileReview.id,profile.id);assert.ok(!actual.permissions.flowRoles?.includes('qc')||profile.id==='quality',profile.id);assert.ok(!actual.permissions.supplyRoles?.includes('finance')||profile.id==='finance-director',profile.id);await assert.rejects(()=>ctx.run(admin,()=>auth.requireAdmin()),e=>e.status===403);await assert.rejects(()=>ctx.run(admin,()=>auth.requireRealAdmin()),e=>e.status===403);
 const roleResponse=await ctx.run(admin,()=>flow.GET());assert.equal(roleResponse.status,['central-store','line-store','line-manager','quality','technical','domestic','foreign'].includes(profile.id)?200:403,profile.id+' API role scope');
 if(!profile.operational){assert.equal(actual.permissions.read.length,0);assert.equal(actual.permissions.write.length,0);assert.equal(navigation.canOpenSection(actual,'flow'),false);}
}
cookieValues={};
const card=await ctx.run(admin,()=>profileApi.GET(request('/api/role-profiles?profile=sales-representative')));
const cardData=await card.json();assert.equal(card.status,200,JSON.stringify(cardData));assert.equal(cardData.needsBuyer,true);
assert.deepEqual(cardData.buyerChoices.map(b=>b.id),['scope-buyer-a','scope-buyer-b']);
const repProfile=review.profileSession(admin,'sales-representative',ws(),'scope-buyer-a'),hospitalProfile=review.profileSession(admin,'hospital-sales',ws(),'scope-buyer-a');
const salesView=load('lib/sales.ts');
assert.equal(repProfile.userId,admin.userId);assert.equal(repProfile.permissions.salesAgentId,'scope-buyer-a');assert.equal(navigation.canOpenSection(repProfile,'sales-returns'),true);
assert.equal(navigation.canOpenSection(repProfile,'build-intake'),false);
assert.equal(navigation.canOpenSection(hospitalProfile,'build-intake'),true);
assert.equal(await salesView.salesVisible(hospitalProfile,row('scope-buyer-a')),true);assert.equal(await salesView.salesVisible(hospitalProfile,row('scope-buyer-b')),false);
for(const buyerId of ['scope-inactive']){const r=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',{id:crypto.randomUUID(),mode:'select_profile',profileId:'sales-representative',buyerId,confirmed:true})));assert.equal(r.status,400);}
const unscoped=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',{id:crypto.randomUUID(),mode:'select_profile',profileId:'sales-representative',buyerId:'',confirmed:true})));
assert.equal(unscoped.status,200);assert.match(unscoped.headers.get('set-cookie'),/sales-representative;/);
cookieValues[review.profileReviewCookie]='sales-representative';
const shell=await ctx.run(admin,()=>auth.session());
assert.equal(shell.isAdmin,false);assert.equal(shell.profileReview.id,'sales-representative');
assert.equal(navigation.canOpenSection(shell,'sales'),false);assert.equal(navigation.canOpenSection(shell,'tasks'),false);
await assert.rejects(()=>ctx.run(admin,()=>auth.requireAccess()),e=>e.status===403);
const shellCard=await ctx.run(admin,()=>profileApi.GET(request('/api/role-profiles?profile=sales-representative')));
const shellData=await shellCard.json();assert.equal(shellData.activeProfile,'sales-representative');assert.equal(shellData.needsBuyer,true);assert.deepEqual(shellData.work,[]);
cookieValues={};
const selectedRepresentative=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',{id:crypto.randomUUID(),mode:'select_profile',profileId:'sales-representative',buyerId:'scope-buyer-a',confirmed:true})));
assert.equal(selectedRepresentative.status,200);assert.match(selectedRepresentative.headers.get('set-cookie'),/sales-representative~scope-buyer-a/);
entity('preview-mission','transport',{code:'TR-PREVIEW',state:'assigned',driverId:'driver-real',kind:'purchase_order',items:[],history:[]});
entity('another-mission','transport',{code:'TR-OTHER',state:'assigned',driverId:'driver-other',kind:'sale',items:[],history:[]});
const driverView=review.profileSession(admin,'driver',ws(),'preview-mission'),transport=load('lib/transport.ts');
assert.equal(driverView.userId,admin.userId);
assert.equal(await transport.transportCanSee(driverView,row('preview-mission')),true);
assert.equal(await transport.transportCanSee(driverView,row('another-mission')),false);
assert.equal(await transport.transportCanSee(review.profileSession(admin,'driver',ws()),row('preview-mission')),false);
const driverWork=await load('lib/profile-work.ts').profileWork(driverView);
assert.ok(driverWork.work.some(x=>x.sourceId==='preview-mission'));assert.ok(!driverWork.work.some(x=>x.sourceId==='another-mission'));
const transportApi=load('app/api/transport/route.ts');
const forbiddenDriverWrite=await ctx.run(driverView,()=>transportApi.POST(request('/api/transport',{mode:'checklist',missionId:'preview-mission'})));
assert.equal(forbiddenDriverWrite.status,403);
cookieValues[review.profileReviewCookie]='bad-profile';await assert.rejects(()=>ctx.run(admin,()=>auth.session()),e=>e.status===403);cookieValues={};
const central=review.profileSession(admin,'central-store',ws()),quality=review.profileSession(admin,'quality',ws()),line=review.profileSession(admin,'line-store',ws());
assert.ok(central.permissions.warehouseResponsibilities.some(r=>r.warehouseId===wh.id));assert.ok(!central.permissions.warehouseResponsibilities.some(r=>r.warehouseId==='line-wh'));assert.deepEqual(Array.from(line.permissions.warehouseResponsibilities,r=>r.warehouseId),['line-wh']);
user=central;const receipt=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'material:11',warehouseId:wh.id,quantity:'3',day:'2026-11-06'}),rid=receipt.receiptId;
let presented=await ctx.run(central,()=>flow.GET());let data=await presented.json();assert.ok(!data.roles.includes('qc'));assert.ok(data.roles.includes('inventory'));assert.equal(data.entities.find(e=>e.id===rid).data.canInspect,false);
const initial=JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get(rid).payload).code;
const edit={id:crypto.randomUUID(),mode:'edit_receipt',confirmed:true,receiptId:rid,revision:row(rid).revision,materialId:'material:11',quantity:'4',day:'2026-11-05',expiry:'2027-01-01',notes:'Recounted before inspection',receiptNote:'Box was damaged',deliveryClue:{driverName:'Driver',originName:'Origin'}};
user=quality;await post(flow,edit,403);user=line;await post(flow,edit,403);user=central;await post(flow,{...edit,revision:0},409);await post(flow,edit);await post(flow,edit);
let r=row(rid),batch=JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get(rid).payload);assert.equal(r.data.quantity,4000);assert.equal(batch.quantity,'4');assert.equal(batch.date,'2026-11-05');assert.equal(batch.expiry,'2027-01-01');assert.notEqual(batch.code,initial);assert.equal(r.data.identityHistory[0].actor,admin.userId);assert.equal(r.data.deliveryClue.driverName,'Driver');assert.equal(sql.prepare("SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse='quarantine'").get(rid).quantity,4000);await assert.rejects(()=>load('lib/batch-public-label.ts').publicBatchLabel(initial),e=>e.status===410);
const noQc={id:crypto.randomUUID(),mode:'correct_receipt_material',confirmed:true,receiptId:rid,materialId:'material:12',notes:'Wrong identity'};await post(flow,noQc,403);
user=quality;const start=await post(flow,{id:crypto.randomUUID(),mode:'start_incoming_qc',receiptId:rid,revision:r.revision});assert.equal(row(rid).data.qcStartedBy,admin.userId);user=central;await post(flow,{...edit,id:crypto.randomUUID(),revision:row(rid).revision},409);
const before=sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n;const late=await post(flow,{id:crypto.randomUUID(),mode:'request_receipt_edit',confirmed:true,receiptId:rid,notes:'Please review the already started inspection'});assert.equal(late.editRequested,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n,before);const reviewRequest=row(row(rid).data.editRequests[0].id);await assert.rejects(()=>load('lib/receipt-observations.ts').receiptObservationAccess(review.profileSession(admin,'technical',ws()),reviewRequest.id),e=>e.status===404);assert.equal(reviewRequest.data.reviewKind,'receipt_edit');assert.ok(profiles.materialProfileWork('quality',[reviewRequest]).length);assert.ok(profiles.materialProfileWork('central-store',[reviewRequest]).length);
user=quality;await post(notes,{id:crypto.randomUUID(),mode:'respond',confirmed:true,observationId:reviewRequest.id,revision:reviewRequest.revision,body:'Reviewed; no quantity or quality override',resolve:true});assert.equal(row(reviewRequest.id).data.state,'resolved');assert.equal(profiles.materialProfileWork('quality',[row(reviewRequest.id)]).length,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n,before);
user=quality;await post(flow,{id:crypto.randomUUID(),mode:'incoming_qc',receiptId:rid,revision:start.revision,accepted:'4',values:{check:'pass'},notes:'Stale inspection'},409);
await post(flow,noQc);r=row(rid);await post(flow,{id:crypto.randomUUID(),mode:'incoming_qc',receiptId:rid,revision:r.revision,accepted:'4',values:{right:'pass'},notes:'Corrected material inspected'});assert.equal(row(rid).data.state,'awaiting_relabel');assert.equal(row(rid).data.qc.actor,admin.userId);
user=central;batch=JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get(rid).payload);await post(flow,{id:crypto.randomUUID(),mode:'confirm_receipt_relabel',confirmed:true,receiptId:rid,labelsReplaced:true,scannedCode:batch.code});assert.equal(row(rid).data.state,'awaiting_warehouse');fixturePlacement();await post(flow,{id:crypto.randomUUID(),mode:'shelve',receiptId:rid,location:'A-B-C-D',materialRevision:row('material:12').revision,placed:true,confirmed:true});assert.equal(row(rid).data.state,'stored');await post(flow,{...edit,id:crypto.randomUUID(),revision:row(rid).revision},409);
// HTTP selection remains administrator-only and exits to the real actor, without creating people.
user={userId:'external',name:'Ordinary',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};await post(profileApi,{id:crypto.randomUUID(),mode:'select_profile',profileId:'quality',confirmed:true},403);cookieValues[review.profileReviewCookie]='quality';assert.equal((await ctx.run(user,()=>auth.session())).profileReview,undefined);cookieValues={};user=admin;let res=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',{id:crypto.randomUUID(),mode:'select_profile',profileId:'quality',confirmed:true})));assert.equal(res.status,200);assert.ok(res.headers.get('set-cookie').includes('HttpOnly'));assert.equal(sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,1);
const tools=load('lib/mcp/tools.ts'),principal={user:admin,scope:'read_write',tokenId:'test-role'};const read=await tools.executeTool('execute_role_profile_action',{profileId:'quality',toolName:'get_material_flow',arguments:{},confirmed:true},'https://test.local',principal);assert.ok(read.roles.includes('qc'));assert.ok(!read.roles.includes('inventory'));
await assert.rejects(()=>tools.executeTool('execute_role_profile_action',{profileId:'technical',toolName:'edit_incoming_receipt',arguments:Object.fromEntries(Object.entries({...edit,id:crypto.randomUUID()}).filter(([key])=>key!=='mode')),confirmed:true},'https://test.local',principal),e=>e.status===403);
// Same-material recount retains its purchase and conserves plan coverage when reducing/increasing quantity.
user=central;entity('test-plan','sourcing_plan',{state:'sourcing',needBy:'2026-12-01'});entity('test-po','purchase_order',{materialId:'material:11',partCode:'11',unit:'عدد',quantity:5000,supplier:'Supplier',route:'domestic',state:'issued'});sql.prepare('INSERT INTO sourcing_holds(id,plan_id,part_code,unit,source_type,source_id,quantity) VALUES(?,?,?,?,?,?,?)').run('test-claim','test-plan','11','عدد','po','test-po',5000);
const linked=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'material:11',warehouseId:wh.id,quantity:'3',day:'2026-11-06',purchaseOrderId:'test-po'});let linkedRevision=row(linked.receiptId).revision;
await post(flow,{...edit,id:crypto.randomUUID(),receiptId:linked.receiptId,revision:linkedRevision,quantity:'2'});assert.equal(row(linked.receiptId).data.purchaseOrderId,'test-po');assert.equal(sql.prepare("SELECT SUM(quantity) n FROM sourcing_holds WHERE source_type='receipt' AND source_id=?").get(linked.receiptId).n,2000);assert.equal(sql.prepare("SELECT SUM(quantity) n FROM sourcing_holds WHERE source_type='po' AND source_id='test-po'").get().n,3000);
await post(flow,{...edit,id:crypto.randomUUID(),receiptId:linked.receiptId,revision:row(linked.receiptId).revision,quantity:'4'});assert.equal(sql.prepare("SELECT SUM(quantity) n FROM sourcing_holds WHERE source_type='receipt' AND source_id=?").get(linked.receiptId).n,4000);assert.equal(sql.prepare("SELECT SUM(quantity) n FROM sourcing_holds WHERE source_type='po' AND source_id='test-po'").get().n,1000);
// Starting QC in another request races an open warehouse draft: rollback includes label and stock.
const raceOld=row(linked.receiptId),raceBatch=sql.prepare('SELECT payload FROM records WHERE id=?').get(linked.receiptId).payload;beforeBatch=()=>sql.prepare("UPDATE flow_entities SET revision=revision+1,data=json_set(data,'$.qcStartedAt','concurrent') WHERE id=?").run(linked.receiptId);await post(flow,{...edit,id:crypto.randomUUID(),receiptId:linked.receiptId,revision:raceOld.revision,quantity:'5'},409);assert.equal(sql.prepare('SELECT payload FROM records WHERE id=?').get(linked.receiptId).payload,raceBatch);assert.equal(row(linked.receiptId).data.quantity,4000);
// Freeze applies to every edit and requests without partial state changes.
user=admin;const fresh=await post(flow,{id:crypto.randomUUID(),mode:'receipt',receiptVersion:2,confirmed:true,materialId:'material:11',warehouseId:wh.id,quantity:'2',day:'2026-11-06'});const old=row(fresh.receiptId);sql.exec("UPDATE reset_control SET phase='maintenance'");await post(flow,{...edit,id:crypto.randomUUID(),receiptId:fresh.receiptId,revision:old.revision},423);assert.equal(row(fresh.receiptId).data.quantity,2000);sql.exec("UPDATE reset_control SET phase='testing'");
console.log('PASS all profile permission masks and real-actor sessions; stock/QC separation; scoped warehouse edit, retired labels, QC-start locks, stale revisions, review requests, correction/relabel/shelving and reset freeze.');
})().catch(e=>{console.error(e);process.exit(1)});
