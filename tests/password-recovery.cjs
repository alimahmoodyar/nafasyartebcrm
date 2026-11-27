const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');

const root=path.resolve(__dirname,'..');
const sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')&&file!=='0031_password_recovery.sql').sort())
 sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
const db={
 prepare(query){
  let args=[];
  return {
   bind(...values){args=values;return this;},
   async first(){return sql.prepare(query).get(...args)||null;},
   async all(){return {results:sql.prepare(query).all(...args)};},
   async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};},
  };
 },
 async batch(statements){
  sql.exec('BEGIN');
  try{
   const results=[];
   for(const statement of statements)results.push(await statement.run());
   sql.exec('COMMIT');
   return results;
  }catch(error){sql.exec('ROLLBACK');throw error;}
 },
};
const env={TRACE_OWNER_EMAIL:'owner@example.com',DB:db};
let cookie='',smsFetch=async()=>{throw Error('Unexpected outbound request');};
const modules=new Map();
function load(file){
 const absolute=path.resolve(root,file);
 if(modules.has(absolute))return modules.get(absolute);
 const exports={};
 modules.set(absolute,exports);
 const source=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 vm.runInNewContext(source,{
  exports,
  require(name){
   if(name==='next/headers')return {cookies:async()=>({get:key=>key==='__Host-nafasyar-session'&&cookie?{value:cookie}:undefined})};
   if(name==='cloudflare:workers')return {env};
   if(name==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>null};
   if(name.startsWith('@/')||name.startsWith('.')){
    const dependency=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(absolute),name);
    return load(dependency+(path.extname(dependency)?'':'.ts'));
   }
   return require(name);
  },
  fetch:(...args)=>smsFetch(...args),Response,Request,URL,URLSearchParams,Error,SyntaxError,crypto:globalThis.crypto,Date,Intl,
  TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,AbortSignal,ReadableStream,btoa,atob,setTimeout,clearTimeout,console,
 },{filename:absolute});
 return exports;
}const auth=load('lib/authorization.ts'),login=load('app/api/auth/login/route.ts');
const base='https://test.local';
const permissions={read:['batch'],write:[],eventStages:[],finance:'none',warehouseResponsibilities:[]};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{
 method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},
 ...(body?{body:JSON.stringify(body)}:{}),
});
(async()=>{
 // Recovery uses the real routes, migrated SQLite tables and the configured SMS adapter with a fake provider.
 cookie='';
 env.SMSIR_API_KEY='synthetic-recovery-key';env.SMSIR_LINE_NUMBER='100045715000';
 const reportRoute=load('app/api/admin/sms-report/route.ts'),reportPath='/api/admin/sms-report';
 const listReport=(suffix='')=>reportRoute.GET(request(reportPath+suffix));
 const recovery=load('app/api/auth/recovery/route.ts'),authPath='/api/auth/recovery';
 const sent=[];let smsFails=false;
 smsFetch=async(url,options)=>{
  assert.equal(url,'https://api.sms.ir/v1/send/bulk');
  const data=JSON.parse(options.body);
  assert.equal(data.lineNumber,100045715000);
  assert.ok(data.MessageText.endsWith('\nلغو11'));
  sent.push({code:data.MessageText.match(/[0-9]{6}/)[0],mobile:data.Mobiles[0]});
  return Response.json(smsFails?{status:101}:{status:1,data:{messageIds:[321]}},{status:smsFails?400:200});
 };
 const recoveryPost=(action,data={},headers={})=>recovery.POST(request(authPath,'POST',{action,...data},{'cf-connecting-ip':'192.0.2.7',...headers}));
 const adminId='bootstrap-local-admin',workerId='recovery-test-worker';
 const adminPassword='Recovery-admin-current-123',workerPassword='Recovery-worker-current-123';
 const {hashPassword}=load('lib/password-auth.ts');
 env.INITIAL_ADMIN_PASSWORD=adminPassword;
 sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,'','active',?,1,'2026-01-01','2026-01-01')").run(workerId,'recovery-test@local.invalid','Recovery test',JSON.stringify(permissions));
 sql.prepare('INSERT INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,1)').run(workerId,'recovery-worker',await hashPassword(workerPassword));
 const signIn=(name,pass)=>login.POST(request('/api/auth/login','POST',{username:name,password:pass},{'cf-connecting-ip':'192.0.2.7'}));
 const useSession=async(name,pass)=>{
  const response=await signIn(name,pass);
  assert.equal(response.status,200,await response.clone().text());
  return response.headers.get('set-cookie').split(';')[0].split('=')[1];
 };
 // Upgrade an installation that already has a local administrator, employee and active session.
 const adminUsername='admin';
 const adminBeforeUpgrade=await useSession(adminUsername,adminPassword);
 cookie=adminBeforeUpgrade;
 const preMigrationStatus=await recovery.GET(request(authPath,'GET',undefined,{'x-profile-account':'local:'+adminId}));
 assert.equal(preMigrationStatus.status,503);
 assert.match((await preMigrationStatus.json()).error,/به‌روزرسانی پایگاه داده/);
 sql.exec(fs.readFileSync(path.join(root,'drizzle','0031_password_recovery.sql'),'utf8'));
 cookie=adminBeforeUpgrade;
 assert.equal((await auth.session()).isAdmin,true);
 cookie='';
 const workerMobile='09120000123',adminMobile='09120000124';
 const publicStart=(username,mobile)=>recoveryPost('reset_start',{username,mobile});
 const setup=(id,mobile,currentPassword,backupCode)=>recoveryPost('enroll_start',{mobile,currentPassword,backupCode},{'x-profile-account':'local:'+id});
 const confirmSetup=(id,token,code)=>recoveryPost('enroll_confirm',{token,code},{'x-profile-account':'local:'+id});
 const publicFinish=(token,code,newPassword,backupCode)=>recoveryPost('reset_confirm',{token,code,newPassword,backupCode});
 assert.equal((await recovery.GET(request(authPath))).status,401);
 assert.equal((await recoveryPost('reset_start',{username:'admin',mobile:adminMobile},{origin:'https://wrong.test'})).status,403);
 assert.equal((await recoveryPost('reset_start',{username:'',mobile:adminMobile})).status,400);
 for(const name of ['recovery-worker','unknown-test','admin']){
  const publicReply=await publicStart(name,workerMobile);assert.equal(publicReply.status,200);
  const result=await publicReply.json();assert.deepEqual(Object.keys(result),['token']);assert.match(result.token,/^[a-f0-9]{64}$/);
 }
 assert.equal(sent.length,0);
 assert.equal((await listReport()).status,401);
 const workerCookie=await useSession('recovery-worker',workerPassword);cookie=workerCookie;
 assert.equal((await listReport()).status,403);
 assert.equal((await setup(adminId,workerMobile,workerPassword)).status,409);
 assert.equal((await setup(workerId,workerMobile,'wrong')).status,403);
 const line=env.SMSIR_LINE_NUMBER;delete env.SMSIR_LINE_NUMBER;
 assert.equal((await setup(workerId,workerMobile,workerPassword)).status,503);
 env.SMSIR_LINE_NUMBER=line;
 smsFails=true;assert.equal((await setup(workerId,workerMobile,workerPassword)).status,503);smsFails=false;
 assert.equal(sql.prepare('SELECT recovery_mobile FROM password_accounts WHERE member_id=?').get(workerId).recovery_mobile,null);
 const workerChallenge=await setup(workerId,'۰۹۱۲۰۰۰۰۱۲۳',workerPassword);
 assert.equal(workerChallenge.status,200,await workerChallenge.clone().text());assert.equal(sent.at(-1).mobile,workerMobile);
 const workerProof=await workerChallenge.json(),workerCode=sent.at(-1).code;
 assert.equal((await confirmSetup(workerId,workerProof.token,workerCode==='000000'?'000001':'000000')).status,400);
 assert.deepEqual(await (await confirmSetup(workerId,workerProof.token,workerCode)).json(),{mobileLast4:'0123'});
 assert.equal((await confirmSetup(workerId,workerProof.token,workerCode)).status,400);
 const workerStatus=await recovery.GET(request(authPath,'GET',undefined,{'x-profile-account':'local:'+workerId}));
 assert.deepEqual(await workerStatus.json(),{mobileLast4:'0123',requiresBackup:false});
 cookie='';
 const beforeMismatch=sent.length;
 const mismatchReply=await publicStart('recovery-worker',adminMobile);
 assert.equal(mismatchReply.status,200);
 assert.deepEqual(Object.keys(await mismatchReply.json()),['token']);
 assert.equal(sent.length,beforeMismatch);
 const expiring=await (await publicStart('recovery-worker',workerMobile)).json();
 sql.prepare("UPDATE password_recovery_challenges SET expires='2000-01-01' WHERE member_id=?").run(workerId);
 assert.equal((await publicFinish(expiring.token,sent.at(-1).code,'Recovery-worker-next-123')).status,400);
 const workerReset=await (await publicStart('recovery-worker',workerMobile)).json();
 const finishWorker=()=>publicFinish(workerReset.token,sent.at(-1).code,'Recovery-worker-next-123');
 const result=await finishWorker();assert.equal(result.status,200,await result.clone().text());assert.deepEqual(await result.json(),{saved:true});
 assert.equal((await finishWorker()).status,400);
 cookie=workerCookie;await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';
 assert.equal((await signIn('recovery-worker',workerPassword)).status,401);
 await useSession('recovery-worker','Recovery-worker-next-123');
 const attempts=await (await publicStart('recovery-worker',workerMobile)).json(),lastCode=sent.at(-1).code;
 for(let i=0;i<5;i++){
  assert.equal((await publicFinish(attempts.token,lastCode==='000000'?'000001':'000000','Recovery-worker-other-123')).status,400);
 }
 assert.equal((await publicFinish(attempts.token,lastCode,'Recovery-worker-other-123')).status,400); cookie=await useSession(adminUsername,adminPassword);
 assert.equal((await setup(adminId,workerMobile,adminPassword)).status,409);
 const adminStart=await setup(adminId,adminMobile,adminPassword);
 assert.equal(adminStart.status,200,await adminStart.clone().text());
 const adminSetup=await (await confirmSetup(adminId,(await adminStart.json()).token,sent.at(-1).code)).json();
 assert.match(adminSetup.backupCode,/^(?:[a-f0-9]{8}-){3}[a-f0-9]{8}$/);
 assert.equal((await setup(adminId,'09120000125',adminPassword)).status,403);
 const adminStatus=await recovery.GET(request(authPath,'GET',undefined,{'x-profile-account':'local:'+adminId}));
 assert.deepEqual(await adminStatus.json(),{mobileLast4:'0124',requiresBackup:true});
 cookie='';
 const adminReset=await (await publicStart(adminUsername,adminMobile)).json(),adminCode=sent.at(-1).code;
 assert.equal((await publicFinish(adminReset.token,adminCode,'Recovery-admin-next-123')).status,400);
 const completeAdmin=await publicFinish(adminReset.token,adminCode,'Recovery-admin-next-123',adminSetup.backupCode);
 assert.equal(completeAdmin.status,200,await completeAdmin.clone().text());
 const {backupCode:rotated}=await completeAdmin.json();assert.ok(rotated);assert.notEqual(rotated,adminSetup.backupCode);
 const secondAdmin=await (await publicStart(adminUsername,adminMobile)).json();
 assert.equal((await publicFinish(secondAdmin.token,sent.at(-1).code,'Recovery-admin-another-123',adminSetup.backupCode)).status,400);
 await useSession(adminUsername,'Recovery-admin-next-123');
 cookie=await useSession(adminUsername,'Recovery-admin-next-123');
 const unverified=(await (await listReport('?purpose=recovery_reset&last4=0123')).json()).entries;
 assert(unverified.some(x=>x.outcome==='recovery_mobile_unverified'&&x.last4==='0123'&&x.messageId===undefined));
 const wrongNumber=(await (await listReport('?purpose=recovery_reset&last4='+encodeURIComponent('۰۱۲۴'))).json()).entries;
 assert(wrongNumber.some(x=>x.outcome==='recovery_mobile_mismatch'&&x.last4==='0124'&&x.messageId===undefined));
 const filtered=await listReport('?purpose=recovery_enroll&last4='+encodeURIComponent('۰۱۲۳'));
 assert.equal(filtered.status,200);assert.match(filtered.headers.get('cache-control'),/no-store/);
 const {entries}=await filtered.json();
 assert(entries.every(x=>x.last4==='0123'&&x.purpose==='recovery_enroll'));
 assert(entries.some(x=>x.outcome==='invalid_password'));
 assert(entries.some(x=>x.outcome==='config_unavailable'));
 assert(entries.some(x=>x.outcome==='provider_rejected'&&x.httpStatus===400&&x.panelCode===101));
 const accepted=entries.find(x=>x.outcome==='provider_accepted');
 assert.equal(accepted.messageId,321);
 assert.equal((await listReport('?entry='+entries.find(x=>x.outcome==='invalid_password').id)).status,404);
 assert.equal((await listReport('?last4='+workerMobile)).status,400);
 smsFetch=async(url,options)=>{
  assert.equal(url,'https://api.sms.ir/v1/send/321');
  assert.equal(options.headers['X-API-KEY'],env.SMSIR_API_KEY);
  assert.equal(options.redirect,'error');
  return Response.json({status:1,data:{messageId:321,deliveryState:2,mobile:workerMobile,messageText:workerCode}});
 };
 const delivered=await listReport('?entry='+accepted.id);
 assert.deepEqual(await delivered.json(),{deliveryState:2});
 const storedReports=sql.prepare("SELECT data FROM flow_entities WHERE type='sms_attempt_report'").all().map(row=>JSON.parse(row.data));
 const rawReports=JSON.stringify(storedReports);
 for(const secret of [adminSetup.backupCode,workerMobile,adminMobile,workerProof.token,workerPassword,env.SMSIR_API_KEY])assert.ok(!rawReports.includes(secret));
 assert.ok(!rawReports.includes(JSON.stringify(workerCode)));
 const reportKeys=['purpose','outcome','last4','httpStatus','panelCode','messageId'];
 assert(storedReports.every(entry=>Object.keys(entry).every(k=>reportKeys.includes(k))));
 const domain=load('lib/sms-report.ts');
 for(let i=0;i<26;i++)await domain.withSmsReport('admin_test',async record=>record('provider_accepted',{mobile:workerMobile,messageId:i+500}));
 const firstPage=await (await listReport('?purpose=admin_test')).json();
 assert.equal(firstPage.entries.length,25);assert.ok(firstPage.nextCursor);
 const secondPage=await (await listReport('?purpose=admin_test&before='+encodeURIComponent(firstPage.nextCursor))).json();
 assert.equal(secondPage.entries.length,1);assert.equal(secondPage.nextCursor,null);
 assert.ok(!firstPage.entries.some(x=>x.id===secondPage.entries[0].id));
 const auditLog=JSON.stringify(sql.prepare('SELECT * FROM access_audit').all());
 assert.ok(!auditLog.includes(adminSetup.backupCode)&&!auditLog.includes(adminMobile)&&!auditLog.includes(workerMobile));
 console.log('Password recovery passed: confirmed mobile, protected admin backup and rotation, SMS adapter, generic replies, expiry/replay, session revocation, SMS report permissions, preflight/rejection/acceptance diagnostics, safe delivery status, pagination and no recovery secrets in audit.');
})().catch(e=>{console.error(e);process.exit(1)});
