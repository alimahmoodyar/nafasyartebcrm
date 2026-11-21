const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
let beforeBatch=null,tail=Promise.resolve();
const db={prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};}};},batch(statements){const run=async()=>{if(beforeBatch){const callback=beforeBatch;beforeBatch=null;await callback();}sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}};const next=tail.then(run);tail=next.catch(()=>{});return next;}};
const env={DB:db,TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64')},cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='next/headers')return {cookies:async()=>({get:()=>undefined})};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>null};if(n.startsWith('@/')||n.startsWith('.')){const next=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(next+(path.extname(next)?'':'.ts'));}return require(n);},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,FormData,Blob,File,btoa,atob,setTimeout,clearTimeout,console:{...console,error(){}}},{filename:file});return exports;
}
const permissions=load('lib/permissions.ts'),ctx=load('lib/mcp/context.ts').mcpActor,roles=load('app/api/users/roles/route.ts'),users=load('app/api/users/route.ts'),tools=load('lib/mcp/tools.ts');
const now=new Date().toISOString(),base='https://test.local',empty={read:[],write:[],eventStages:[]};
function actor(id,grants={},admin=false){const p=permissions.validatePermissions({...empty,...grants}),u={userId:'local:'+id,name:id,email:id+'@example.com',isAdmin:admin,permissions:p};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'Office','active',?,?,1,?,?)").run(id,u.email,id,u.userId,JSON.stringify(p),now,now);return u;}
const admin=actor('admin',{},true),hr=actor('hr',{personnelRoles:['hr']}),target=actor('worker',{assetRoles:['custodian']}),other=actor('other');
sql.prepare("INSERT INTO app_identity(id,subject) VALUES('local_admin','admin')").run();
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
const fixture=require('./personnel-test-fixture.cjs'),person=fixture(sql,'Approved worker',now),personData=JSON.parse(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(person).data);personData.memberId='worker';sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify(personData),person);
seed('central','material_warehouse',{name:'Central',warehouseType:'storage',active:true});seed('line','material_warehouse',{name:'Line',warehouseType:'production_line',active:true});seed('off','material_warehouse',{name:'Off',warehouseType:'storage',active:false});
seed('prior-message','inbox_message',{from:'worker',to:'other',body:'Original'});seed('prior-contract','hr_contract',{memberId:'worker',baseSalary:'123456789',state:'active',history:[{name:'Original'}]});
sql.prepare('INSERT INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,3)').run('worker','unchanged-login','unchanged-hash');
const request=(method,path,body,headers={})=>new Request(base+path,{method,headers:{origin:base,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const post=(u,b,headers={})=>ctx.run(u,()=>roles.POST(request('POST','/api/users/roles',b,headers)));
const get=(u,id='worker')=>ctx.run(u,()=>roles.GET(request('GET','/api/users/roles?'+(id?'memberId='+id:'tab=all'))));
const selected=async()=>{const r=await get(admin);assert.equal(r.status,200,await r.clone().text());return (await r.json()).selected};
const draft=async(bindings,legacyMode='keep')=>{const p=await selected();return {mode:'preview',memberId:'worker',revision:p.memberRevision,assignmentRevision:p.assignmentRevision,bindings,legacyMode,reason:'Approved new responsibility'}};
const preview=async b=>{const r=await post(admin,b);assert.equal(r.status,200,await r.clone().text());return r.json()};
const save=async(b,p,extra={})=>{const body={...b,mode:'save',confirmed:true,previewToken:p.previewToken,requestId:crypto.randomUUID(),...extra},r=await post(admin,body);return {r,body}};
const stored=()=>JSON.parse(sql.prepare("SELECT permissions FROM app_members WHERE id='worker'").get().permissions);
const record=()=>JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id='member-role-assignment:worker'").get().data);
(async()=>{
 const original=sql.prepare("SELECT id,type,data FROM flow_entities WHERE id IN ('prior-message','prior-contract') ORDER BY id").all(),credential=sql.prepare("SELECT * FROM password_accounts WHERE member_id='worker'").get();
 for(const u of [hr,target,other])assert.equal((await get(u)).status,403);
 let b=await draft([{profileId:'central-store',warehouseIds:['central']},{profileId:'custodian'}]);
 assert.equal((await post(admin,b,{origin:'https://evil.example'})).status,403);assert.equal((await post(admin,b,{'x-assistant-account':'wrong'})).status,409);
 for(const bindings of [[{profileId:'central-store'}],[{profileId:'central-store',warehouseIds:['off']}],[{profileId:'central-store',warehouseIds:['line']}],[{profileId:'repair-worker'}],[{profileId:'custodian'},{profileId:'custodian'}]])assert.equal((await post(admin,{...b,bindings})).status,400);
 let p=await preview(b);assert.equal(p.removed.length,0);assert.ok(p.after.assetRoles.includes('custodian'));assert.deepEqual(p.after.warehouseResponsibilities,[{warehouseId:'central',role:'inventory'}]);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='member_role_assignment'").get().n,0,'preview writes nothing');
 assert.equal((await save(b,p,{confirmed:false})).r.status,400);let saved=await save(b,p);assert.equal(saved.r.status,200,await saved.r.clone().text());assert.equal(record().history.length,1);assert.equal(record().history[0].actor,'local:admin');
 assert.equal((await post(admin,saved.body)).status,200,'idempotent retry');assert.equal((await post(admin,{...saved.body,reason:'different'})).status,409);
 assert.equal((await post(admin,{...b,mode:'save',confirmed:true,previewToken:p.previewToken,requestId:crypto.randomUUID()})).status,409);
 // Removing a profile recomputes derived grants; retained pre-existing custody survives.
 b=await draft([{profileId:'custodian'}]);p=await preview(b);assert.ok(p.removed.some(x=>x.startsWith('warehouse:')));assert.equal((await save(b,p)).r.status,400);
 sql.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,due,state,data,created,updated) VALUES('open-work','template','now','worker','2099-01-01','open',?, ?,?)").run(JSON.stringify({sourceSection:'flow',title:'Existing receipt'}),now,now);
 p=await preview(b);assert.equal(p.blocked,true);assert.equal((await save(b,p,{reviewedRemovals:true})).r.status,409);sql.prepare("UPDATE duty_runs SET state='completed',revision=revision+1 WHERE id='open-work'").run();
 p=await preview(b);saved=await save(b,p,{reviewedRemovals:true});assert.equal(saved.r.status,200,await saved.r.clone().text());assert.ok(stored().assetRoles.includes('custodian'));assert.deepEqual(stored().warehouseResponsibilities||[],[]);
 // Explicit replacement removes only after review, preserving original audit and all source history.
 b=await draft([],'replace');p=await preview(b);assert.ok(p.removed.includes('assetRoles:custodian'));assert.equal((await save(b,p,{reviewedRemovals:false})).r.status,400);
 const historyLength=record().history.length;sql.exec("CREATE TRIGGER role_failure BEFORE UPDATE ON app_members WHEN OLD.id='worker' BEGIN SELECT RAISE(ABORT,'SQLITE role failure'); END");saved=await save(b,p,{reviewedRemovals:true});assert.equal(saved.r.status,503);assert.equal(record().history.length,historyLength);assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(saved.body.requestId),undefined);sql.exec('DROP TRIGGER role_failure');
 // New work, revoked actor, warehouse changes or concurrent account changes invalidate the batch atomically.
 beforeBatch=()=>sql.prepare("UPDATE app_members SET revision=revision+1 WHERE id='worker'").run();saved=await save(b,p,{reviewedRemovals:true});assert.equal(saved.r.status,409);assert.equal(record().history.length,historyLength);
 b=await draft([],'replace');p=await preview(b);beforeBatch=()=>sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='central'").run();assert.equal((await save(b,p,{reviewedRemovals:true})).r.status,409);
 b=await draft([],'replace');p=await preview(b);beforeBatch=()=>sql.prepare("UPDATE app_members SET status='disabled' WHERE id='admin'").run();assert.equal((await save(b,p,{reviewedRemovals:true})).r.status,409);sql.prepare("UPDATE app_members SET status='active' WHERE id='admin'").run();
 b=await draft([],'replace');p=await preview(b);saved=await save(b,p,{reviewedRemovals:true});assert.equal(saved.r.status,200,await saved.r.clone().text());assert.deepEqual(stored().assetRoles||[],[]);
 assert.equal(record().history.length,historyLength+1);assert.deepEqual(sql.prepare("SELECT id,type,data FROM flow_entities WHERE id IN ('prior-message','prior-contract') ORDER BY id").all(),original);assert.deepEqual(sql.prepare("SELECT * FROM password_accounts WHERE member_id='worker'").get(),credential);
 const m=sql.prepare("SELECT * FROM app_members WHERE id='worker'").get();let r=await ctx.run(admin,()=>users.PATCH(request('PATCH','/api/users',{id:'worker',revision:m.revision,name:m.name,email:m.email,unit:m.unit,status:m.status,username:'unchanged-login'})));assert.equal(r.status,200,await r.clone().text());assert.deepEqual(stored().assetRoles||[],[]);
 const m2=sql.prepare("SELECT * FROM app_members WHERE id='worker'").get();r=await ctx.run(admin,()=>users.PATCH(request('PATCH','/api/users',{id:'worker',revision:m2.revision,name:m2.name,email:m2.email,unit:m2.unit,status:m2.status,permissions:{...empty,finance:'write'}})));assert.equal(r.status,409,'legacy editor cannot bypass managed roles');
 b=await draft([{profileId:'driver'}]);p=await preview(b);assert.ok(p.after.transportRoles.includes('driver'),'no mission required for driver');
 assert.equal((await post(admin,{...b,memberId:'admin'})).status,403);actor('owner');sql.prepare("UPDATE app_members SET email='owner@example.com' WHERE id='owner'").run();assert.equal((await post(admin,{...b,memberId:'owner'})).status,403);
 // Scope/role combinations cannot invent cross-domain service manager privileges.
 b=await draft([{profileId:'home-service-manager'},{profileId:'hospital-service'}]);assert.equal((await post(admin,b)).status,400);
 // Every operational profile in the approved catalog is assignable with a valid real scope.
 const profiles=load('lib/role-profiles.ts').roleProfiles;
 for(const profile of profiles.filter(p=>p.operational&&!['sales-representative','home-service-representative'].includes(p.id))){const binding={profileId:profile.id,...(['central-store','line-store','quality'].includes(profile.id)?{warehouseIds:[profile.id==='line-store'?'line':'central']}:{})};const test=await draft([binding],'replace'),r=await post(admin,test);assert.equal(r.status,200,profile.id+': '+await r.clone().text());}
 // Real external accounts remain organization-bound; preview/sample agents never become real scopes.
 const ext=actor('external',{salesRoles:['agent'],salesAgentId:'real-agent'});seed('real-agent','sales_agent',{name:'Real agency',kind:'representative',active:true});seed('second-agent','sales_agent',{name:'Other agency',kind:'representative',active:true});
 const er=await ctx.run(admin,()=>roles.GET(request('GET','/api/users/roles?memberId=external'))),ed=(await er.json()).selected,eb={mode:'preview',memberId:'external',revision:ed.memberRevision,assignmentRevision:0,bindings:[{profileId:'sales-representative',agentId:'real-agent'}],legacyMode:'replace',reason:'Same organization'};
 assert.equal((await post(admin,eb)).status,200);assert.equal((await post(admin,{...eb,bindings:[{profileId:'sales-representative',agentId:'second-agent'}]})).status,400);assert.equal((await post(admin,{...eb,bindings:[{profileId:'sales-representative',agentId:'real-agent'},{profileId:'custodian'}]})).status,400);
 // A newly created process task between preview and save must invalidate even an unchanged account.
 b=await draft([{profileId:'driver'}]);p=await preview(b);beforeBatch=()=>sql.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,due,state,data,created,updated) VALUES('race-task','template','now','worker','2099-01-01','open','{}',?,?)").run(now,now);assert.equal((await save(b,p)).r.status,409);sql.prepare("DELETE FROM duty_runs WHERE id='race-task'").run();
 // Existing manual-account clients cannot erase grants without the role review path.
 const h=sql.prepare("SELECT * FROM app_members WHERE id='hr'").get();let clear=await ctx.run(admin,()=>users.PATCH(request('PATCH','/api/users',{id:h.id,revision:h.revision,email:h.email,name:h.name,unit:h.unit,status:h.status,permissions:empty})));assert.equal(clear.status,409);
 // Server pagination and code search operate before returning a page.
 for(let i=0;i<30;i++)actor('paged-'+i);
 let pageResponse=await ctx.run(admin,()=>roles.GET(request('GET','/api/users/roles?tab=all&page=0'))),pageData=await pageResponse.json();assert.equal(pageData.people.length,25);assert.ok(pageData.total>25);
 pageResponse=await ctx.run(admin,()=>roles.GET(request('GET','/api/users/roles?tab=all&q='+encodeURIComponent(personData.code))));pageData=await pageResponse.json();assert.equal(pageData.people.length,1);assert.equal(pageData.people[0].id,'worker');
 // HTTP/MCP use the same validations and handler, no impersonation.
 const principal={user:admin,scope:'read_write',tokenId:null},list=await tools.executeTool('get_role_assignment',{memberId:'worker'},base,principal);assert.equal(list.selected.id,'worker');
 b=await draft([{profileId:'driver'}]);const {mode,...fields}=b;p=await tools.executeTool('preview_role_assignment',fields,base,{...principal,scope:'read'});const result=await tools.executeTool('assign_user_roles',{...fields,previewToken:p.previewToken,requestId:crypto.randomUUID(),confirmed:true},base,principal);assert.equal(result.saved,true);assert.ok(stored().transportRoles.includes('driver'));
 assert.ok(!JSON.stringify(await (await get(admin)).json()).includes('unchanged-hash'));assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 const reset=load('lib/reset-contract.ts');assert.ok(reset.resetFlowPreserved.includes('member_role_assignment'));
 console.log('PASS role assignment: actual profiles, multi-role/scopes, legacy keep/reviewed replace/removal, protected admin, HTTP/MCP authorization/CSRF/CAS/idempotency/rollback, open work and dependencies, account-editor bypass, credentials and historical source preservation, reset metadata.');
})().catch(e=>{console.error(e);process.exitCode=1});
