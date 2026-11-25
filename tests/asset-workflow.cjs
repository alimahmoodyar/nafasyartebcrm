const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}


const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/personnel/route.ts'),files=load('app/api/personnel/files/route.ts'),domain=load('lib/personnel.ts'),catalog=load('lib/mcp/tools.ts'),tasks=load('app/api/tasks/route.ts'),duties=load('lib/duties.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next};
const base='https://test.local',now=new Date().toISOString(),today=duties.dayAt(),day=duties.addDay(today,-10),next=duties.addDay(today,2);
const req=(url,b,origin=base)=>new Request(base+url,{method:b?'POST':'GET',headers:{origin,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});
function actor(id,roles=[],extra={}){const u={userId:'local:'+id,email:id+'@test.local',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],personnelRoles:roles,...extra}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'company','active',?,?,?,?)").run(id,u.email,id,u.userId,JSON.stringify(u.permissions),now,now);return u;}

const assets=load('app/api/assets/route.ts'),afiles=load('app/api/assets/files/route.ts'),ad=load('lib/assets.ts'),sync=load('lib/assets-tasks.ts');
const owner={userId:'owner',email:'owner@example.com',name:'owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions},keeper=actor('keeper',[],{assetRoles:['custodian']}),alice=actor('alice'),bob=actor('bob'),hr=actor('hr',['hr']),external=actor('external',[],{salesAgentId:'outside',salesRoles:['agent']});
const entity=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
async function get(u){const r=await ctx.run(u,()=>assets.GET());return {status:r.status,data:await r.json()}}
async function post(u,b){const body={id:crypto.randomUUID(),confirmed:true,revision:0,notes:'Actual test evidence',...b};if(body.mode==='register'&&(u.isAdmin||u.permissions.assetRoles?.includes('custodian'))&&!body.photoFileIds)body.photoFileIds=[require('./asset-photo-fixture.cjs')(sql,u,body.id,objects)];const r=await ctx.run(u,()=>assets.POST(req('/api/assets',body)));return {status:r.status,data:await r.json()}}
const reg={mode:'register',code:'A-001',name:'قالب تزریق',category:'قالب',brand:'brand',model:'model',serial:'serial',specifications:'steel 2 cavities',condition:'good',location:'انبار شرکت',day:today,reference:'receipt-001'};
const transfer=(id,revision,kind='employee',extra={})=>({mode:'transfer',recordId:id,revision,holderKind:kind,holderId:'alice',holderName:'Contractor',contractorCode:'C-1',location:'Factory',condition:'good',day:today,reference:'handover-001',...extra});

const wf=load('app/api/assets/workflow/route.ts'),wdom=load('lib/asset-workflow.ts'),qr=load('lib/asset-label.ts'),scanApi=load('app/api/workflow-scan/route.ts'),links=load('lib/asset-links.ts');
const stranger=actor('stranger'),tech=actor('tech',[],{supplyRoles:['engineering']}),ceo=actor('ceo',[],{supplyRoles:['ceo']}),delegate=actor('delegate',[],{assetRoles:['disposal']});
async function step(u,id,mode,extra={}){const r=entity(id),body={id:crypto.randomUUID(),confirmed:true,recordId:id,revision:r?.revision||0,mode,notes:'Actual test evidence',...extra};const response=await ctx.run(u,()=>wf.POST(req('/api/assets/workflow',body)));return {status:response.status,data:await response.json(),body};}
async function wfget(u,q=''){const r=await ctx.run(u,()=>wf.GET(req('/api/assets/workflow'+q)));return {status:r.status,data:await r.json()};}
function seed(id,type,data){sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);}
(async()=>{
const mistaken=await post(keeper,{...reg,name:'Duplicate unused asset',category:'office',assetKind:'office'});assert.equal(mistaken.status,200);
const mistakenId=mistaken.data.id,mistakenCode=entity(mistakenId).data.code;
assert.ok(!(await wfget(keeper,'?id='+mistakenId)).data.actions.includes('archive_mistake'));
assert.equal((await step(keeper,mistakenId,'archive_mistake')).status,403);
assert.ok((await wfget(owner,'?id='+mistakenId)).data.actions.includes('archive_mistake'));
assert.equal((await step(owner,mistakenId,'archive_mistake',{revision:0})).status,409);
const archived=await step(owner,mistakenId,'archive_mistake');assert.equal(archived.status,200,JSON.stringify(archived));
assert.equal(entity(mistakenId).type,'asset_archived');assert.equal(entity(mistakenId).data.code,mistakenCode);
assert.equal(entity(mistakenId).data.archiveReason,'Actual test evidence');
assert.ok(!(await wfget(owner)).data.records.some(item=>item.id===mistakenId));
assert.equal((await ctx.run(owner,()=>wf.POST(req('/api/assets/workflow',archived.body)))).status,200);
let r=await post(keeper,{...reg,code:'OFFICE',name:'Chair',category:'office',assetKind:'office'});assert.equal(r.status,200);const id=r.data.id;
assert.notEqual(entity(id).data.code,mistakenCode);
assert.equal((await step(keeper,id,'group',{name:'office',controlled:false})).status,200);
assert.equal((await step(keeper,id,'passport',{category:'office',assetKind:'office',technicalId:'tech'})).status,200);
assert.equal((await step(keeper,id,'transfer',{holderKind:'employee',holderId:'alice',location:'desk',condition:'good'})).status,200);
assert.equal((await step(owner,id,'archive_mistake')).status,409,'An open custody transfer must remain intact.');
assert.equal(entity(id).data.holderKind,'stock','request never changes custody');
assert.equal((await step(bob,id,'accept_transfer',{scan:qr.assetQrText(id),condition:'good'})).status,404);
assert.equal((await step(alice,id,'accept_transfer',{scan:'NAFASYAR-ASSET/1:'+crypto.randomUUID(),condition:'good'})).status,400);
let accept=await step(alice,id,'accept_transfer',{scan:qr.assetQrText(id),condition:'damaged'});assert.equal(accept.status,200,JSON.stringify(accept));assert.equal(entity(id).data.holderId,'alice');assert.equal(entity(id).data.issue.id,accept.body.id);assert.ok(sql.prepare("SELECT id FROM duty_runs WHERE template_id='asset-workflow' AND json_extract(data,'$.stage')=? AND state='open'").get('fault:'+accept.body.id),'damage creates a uniquely actionable task');
let again=await ctx.run(alice,()=>wf.POST(req('/api/assets/workflow',accept.body)));assert.equal(again.status,200);assert.equal((await again.json()).repeated,true);
assert.equal((await step(alice,id,'transfer',{holderKind:'employee',holderId:'bob',location:'desk2',condition:'good'})).status,200);
assert.equal((await step(alice,id,'transfer',{holderKind:'employee',holderId:'keeper',location:'desk3',condition:'good'})).status,409);
assert.equal((await step(bob,id,'reject_transfer')).status,200);assert.equal(entity(id).data.holderId,'alice');
assert.equal((await step(alice,id,'transfer',{holderKind:'employee',holderId:'bob',location:'desk2',condition:'good'})).status,200);
const rev=entity(id).revision,b1={id:crypto.randomUUID(),confirmed:true,recordId:id,revision:rev,mode:'accept_transfer',scan:qr.assetQrText(id),condition:'good',notes:'received'};
const concurrent=await Promise.all([ctx.run(bob,()=>wf.POST(req('/api/assets/workflow',b1))),ctx.run(bob,()=>wf.POST(req('/api/assets/workflow',{...b1,id:crypto.randomUUID()})))]);assert.equal(concurrent.filter(r=>r.status===200).length,1);assert.equal(entity(id).data.holderId,'bob');
assert.equal((await step(bob,id,'report_fault',{danger:true})).status,200);assert.equal(entity(id).data.useState,'stopped');assert.equal((await step(keeper,id,'service_approve',{approved:true})).status,403);assert.equal((await step(tech,id,'service_approve',{approved:true})).status,200);assert.equal(entity(id).data.useState,'available');
assert.equal((await step(tech,id,'service_plan',{days:30,hours:10,cycles:100,executorId:'alice',checklist:'inspect',blockWhenDue:true})).status,200);
assert.equal((await step(alice,id,'service_start')).status,200);assert.equal((await step(alice,id,'service_report',{report:'actual maintenance',parts:'none',cost:'100'})).status,200);assert.equal((await step(alice,id,'service_approve',{approved:true})).status,403);assert.equal((await step(tech,id,'service_approve',{approved:true})).status,200);
assert.equal((await step(bob,id,'meter',{unit:'hours',value:15})).status,200);assert.equal((await step(bob,id,'meter',{unit:'hours',value:1})).status,403);assert.equal((await wfget(bob,'?id='+id)).data.records[0].data.useState,'stopped','overdue safety derives from current counters');
assert.equal((await wfget(alice)).data.records.length,1,'assigned service executor retains scoped work');assert.ok(!(await wfget(alice,'?id='+id)).data.actions.includes('transfer')); assert.equal((await wfget(bob)).data.records.length,1);
assert.equal((await wfget(keeper,'?view=mine')).data.records.length,0,'personal keeper view must not list the whole company');assert.equal((await wfget(alice,'?view=mine')).data.records.length,0,'technical assignments are not personal custody');assert.equal((await wfget(hr,'?owner=bob')).data.records.length,1);assert.equal((await wfget(alice,'?owner=bob')).status,403);
const opts=await wfget(keeper,'?choices=');assert.ok(opts.data.choices.products);const externalOpts=await wfget(external,'?choices=');assert.equal(externalOpts.data.choices.products,undefined,'external custody never grants internal catalog lookup');
// Same QR resolves only authorized current work, without writes.
const before=sql.prepare('SELECT SUM(revision) n FROM flow_entities').get().n;let sr=await ctx.run(bob,()=>scanApi.GET(req('/api/workflow-scan?code='+encodeURIComponent(qr.assetQrText(id)))));assert.equal(sr.status,200);assert.equal((await sr.json()).actions[0].kind,'asset');assert.equal(sql.prepare('SELECT SUM(revision) n FROM flow_entities').get().n,before);
assert.equal((await ctx.run(stranger,()=>scanApi.GET(req('/api/workflow-scan?code='+encodeURIComponent(qr.assetQrText(id)))))).status,404);
// Controlled transfer requires custodian permission, and external custody requires signed-receipt follow-up.
assert.equal((await step(keeper,id,'group',{name:'molds',controlled:true})).status,200);assert.equal((await step(keeper,id,'passport',{category:'molds',assetKind:'mold',technicalId:'tech',cavities:4})).status,200);
assert.equal((await step(bob,id,'transfer',{holderKind:'contractor',holderId:'C1',holderName:'Contractor',mobile:'09123456789',location:'factory',condition:'good'})).status,200);assert.equal(entity(id).data.pending.state,'awaiting_approval');assert.equal((await step(bob,id,'approve_transfer')).status,403);assert.equal((await step(keeper,id,'approve_transfer')).status,200);
const link=await links.createAssetLink(keeper,{confirmed:true,assetIds:[id],kind:'handover'},base);assert.ok(link.url.includes('#'));const token=link.url.split('#')[1];
await assert.rejects(()=>links.useAssetLink({token,mode:'scan',scan:qr.assetQrText(id)}),/موبایل/);await assert.rejects(()=>links.useAssetLink({token,mode:'challenge'}),/تنظیم/);
const lr=await wdom.assetRow(link.id);assert.ok(!JSON.stringify(lr.data).includes(token),'token is stored only as lookup hash');
// Simulate verified provider challenge only in isolated fixture; all production confirmation guards still execute.
const session='a'.repeat(64),sessionHash=require('node:crypto').createHash('sha256').update(session).digest('hex');lr.data.sessionHash=sessionHash;lr.data.sessionExpires=new Date(Date.now()+600000).toISOString();sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify(lr.data),lr.id);
const confirmed=await links.useAssetLink({token,session,mode:'confirm',confirmed:true,signer:'Actual contractor tester',items:[{scan:qr.assetQrText(id),condition:'good'}]});assert.equal(confirmed.saved,true);assert.equal(entity(id).data.holderKind,'contractor');assert.equal(entity(id).data.signatureRequired,true);assert.equal(entity(id).data.signedReceiptId,'');await assert.rejects(()=>links.useAssetLink({token,session,mode:'confirm',confirmed:true,signer:'replay',items:[{scan:qr.assetQrText(id),condition:'good'}]}),/تکمیل/);
// Agent custody is scoped to exact current representative, not a shared global list.
seed('outside','sales_agent',{name:'Representative',active:true,mobile:'09123456789'});assert.equal((await step(keeper,id,'transfer',{holderKind:'sales',holderId:'outside',location:'agency',condition:'good'})).status,200);assert.equal((await step(keeper,id,'approve_transfer')).status,200);assert.equal((await step(external,id,'accept_transfer',{scan:qr.assetQrText(id),condition:'good'})).status,200);assert.equal((await wfget(external)).data.records.length,1);assert.equal((await step(external,id,'service_approve',{approved:true})).status,403);
assert.equal((await step(tech,id,'service_start',{performerKind:'contractor',contractorCode:'REPAIR-C',contractorName:'Actual repair contractor'})).status,200);assert.equal(entity(id).data.service.performerName,'Actual repair contractor');assert.equal(entity(id).data.service.recorder,tech.userId);
// CEO delegation grants only the selected current job role and can be revoked.
const delegatedRole=actor('role-holder',['hr'],{roleAssignment:{roles:['personnel_hr']}});assert.equal((await step(ceo,id,'delegate_disposal',{roleId:'personnel_hr'})).status,200);assert.equal((await wdom.assetIdentity(delegatedRole)).disposal,true);assert.equal((await step(ceo,id,'delegate_disposal',{roleId:''})).status,200);assert.equal((await wdom.assetIdentity(delegatedRole)).disposal,false);
// Exit is a separate CEO/delegated authority and scrap needs technical opinion.
assert.equal((await step(keeper,id,'disposal_request',{reason:'scrap'})).status,200);assert.equal((await step(keeper,id,'disposal_approve',{approved:true,reference:'decision'})).status,403);assert.equal((await step(ceo,id,'disposal_approve',{approved:true,reference:'decision'})).status,400);assert.equal((await step(tech,id,'technical_opinion')).status,200);assert.equal((await step(delegate,id,'disposal_approve',{approved:true,reference:'decision'})).status,200);assert.equal(entity(id).data.lifecycle,'disposed');assert.equal(entity(id).data.financeFollowup.state,'open');assert.equal((await step(external,id,'transfer',{holderKind:'employee',holderId:'alice',location:'HQ',condition:'good'})).status,409);
// Employee asset requests remain tied to the actual holder and go to the right cartable.
const requestAsset='asset-employee-request-test',custody='custody-test';
seed(requestAsset,'asset_item',{code:'A-REQUEST',name:'Test device',brand:'Old',category:'office',assetKind:'office',condition:'good',location:'HQ',holderKind:'employee',holderId:'alice',holderName:'alice',custodyId:custody,technicalId:'tech'});
const request=(user,mode,kind,extra={})=>step(user,requestAsset,'employee_request'+(mode?'_'+mode:''),{requestKind:kind,...extra});
const assetData=()=>entity(requestAsset).data;
const version=kind=>({requestId:assetData().employeeRequests[kind].id,requestVersion:assetData().employeeRequests[kind].version});
const work=(assignee,stage,role)=>sql.prepare("SELECT id FROM duty_runs WHERE template_id='asset-workflow' AND assignee=? AND state='open' AND json_extract(data,'$.sourceId')=? AND json_extract(data,'$.stage')=? AND json_extract(data,'$.cartableRole')=?").get(assignee,requestAsset,stage,role);
assert.equal((await request(alice,'','repair',{notes:' '})).status,400);
assert.ok((await request(bob,'','repair')).status>=400);
const operation=crypto.randomUUID(),photoId=crypto.randomUUID();
const photoQuery=new URLSearchParams({id:photoId,assetId:requestAsset,revision:String(entity(requestAsset).revision),filename:'issue.png',purpose:'employee_request',requestOperationId:operation,confirmed:'true'});
const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOakAAAAASUVORK5CYII=','base64');
const upload=user=>ctx.run(user,()=>afiles.POST(new Request('https://test.local/api/assets/files?'+photoQuery,{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/octet-stream'},body:photo})));
assert.ok((await upload(bob)).status>=400);
const uploaded=await upload(alice);
assert.equal(uploaded.status,200,await uploaded.clone().text());
assert.equal((await request(alice,'','repair',{fileId:photoId})).status,403);
const repair=await request(alice,'','repair',{id:operation,fileId:photoId,notes:'Power does not start'});
assert.equal(assetData().employeeRequests?.repair?.photoId,photoId);
const viewPhoto=user=>ctx.run(user,()=>afiles.GET(req('/api/assets/files?id='+photoId+'&view=preview')));
assert.equal((await viewPhoto(keeper)).status,200);
assert.equal((await viewPhoto(alice)).status,200);
assert.equal((await viewPhoto(tech)).status,404);
assert.equal(repair.status,200,JSON.stringify(repair));
assert.equal(assetData().issue,undefined);
assert.ok(work('keeper','employee-request:'+repair.body.id,'custodian'));
assert.equal((await request(alice,'','repair')).status,409);
const returned=await request(keeper,'review','repair',{...version('repair'),decision:'return',notes:'Include the symptoms'});
assert.equal(returned.status,200,JSON.stringify(returned));
assert.ok(work('alice','employee-request:'+returned.body.id,'personal'));
assert.equal((await request(alice,'resubmit','repair',{requestId:repair.body.id,requestVersion:repair.body.id})).status,409);
assert.equal((await request(alice,'resubmit','repair',{...version('repair'),notes:'Power light blinks'})).status,200);
assert.equal((await request(keeper,'review','repair',{...version('repair'),decision:'approve'})).status,200);
assert.equal(assetData().issue.employeeRequestId,repair.body.id);
assert.ok(work('tech','fault:'+repair.body.id,'personal'));
assert.equal((await step(tech,requestAsset,'service_start')).status,200);
assert.equal((await step(tech,requestAsset,'service_report',{report:'fixed',parts:'none',cost:'0'})).status,200);
assert.equal((await step(tech,requestAsset,'service_approve',{approved:true})).status,200);
assert.equal(assetData().employeeRequests.repair.state,'repair_done');
assert.ok(work('alice','employee-request:'+version('repair').requestVersion,'personal'));
assert.equal((await request(alice,'seen','repair',{...version('repair'),notes:''})).status,200);
assert.equal(assetData().employeeRequests.repair.seen,true);
assert.equal((await request(alice,'','edit',{notes:'Brand was entered incorrectly'})).status,200);
assert.equal((await request(keeper,'review','edit',{...version('edit'),decision:'approve',fields:['code']})).status,400);
assert.equal((await request(keeper,'review','edit',{...version('edit'),decision:'approve',fields:['brand']})).status,200);
assert.equal((await request(alice,'edit','edit',{...version('edit'),changes:{brand:'New',code:'changed'}})).status,400);
assert.equal((await request(alice,'edit','edit',{...version('edit'),changes:{brand:'New'}})).status,200);
assert.equal(assetData().brand,'Old');
assert.equal(assetData().employeeRequests.edit.notes,'Brand was entered incorrectly');
assert.equal((await wfget(tech,'?id='+requestAsset)).data.records[0].data.employeeRequests,undefined);
assert.equal((await request(keeper,'finalize','edit',{...version('edit'),decision:'approve'})).status,200);
assert.equal(assetData().brand,'New');
assert.equal(assetData().code,'A-REQUEST');
assert.equal(assetData().custodyId,custody);
// No reset/freeze bypass from new asset writes.
sql.prepare("UPDATE reset_control SET phase='maintenance' WHERE id=1").run();const blocked=await step(keeper,id,'group',{name:'frozen',controlled:false});assert.ok(blocked.status>=400);assert.equal(entity('asset-group:frozen'),null);
console.log('PASS asset workflow: two-party custody, exact scan, duplicate and concurrent acceptance, role/representative isolation, dangerous-stop authority, service execution/review, counters, controlled transfer, scoped mobile link and replay, signed-receipt obligation, delegated disposal and freeze rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
