const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')&&(!process.env.TEST_PRE_PASSWORD_MIGRATION||f<'0017')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
let cookie="";const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='next/headers')return {cookies:async()=>({get:name=>name==='__Host-nafasyar-session'&&cookie?{value:cookie}:undefined})};if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
// Updated prerequisite fixture: production now requires an approved personnel record before an internal account.
let fixturePerson=0;
function personnelFixture(name){const memberId=crypto.randomUUID(),id='employee:'+memberId,at=new Date().toISOString(),data={memberId,name:name||'Synthetic person',state:'active',profileApprovedAt:at,start:'2026-01-01',location:'Synthetic office',employment:'تمام‌وقت',unit:'',mobile:'09121234567',nationalId:String(++fixturePerson).padStart(10,'0'),birthDate:'1990-01-01',maritalStatus:'single',address:'Synthetic address',emergencyContact:'Synthetic contact 09121234567',bankAccount:'IR220000000000000000000001',childrenCount:0,children:[],history:[]};sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'hr_employee',?,1,?,?)").run(id,JSON.stringify(data),at,at);return id;}
const request=(path,method='GET',body,headers={})=>{if(path==='/api/users'&&method==='POST'&&body&&!body.personnelId)body={...body,personnelId:personnelFixture(body.name)};return new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});};
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function rpcCall(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const userApi=load('app/api/users/route.ts'),login=load('app/api/auth/login/route.ts'),logout=load('app/api/auth/logout/route.ts');
const permissions={read:['batch'],write:[],eventStages:[],finance:'none',warehouseResponsibilities:[]};
async function enter(pass='Test-password-123'){return login.POST(request('/api/auth/login','POST',{username:'worker01',password:pass}));}
const context=load('lib/mcp/context.ts').mcpActor,personnel=load('lib/personnel.ts'),declarations=load('app/api/assets/declarations/route.ts'),photos=load('app/api/assets/declarations/files/route.ts'),onboarding=load('app/api/personnel/onboarding/route.ts'),credentials=load('app/api/auth/credentials/route.ts');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
const req=(path,method='GET',body,extra={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
async function asRole(email,name,grants){identity=owner;cookie='';const response=await userApi.POST(request('/api/users','POST',{name,email,status:'active',permissions:{read:[],write:[],eventStages:[],...grants}}));assert.equal(response.status,201,await response.clone().text());identity={userId:email,email,displayName:name};return auth.session();}
const call=(u,b)=>context.run(u,()=>declarations.POST(req('/api/assets/declarations','POST',b)));
const read=(u,q='')=>context.run(u,()=>declarations.GET(req('/api/assets/declarations'+q)));
const op=(mode,extra={})=>({id:crypto.randomUUID(),mode,confirmed:true,revision:0,...extra});
(async()=>{
 identity=owner;await auth.session();const hr=await asRole('hr@test.local','HR',{personnelRoles:['hr']}),custodian=await asRole('custodian@test.local','Custodian',{assetRoles:['custodian']}),other=await asRole('other@test.local','Other',{});cookie='';identity=owner;
 const form={name:'New staff',nationalId:'0000012345',birthDate:'1990-01-01',mobile:'09121234567',maritalStatus:'single',childrenCount:0,address:'Synthetic address',emergencyContact:'Synthetic emergency',location:'Main office',employment:'تمام‌وقت',start:'2026-01-01',bankAccount:'IR220000000000000000000001'};
 const created=await context.run(hr,()=>personnel.applyPersonnel(hr,op('personnel_create',form)));let employee=row(created.id);assert.equal(employee.data.state,'setup');assert.equal(sql.prepare('SELECT id FROM app_members WHERE id=?').get(employee.data.memberId),undefined,'no account on draft');
 const approve=op('personnel_complete',{recordId:created.id,revision:employee.revision});const done=await context.run(hr,()=>personnel.applyPersonnel(hr,approve));employee=row(created.id);const mid=employee.data.memberId;
 assert.equal(done.accountProvisioning.state,'created');assert.equal(employee.data.state,'active');assert.equal(load('lib/personnel-documents.ts').personnelDocumentStatus(await personnel.hrRows(),employee.id).complete,false,'missing documents do not block basic account');
 const user=sql.prepare('SELECT * FROM app_members WHERE id=?').get(mid),credential=sql.prepare('SELECT * FROM password_accounts WHERE member_id=?').get(mid);assert.equal(credential.username,'0000012345');assert.equal(credential.must_change,1);assert.equal(await load('lib/password-auth.ts').verifyPassword(form.mobile,credential.password_hash),true);const grants=JSON.parse(user.permissions);for(const key of ['personnelRoles','assetRoles','salesRoles','serviceRoles'])assert.equal(grants[key]?.length||0,0,'no job grants');assert.equal(grants.write.length,0);
 assert.equal((await context.run(hr,()=>personnel.applyPersonnel(hr,approve))).repeated,true);assert.equal(sql.prepare('SELECT count(*) n FROM password_accounts WHERE member_id=?').get(mid).n,1);
 identity=null;let entered=await login.POST(req('/api/auth/login','POST',{username:form.nationalId,password:form.mobile}));assert.equal(entered.status,200);cookie=entered.headers.get('set-cookie').split(';')[0].split('=')[1];const initialCookie=cookie;assert.equal((await auth.session(true)).mustChangePassword,true);assert.equal((await declarations.GET(req('/api/assets/declarations'))).status,403,'must change before reading');
 const changed=await credentials.POST(req('/api/auth/credentials','POST',{username:form.nationalId,currentPassword:form.mobile,newPassword:'New-private-password-123',confirmed:true},{'x-profile-account':'local:'+mid}));assert.equal(changed.status,200,await changed.clone().text());await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';entered=await login.POST(req('/api/auth/login','POST',{username:form.nationalId,password:'New-private-password-123'}));assert.equal(entered.status,200);cookie=entered.headers.get('set-cookie').split(';')[0].split('=')[1];const staff=await auth.session();assert.equal(staff.mustChangePassword,false);cookie='';identity=owner;
 assert.equal((await read(staff,'?review=true')).status,403);assert.equal((await context.run(staff,()=>onboarding.GET())).status,403);assert.equal((await context.run(hr,()=>onboarding.GET())).status,200);assert.equal((await context.run(custodian,()=>onboarding.GET())).status,403);
 const item={name:'Office chair',category:'مبلمان اداری',location:'Room 1',condition:'good',serial:'CHAIR-1',existingCode:'002877',photoFileIds:[]};
 let result=await call(staff,op('save',{items:[item,{...item,name:'Second chair',serial:'CHAIR-2'}],memberId:other.userId}));assert.equal(result.status,400);
 const createDecl=op('save',{items:[item,{...item,name:'Second chair',serial:'CHAIR-2',existingCode:'AM-009998'}]});result=await call(staff,createDecl);assert.equal(result.status,200,await result.clone().text());let record=(await result.json()).record;
 assert.equal((await call(staff,op('submit',{recordId:record.id,revision:record.revision,items:record.data.items,holderConfirmed:true}))).status,400,'each row needs own photo');
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 async function upload(u,rec,number,id=crypto.randomUUID()){const q=new URLSearchParams({id,recordId:rec.id,revision:String(rec.revision),number:String(number),filename:'photo.png',confirmed:'true'});return context.run(u,()=>photos.POST(new Request(base+'/api/assets/declarations/files?'+q,{method:'POST',headers:{origin:base,'x-asset-account':u.userId},body:png})));}
 const fileId=crypto.randomUUID();result=await upload(staff,record,1,fileId);assert.equal(result.status,200,await result.clone().text());record=(await result.json()).record;assert.equal((await upload(staff,record,1,fileId)).status,200,'photo retry stable');result=await upload(staff,record,2);assert.equal(result.status,200);record=(await result.json()).record;assert.equal(record.files.length,2);assert.equal(record.data.items[0].photoFileIds[0],fileId);
 assert.equal((await context.run(other,()=>photos.GET(req('/api/assets/declarations/files?id='+fileId)))).status,404);assert.equal((await context.run(staff,()=>photos.GET(req('/api/assets/declarations/files?id='+fileId)))).status,200);

 // Same photo UUID with competing bytes must never overwrite the committed object's contents.
 const raceId=crypto.randomUUID(),raceQuery=new URLSearchParams({id:raceId,recordId:record.id,revision:String(record.revision),number:'2',filename:'race.png',confirmed:'true'}),put=bucket.put.bind(bucket),winnerBytes=Uint8Array.from([...png,42]);let winner,intercept=true;
 bucket.put=async(k,b)=>{await put(k,b);if(intercept){intercept=false;winner=await context.run(staff,()=>photos.POST(new Request(base+'/api/assets/declarations/files?'+raceQuery,{method:'POST',headers:{origin:base},body:winnerBytes})));assert.equal(winner.status,200)}};
 const loser=await context.run(staff,()=>photos.POST(new Request(base+'/api/assets/declarations/files?'+raceQuery,{method:'POST',headers:{origin:base},body:png})));bucket.put=put;assert.notEqual(loser.status,200);record=(await winner.json()).record;const committedPhoto=await context.run(staff,()=>photos.GET(req('/api/assets/declarations/files?id='+raceId)));assert.equal(committedPhoto.status,200,'concurrent upload preserves committed image');assert.deepEqual(new Uint8Array(await committedPhoto.arrayBuffer()),winnerBytes);assert.equal(objects.has(row(raceId).data.objectKey),true);
 const badItems=structuredClone(record.data.items);badItems[1].photoFileIds=badItems[0].photoFileIds;assert.equal((await call(staff,op('submit',{recordId:record.id,revision:record.revision,items:badItems,holderConfirmed:true}))).status,400);
 let submit=op('submit',{recordId:record.id,revision:record.revision,items:record.data.items,holderConfirmed:true});result=await call(staff,submit);assert.equal(result.status,200);record=(await result.json()).record;assert.equal(record.data.state,'submitted');assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n,0,'nothing official until review');await load('lib/asset-declaration-tasks.ts').syncDeclarationTasks();assert.ok(sql.prepare("SELECT id FROM duty_runs WHERE template_id='asset-declarations' AND assignee=?").get((await load('lib/assets.ts').assetActor(custodian)).id),'custodian task');
 assert.equal((await read(other,'?id='+record.id)).status,404);assert.equal((await call(staff,op('approve',{recordId:record.id,revision:record.revision,matched:true}))).status,403);assert.equal((await call(hr,op('approve',{recordId:record.id,revision:record.revision,matched:true}))).status,404);
 const reopen=op('save',{recordId:record.id,revision:record.revision,items:record.data.items});
 assert.equal((await call(custodian,reopen)).status,403);
 result=await call(staff,reopen);assert.equal(result.status,200);
 const reopened=(await result.json()).record;assert.equal(reopened.data.state,'draft');
 assert.equal((await call(custodian,op('approve',{recordId:record.id,revision:record.revision,matched:true}))).status,409);
 const amended=reopened.data.items.map((item,i)=>i?item:{...item,model:'updated before review'});
 result=await call(staff,op('submit',{recordId:record.id,revision:reopened.revision,items:amended,holderConfirmed:true}));
 assert.equal(result.status,200);record=(await result.json()).record;assert.equal(record.data.items[0].model,'updated before review');
 const tasks=load('app/api/tasks/route.ts');
 const inbox=async (u,scope='')=>{const res=await context.run(u,()=>tasks.GET(req('/api/tasks'+(scope?'?workspace='+scope:''))));assert.equal(res.status,200,await res.clone().text());return (await res.json()).tasks;};
 const assignedTask=(await inbox(custodian)).find(t=>t.data.sourceId===record.id&&t.state==='open');
 assert.ok(assignedTask,'A submitted declaration appears in the actual custodian cartable.');
 assert.equal(assignedTask.data.recordId,'asset-declaration:'+record.id);
 assert.ok(!(await inbox(staff)).some(t=>t.data.sourceId===record.id));
 assert.ok(!(await inbox(other)).some(t=>t.data.sourceId===record.id));
 const newCustodian=await asRole('new-custodian@test.local','New Custodian',{});const newKeeperId=(await load('lib/assets.ts').assetActor(newCustodian)).id;
 const roleContext=load('lib/member-role-assignments.ts'),admin={...custodian,userId:owner.userId,isAdmin:true};
 const roleCtx=await roleContext.memberRoleContext(admin,newKeeperId),editor=(await roleContext.memberRoleEditor(roleCtx,newKeeperId)).selected;
 const selection={memberId:newKeeperId,revision:editor.memberRevision,assignmentRevision:editor.assignmentRevision,bindings:[{profileId:'custodian'},{profileId:'personnel-hr'}],legacyMode:'keep',reason:'Assign the new custodian'};
 const preview=await roleContext.previewMemberRoles(roleCtx,selection);
 const grant=await roleContext.saveMemberRoles(roleCtx,{...selection,confirmed:true,requestId:crypto.randomUUID(),previewToken:preview.previewToken});
 assert.equal(grant.followupPending,false);
 assert.ok(sql.prepare("SELECT 1 FROM duty_runs WHERE template_id='asset-declarations' AND assignee=? AND json_extract(data,'$.sourceId')=? AND state='open'").get(newKeeperId,record.id),'Role save backfills pending announcements.');
 assert.ok((await inbox({...newCustodian,permissions:preview.after})).some(t=>t.data.sourceId===record.id));
 result=await call(custodian,op('return',{recordId:record.id,revision:record.revision,notes:'Check second photo'}));assert.equal(result.status,200);record=(await result.json()).record;assert.equal(record.data.state,'returned');await load('lib/asset-declaration-tasks.ts').syncDeclarationTasks();assert.ok(sql.prepare("SELECT id FROM duty_runs WHERE template_id='asset-declarations' AND assignee=? AND state='open'").get(mid),'return routed to self');
 const returnedTask=(await inbox(staff)).find(t=>t.data.sourceId===record.id&&t.state==='open');
 assert.ok(returnedTask,'The original employee sees the correction without custodian rights.');
 assert.equal(returnedTask.data.sourceSection,'personnel');
 assert.equal((await (await read(staff,'?id='+record.id)).json()).records[0].data.reviewNotes,'Check second photo');
 sql.prepare("UPDATE duty_runs SET state='cancelled' WHERE id=?").run(returnedTask.id);
 assert.ok((await inbox(staff)).some(t=>t.id===returnedTask.id&&t.state==='open'),'The employee cartable recovers a missing open correction.');
 assert.ok(!(await inbox(other)).some(t=>t.data.sourceId===record.id));
 result=await call(staff,op('submit',{recordId:record.id,revision:record.revision,items:record.data.items,holderConfirmed:true}));assert.equal(result.status,200);record=(await result.json()).record;
 const multiKeeper={...newCustodian,permissions:preview.after};
 const isOpenReview=t=>t.data.sourceId===record.id&&t.state==='open';
 assert.equal((await inbox(multiKeeper,'custodian')).filter(isOpenReview).length,1);
 assert.ok(!(await inbox(multiKeeper,'personal')).some(isOpenReview));
 assert.ok(!(await inbox(multiKeeper,'personnel-hr')).some(isOpenReview));
 assert.equal((await context.run(other,()=>tasks.GET(req('/api/tasks?workspace=custodian')))).status,403);
 const messages=load('app/api/inbox/route.ts');
 const send=await context.run(staff,()=>messages.POST(req('/api/inbox','POST',{id:crypto.randomUUID(),mode:'create',kind:'message',priority:'normal',recipientType:'person',recipientId:'@role:custodian',title:'Role message',body:'Review this laptop'})));
 assert.equal(send.status,200,await send.clone().text());
 const sent=(await send.json()).threadId;
 for(const scope of ['custodian','personal','personnel-hr']){
  const response=await context.run(multiKeeper,()=>messages.GET(req('/api/inbox?workspace='+scope)));
  assert.equal(response.status,200);
  assert.equal((await response.json()).threads.some(t=>t.id===sent),scope==='custodian');
 }
 assert.equal((await context.run(other,()=>messages.GET(req('/api/inbox?workspace=custodian&thread='+sent)))).status,403);
 const reviewItems=record.data.items.map((r,i)=>({...r,existingAssetId:'',assetRevision:0,copies:i?1:2}));
 const codesToReview=(await (await read(custodian,'?review=true&id='+record.id)).json()).records[0].codeMatches;
 assert.deepEqual(codesToReview.map(match=>match.state),['legacy','legacy'],'Both a legacy number and an AM code absent from the ledger can proceed as new assets.');
 assert.equal((await call(custodian,op('approve',{recordId:record.id,revision:record.revision,reviewItems:[{...reviewItems[0],name:'Changed'},reviewItems[1]],matched:true}))).status,400,'correction requires reason');
 const conflicting=crypto.randomUUID();sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'asset_item',?,1,?,?)").run(conflicting,JSON.stringify({code:'AM-900001',name:'Other asset',holderKind:'employee',holderId:(await load('lib/assets.ts').assetActor(other)).id,serial:'OTHER',lifecycle:'active'}),new Date().toISOString(),new Date().toISOString());
 assert.equal((await call(custodian,op('approve',{recordId:record.id,revision:record.revision,matched:true,reviewItems:[{...reviewItems[0],existingAssetId:conflicting,assetRevision:1},reviewItems[1]]}))).status,409,'no stealing another holder');
 sql.exec("CREATE TRIGGER onboarding_fail BEFORE UPDATE ON flow_entities WHEN NEW.type='asset_declaration' AND json_extract(NEW.data,'$.state')='approved' BEGIN SELECT RAISE(ABORT,'SQLITE forced failure'); END");
 const approveDecl=op('approve',{recordId:record.id,revision:record.revision,reviewItems,matched:true});assert.equal((await call(custodian,approveDecl)).status,503);assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n,1,'rollback every generated asset');sql.exec('DROP TRIGGER onboarding_fail');
 result=await call(custodian,approveDecl);assert.equal(result.status,200,await result.clone().text());record=(await result.json()).record;assert.equal(record.data.approvedItems.length,2);assert.equal(record.data.state,'approved');const official=record.data.approvedItems.map(v=>row(v.assetId));for(const a of official){assert.equal(a.data.holderId,mid);assert.equal(a.data.holderKind,'employee');assert.equal(a.data.registrationBasis,'opening_inventory');assert.equal(a.data.handedDay,'');assert.equal(a.data.history[0].mode,'opening_inventory');}assert.notEqual(official[0].data.code,official[1].data.code);assert.equal(record.data.approvedItems[0].copies,2);assert.equal(row(fileId).data.purpose,'asset_photo');
 assert.deepEqual(record.data.items.map(v=>v.existingCode),['002877','AM-009998'],'Employee label text survives approval for audit.');
 assert.ok(official.every((asset,i)=>asset.data.code!==record.data.items[i].existingCode));
 const count=sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n;assert.equal((await call(custodian,approveDecl)).status,200);assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n,count);
 const print=await context.run(custodian,()=>load('app/api/assets/registration/route.ts').GET(req('/api/assets/registration?id='+encodeURIComponent(record.data.groupId))));assert.equal(print.status,200);assert.equal((await print.json()).items[1].number,2);
 result=await call(staff,op('submit',{items:[],noAssets:true,holderConfirmed:true}));assert.equal(result.status,200);const none=(await result.json()).record;assert.equal((await call(custodian,op('approve',{recordId:none.id,revision:none.revision,matched:true}))).status,409,'no-assets cannot clear existing held items');assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n,count);
 // Collision does not create/merge an existing account or reset its password.
 const collisionForm={...form,name:'Collision',nationalId:'0000099999'};identity=owner;let priorUser=await userApi.POST(request('/api/users','POST',{name:'Existing',username:collisionForm.nationalId,password:'Preserve-old-password',status:'active',permissions}));assert.equal(priorUser.status,201);const priorMember=(await priorUser.json()).member,priorCredential=sql.prepare('SELECT * FROM password_accounts WHERE member_id=?').get(priorMember.id);
 const c=await context.run(hr,()=>personnel.applyPersonnel(hr,op('personnel_create',collisionForm)));const cRow=row(c.id);const collision=await context.run(hr,()=>personnel.applyPersonnel(hr,op('personnel_complete',{recordId:c.id,revision:cRow.revision})));assert.equal(collision.accountProvisioning.state,'needs_link');assert.equal(sql.prepare('SELECT id FROM app_members WHERE id=?').get(cRow.data.memberId),undefined);assert.deepEqual(sql.prepare('SELECT * FROM password_accounts WHERE member_id=?').get(priorMember.id),priorCredential);

 // HR approval and automatic account must roll back together on any credential failure.
 const rollbackPerson=await context.run(hr,()=>personnel.applyPersonnel(hr,op('personnel_create',{...form,name:'Atomic approval',nationalId:'0000088888'}))),beforeApproval=row(rollbackPerson.id),beforeCount=sql.prepare('SELECT count(*) n FROM app_members').get().n;
 sql.exec("CREATE TRIGGER onboarding_credential_fail BEFORE INSERT ON password_accounts WHEN NEW.username='0000088888' BEGIN SELECT RAISE(ABORT,'onboarding_credential_rejected'); END");
 await assert.rejects(()=>context.run(hr,()=>personnel.applyPersonnel(hr,op('personnel_complete',{recordId:beforeApproval.id,revision:beforeApproval.revision}))));sql.exec('DROP TRIGGER onboarding_credential_fail');assert.equal(row(beforeApproval.id).data.state,'setup');assert.equal(row(beforeApproval.id).revision,beforeApproval.revision);assert.equal(sql.prepare('SELECT count(*) n FROM app_members').get().n,beforeCount);assert.equal(sql.prepare("SELECT id FROM flow_entities WHERE id=?").get('member-contact:'+beforeApproval.data.memberId),undefined);
 // Existing account reapproval never resets its credentials or job grants.
 const linkedProfile=sql.prepare("SELECT * FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=?").get(mid),beforePassword=sql.prepare('SELECT * FROM password_accounts WHERE member_id=?').get(mid);await context.run(hr,()=>personnel.applyPersonnel(hr,op('personnel_complete',{recordId:linkedProfile.id,revision:linkedProfile.revision})));assert.deepEqual(sql.prepare('SELECT * FROM password_accounts WHERE member_id=?').get(mid),beforePassword);
 // Own custodian cannot self-approve; no-assets assertion is separately reviewed.
 result=await call(custodian,op('submit',{items:[],noAssets:true,holderConfirmed:true}));assert.equal(result.status,200);const selfReview=(await result.json()).record;assert.equal((await call(custodian,op('approve',{recordId:selfReview.id,revision:selfReview.revision,matched:true}))).status,403);
 result=await call(hr,op('submit',{items:[],noAssets:true,holderConfirmed:true}));assert.equal(result.status,200);const empty=(await result.json()).record;assert.equal((await call(custodian,op('approve',{recordId:empty.id,revision:empty.revision,matched:true}))).status,200);
 // MCP uses same binary upload/read handlers and existing-passport matching.
 const at=new Date().toISOString(),imageBytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]),stockId=crypto.randomUUID();sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'asset_item',?,1,?,?)").run(stockId,JSON.stringify({code:'AM-009999',name:'Existing stock',holderKind:'stock',holderId:'',serial:'STOCK-MATCH',condition:'good',assetKind:'office',lifecycle:'active',history:[]}),at,at);
 result=await call(other,op('save',{items:[{name:'Existing stock',category:'Office',location:'Desk',condition:'good',serial:'STOCK-MATCH',existingCode:'am-۰۰۹۹۹۹'}]}));let matchCase=(await result.json()).record;const otherPrincipal={user:other,scope:'read_write',tokenId:null},photoId=crypto.randomUUID(),imageArgs={id:photoId,recordId:matchCase.id,revision:matchCase.revision,number:1,filename:'existing.png',base64:Buffer.from(imageBytes).toString('base64'),confirmed:true};const binary=await catalog.executeTool('upload_asset_declaration_photo',imageArgs,base,otherPrincipal);matchCase=binary.record;assert.equal(matchCase.files[0].id,photoId);const downloaded=await catalog.executeTool('download_asset_declaration_photo',{id:photoId,length:12},base,otherPrincipal);assert.equal(downloaded.totalBytes,imageBytes.byteLength);assert.equal(Buffer.from(downloaded.base64,'base64').length,12);await assert.rejects(()=>catalog.executeTool('download_asset_declaration_photo',{id:photoId},base,{user:staff,scope:'read_write',tokenId:null}));
 result=await call(other,op('submit',{recordId:matchCase.id,revision:matchCase.revision,items:matchCase.data.items,holderConfirmed:true}));matchCase=(await result.json()).record;
 const getMatch=async()=>(await (await read(custodian,'?review=true&id='+matchCase.id)).json()).records[0].codeMatches[0];
 assert.equal((await getMatch()).asset.id,stockId,'A generated code is recognized with Persian digits.');
 assert.equal((await (await read(other,'?id='+matchCase.id)).json()).records[0].codeMatches,undefined,'Custodian lookup is not exposed to staff.');
 sql.prepare("UPDATE flow_entities SET type='asset_archived' WHERE id=?").run(stockId);
 assert.equal((await getMatch()).state,'inactive');
 assert.equal((await call(custodian,op('approve',{recordId:matchCase.id,revision:matchCase.revision,matched:true}))).status,409,'An archived code cannot be registered as a new asset.');
 sql.prepare("UPDATE flow_entities SET type='asset_item' WHERE id=?").run(stockId);
 const countBeforeMatch=sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n;result=await call(custodian,op('approve',{recordId:matchCase.id,revision:matchCase.revision,reviewItems:[{...matchCase.data.items[0],existingAssetId:stockId,assetRevision:1,copies:3}],matched:true}));assert.equal(result.status,200,await result.clone().text());assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_item'").get().n,countBeforeMatch);assert.equal(row(stockId).data.holderId,(await load('lib/assets.ts').assetActor(other)).id);assert.equal(row(stockId).data.handedDay,'');
 const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full'])assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_declaration' AND ("+reset.resetWhere('flow_entities',scope)+')').get().n,sql.prepare("SELECT count(*) n FROM flow_entities WHERE type='asset_declaration'").get().n,'reset scope covers all opening declarations');
 const report=await context.run(hr,()=>onboarding.GET());assert.equal(report.status,200);assert.ok(!(await report.text()).includes('password_hash'));
 const principal={user:staff,scope:'read_write',tokenId:null};const ownMcp=await catalog.executeTool('get_asset_declarations',{},base,principal);assert.ok(ownMcp.records.some(r=>r.id===record.id));await assert.rejects(()=>catalog.executeTool('asset_declaration_apply',approveDecl,base,principal));
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes('New-private-password-123'));
 let mine=await call(multiKeeper,op('submit',{items:[],noAssets:true,holderConfirmed:true}));
 assert.equal(mine.status,200);let myRecord=(await mine.json()).record;
 const correction=await call(custodian,op('return',{recordId:myRecord.id,revision:myRecord.revision,notes:'Check again'}));assert.equal(correction.status,200);myRecord=(await correction.json()).record;
 mine=await call(multiKeeper,op('submit',{recordId:myRecord.id,revision:myRecord.revision,items:[],noAssets:true,holderConfirmed:true}));assert.equal(mine.status,200);
 for(const scope of ['custodian','personnel-hr','personal']){
  const response=await context.run(multiKeeper,()=>tasks.GET(req('/api/tasks?workspace='+scope)));
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.positionWork.filter(w=>w.target==='asset-declaration:'+myRecord.id).length,scope==='custodian'?1:0);
  if(scope==='custodian'){const follow=result.positionWork.find(w=>w.sourceId===myRecord.id);assert.equal(follow.state,'awaiting_other_reviewer');assert.match(follow.title,/اصلاح‌شده/);}
  assert.ok(!result.tasks.some(t=>t.state==='open'&&t.data.sourceId===myRecord.id));
 }
 const resetRequest={mode:'reset_password',id:mid,revision:sql.prepare('SELECT revision FROM app_members WHERE id=?').get(mid).revision,temporaryPassword:'Temporary-key-123'};
 const resetCall=actor=>context.run(actor,()=>userApi.PATCH(req('/api/users','PATCH',resetRequest)));
 assert.equal((await resetCall(other)).status,403);
 let resetResponse=await resetCall(admin);assert.equal(resetResponse.status,200,await resetResponse.clone().text());
 assert.equal((await resetCall(admin)).status,409);
 cookie='';identity=null;
 assert.equal((await login.POST(req('/api/auth/login','POST',{username:form.nationalId,password:'New-private-password-123'}))).status,401);
 const temporaryLogin=await login.POST(req('/api/auth/login','POST',{username:form.nationalId,password:resetRequest.temporaryPassword}));
 assert.equal(temporaryLogin.status,200);cookie=temporaryLogin.headers.get('set-cookie').split(';')[0].split('=')[1];
 assert.equal((await auth.session(true)).mustChangePassword,true);
 const finishReset=await credentials.POST(req('/api/auth/credentials','POST',{username:form.nationalId,currentPassword:resetRequest.temporaryPassword,newPassword:'My-own-fresh-password',confirmed:true},{'x-profile-account':'local:'+mid}));
 assert.equal(finishReset.status,200,await finishReset.clone().text());
 console.log('PASS staff onboarding + assets: atomic personal account after HR approval with missing docs, no duplicate/collision/reset or role grants, forced first password and old-session revocation, self-only draft/photos and private read, numbered independent photos, staff/HR/custodian separation, review return/inbox, serial/holder guards, atomic official opening inventory and labels, retry, no-assets conflict, HTTP/MCP/FK parity.');
})().catch(e=>{console.error(e);process.exitCode=1});
