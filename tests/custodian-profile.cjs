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
 const auth=load('lib/authorization.ts'),review=load('lib/profile-review.ts'),profiles=load('lib/role-profiles.ts'),profileApi=load('app/api/role-profiles/route.ts'),assets=load('app/api/assets/route.ts'),workflow=load('app/api/assets/workflow/route.ts'),tasks=load('app/api/tasks/route.ts'),catalog=load('lib/mcp/tools.ts'),navigation=load('lib/navigation-access.ts');
 const get=async(api,url,actor=admin,status=200)=>{const r=await ctx.run(actor,()=>api.GET(new Request('https://test.local'+url))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const list=await get(profileApi,'/api/role-profiles');const entries=list.profiles.filter(p=>p.id==='custodian');assert.equal(entries.length,1);assert.equal(entries[0].title,'اموال‌دار');assert.equal(entries[0].operational,true);assert.ok(entries[0].links.some(l=>l.section==='assets'));
 const select={id:crypto.randomUUID(),confirmed:true,mode:'select_profile',profileId:'custodian'};
 const selected=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',select)));assert.equal(selected.status,200);
 cookieValues[review.profileReviewCookie]='custodian';
 const position=await ctx.run(admin,()=>auth.session());assert.equal(position.userId,'owner');assert.equal(position.name,'Owner');assert.equal(position.isAdmin,false);assert.deepEqual(Array.from(position.permissions.assetRoles),['custodian']);assert.ok(navigation.canOpenSection(position,'assets'));assert.ok(!navigation.canOpenSection(position,'users'));assert.ok(!position.permissions.supplyRoles?.includes('ceo'));assert.ok(!position.permissions.assetRoles?.includes('disposal'));
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,0,'Review must work without a fabricated employee');
 const today=load('lib/duties.ts').dayAt(),id=crypto.randomUUID();
 await post(assets,{id,confirmed:true,mode:'register',revision:0,code:'AS-PROFILE-1',name:'Profile machine',category:'Production',assetKind:'machine',condition:'good',location:'Company',reference:'Synthetic registration',day:today,notes:'Register through existing form'});
 assert.equal(row(id).data.holderKind,'stock');assert.equal(sql.prepare('SELECT actor FROM access_audit WHERE id=?').get(id).actor,'owner');assert.equal(sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,0);
 const page=await get(workflow,'/api/assets/workflow?id='+id);assert.equal(page.custodian,true);assert.ok(page.actions.includes('transfer'));assert.ok(!page.actions.includes('disposal_approve'));
 const scan=await get(load('app/api/workflow-scan/route.ts'),'/api/workflow-scan?code='+encodeURIComponent('NAFASYAR-ASSET/1:'+id));
 assert.equal(scan.kind,'asset');assert.equal(scan.actions[0].target,id);assert.equal(row(id).data.holderKind,'stock','Scanning only opens authorized existing work');
 employee('receiver',{read:[],write:[],eventStages:[]});
 const transfer=crypto.randomUUID();await post(workflow,{id:transfer,recordId:id,revision:row(id).revision,mode:'transfer',confirmed:true,holderKind:'employee',holderId:'receiver',condition:'good',location:'Workplace',notes:'Controlled handover request'});
 assert.equal(row(id).data.pending.state,'awaiting_approval');assert.equal(row(id).data.holderKind,'stock','Request does not change custody');
 const operations=sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;
 const card=await get(profileApi,'/api/role-profiles?profile=custodian');assert.ok(card.work.some(w=>w.sourceId===id&&w.title.includes('مجوز انتقال')&&w.target===id&&w.section==='assets'));
 const inbox=await get(tasks,'/api/tasks');assert.ok(inbox.positionWork.some(w=>w.sourceId===id&&w.target===id));assert.equal(inbox.profileReview.id,'custodian');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,operations,'Role/card reads do not write asset operations');
 const readContext={user:admin,scope:'read',tokenId:null};const mcp=await ctx.run(admin,()=>catalog.executeTool('get_role_profiles',{profile:'custodian'},'https://test.local',readContext));assert.ok(mcp.work.some(w=>w.sourceId===id));
 const mcpInbox=await ctx.run(admin,()=>catalog.executeTool('get_task_inbox',{},'https://test.local',readContext));assert.ok(mcpInbox.positionWork.some(w=>w.sourceId===id));
 const approved=crypto.randomUUID();await post(workflow,{id:approved,recordId:id,revision:row(id).revision,mode:'approve_transfer',confirmed:true,notes:'Custodian approval'});
 assert.equal(row(id).data.pending.state,'awaiting_receipt');assert.equal(sql.prepare('SELECT actor FROM access_audit WHERE id=?').get(approved).actor,'owner');
 assert.ok(!(await get(profileApi,'/api/role-profiles?profile=custodian')).work.some(w=>w.sourceId===id&&w.title.includes('مجوز انتقال')),'Completed work leaves the role queue');
 await post(workflow,{id:crypto.randomUUID(),recordId:id,revision:row(id).revision,mode:'accept_transfer',confirmed:true,scan:'NAFASYAR-ASSET/1:'+id,condition:'good',notes:'Cannot impersonate recipient'},403);
 assert.equal(row(id).data.holderKind,'stock');
 entity('open-clearance','asset_clearance',{memberId:'receiver',memberName:'Receiver',state:'open'});
 entity('closed-clearance','asset_clearance',{memberId:'receiver',memberName:'Receiver',state:'cleared'});
 const clearance=(await get(profileApi,'/api/role-profiles?profile=custodian')).work;assert.ok(clearance.some(w=>w.target==='asset-legacy:open-clearance'));assert.ok(!clearance.some(w=>w.sourceId==='closed-clearance'));
 assert.ok((await get(assets,'/api/assets')).records.some(r=>r.id==='open-clearance'));
 // An admin's stored company role must not leak into another selected profile.
 employee('owner',{read:[],write:[],eventStages:[],assetRoles:['custodian','disposal']});
 cookieValues[review.profileReviewCookie]='production-worker';
 const other=await ctx.run(admin,()=>auth.session());assert.equal(navigation.canOpenSection(other,'assets'),false);
 assert.equal(!!(await get(workflow,'/api/assets/workflow')).custodian,false);assert.equal(!!(await get(assets,'/api/assets')).custodian,false);
 await post(assets,{id:crypto.randomUUID(),confirmed:true,mode:'register',revision:0,code:'DENIED',name:'No extra grant',category:'Admin',condition:'good',location:'Company',reference:'Denied',day:today,notes:'Role isolation'},403);
 const ordinary={userId:'receiver',name:'Receiver',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};
 await get(profileApi,'/api/role-profiles',ordinary,403);
 const forged=await ctx.run(ordinary,()=>auth.session());assert.equal(forged.profileReview,undefined,'A cookie cannot grant an ordinary account a review role');
 const policy=load('lib/permissions.ts'),keeperPermissions=policy.validatePermissions({roleAssignment:{roles:['custodian']}});employee('keeper',keeperPermissions);
 const keeper={userId:'keeper',name:'Keeper',isAdmin:false,permissions:keeperPermissions};
 assert.equal((await get(workflow,'/api/assets/workflow',keeper)).custodian,true);
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify({read:[],write:[],eventStages:[]}), 'keeper');
 assert.equal(!!(await get(workflow,'/api/assets/workflow',keeper)).custodian,false,'Revoked real assignment is checked from stored membership');
 await ctx.run(keeper,async()=>{const r=await workflow.POST(request('/api/assets/workflow',{id:crypto.randomUUID(),mode:'group',confirmed:true,name:'Denied after revocation',controlled:false,notes:'Revoked'}));assert.equal(r.status,403);});
 cookieValues[review.profileReviewCookie]='custodian';
 const custodian=await ctx.run(admin,()=>auth.session());
 // Shared obligations exclude receiver-only, technical-only, finance and disposed work.
 for(const [aid,data] of [['due-signature',{signatureRequired:true,signedReceiptId:''}],['future',{annualDue:'2999-01-01'}],['due-service',{servicePlan:{hours:10,baselineHours:0,baseAt:'base'},meters:{hours:12}}],['tech-review',{technicalId:'receiver',service:{state:'awaiting_review',id:'s'}}],['disposed',{lifecycle:'disposed',signatureRequired:true,disposal:{id:'disposal-1',state:'approved'},financeFollowup:{state:'open'}}]]){
  entity(aid,'asset_item',{name:aid,code:aid,assetKind:'office',lifecycle:'active',holderKind:'stock',custodyId:aid,...data});
 }
 const queue=await load('lib/profile-work.ts').profileWork(custodian);assert.ok(queue.work.some(w=>w.sourceId==='due-signature'));assert.ok(queue.work.some(w=>w.sourceId==='due-service'));for(const absent of ['future','tech-review','disposed'])assert.ok(!queue.work.some(w=>w.sourceId===absent),absent);
 // Derived role and assigned employee cartables use the same stages, without synthetic assignees.
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(keeperPermissions),'keeper');
 await load('lib/asset-workflow-tasks.ts').syncAssetWorkflowTasks();
 const assigned=sql.prepare("SELECT data FROM duty_runs WHERE template_id='asset-workflow' AND assignee='keeper' AND state='open'").all().map(r=>JSON.parse(r.data));
 for(const aid of ['due-signature','due-service']){const stage=assigned.find(x=>x.sourceId===aid);assert.ok(stage);assert.ok(queue.work.some(w=>w.sourceId===aid&&w.id.endsWith(stage.stage)));}
 for(let i=0;i<110;i++)entity('bulk-'+String(i).padStart(3,'0'),'asset_item',{name:'Due '+i,code:'D'+i,assetKind:'office',lifecycle:'active',holderKind:'stock',custodyId:'cycle-'+i,signatureRequired:true,signedReceiptId:''});
 const bounded=await load('lib/profile-work.ts').profileWork(custodian);assert.equal(bounded.work.length,100);assert.equal(bounded.workHasMore,true);
 const boundedCard=await get(profileApi,'/api/role-profiles?profile=custodian');assert.equal(boundedCard.work.length,100);assert.equal(boundedCard.workHasMore,true);
 const boundedTasks=await get(tasks,'/api/tasks');assert.equal(boundedTasks.positionWork.length,100);assert.equal(boundedTasks.positionWorkHasMore,true);
 const exit=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',{id:crypto.randomUUID(),mode:'exit_profile',confirmed:true})));assert.equal(exit.status,200);assert.match(exit.headers.get('set-cookie'),/Max-Age=0/);
 cookieValues={};assert.equal((await ctx.run(admin,()=>auth.session())).isAdmin,true);
 console.log('PASS custodian profile: catalog/select/exit, no fabricated account, existing asset forms/cartable, real actor audit, no receipt impersonation, scoped permissions/revocation, shared task stages, legacy clearance deep link, HTTP/MCP and bounded SQL queue');
})().catch(e=>{console.error(e);process.exit(1)});
