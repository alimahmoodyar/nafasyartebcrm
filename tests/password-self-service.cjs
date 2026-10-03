let beforeBatch=null;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const run=beforeBatch;beforeBatch=null;run();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),PASSWORD_VAULT_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
let cookie="";const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='next/headers')return {cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})};if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const userApi=load('app/api/users/route.ts'),login=load('app/api/auth/login/route.ts'),logout=load('app/api/auth/logout/route.ts');
const permissions={read:['batch'],write:[],eventStages:[],finance:'none'};
async function enter(pass='Test-password-123'){return login.POST(request('/api/auth/login','POST',{username:'worker01',password:pass}));}
const ownPassword=load('app/api/auth/password/route.ts'),reveal=load('app/api/users/password/route.ts'),sessionApi=load('app/api/session/route.ts');
const setCookie=r=>{cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];return cookie;};
async function signIn(username,password){cookie='';identity=null;const r=await login.POST(request('/api/auth/login','POST',{username,password}));assert.equal(r.status,200,await r.clone().text());setCookie(r);return r;}
const change=(currentPassword,newPassword,repeatPassword=newPassword,extra={},headers={})=>ownPassword.POST(request('/api/auth/password','POST',{currentPassword,newPassword,repeatPassword,confirmed:true,...extra},headers));
const show=(member,adminPassword,extra={},headers={})=>reveal.POST(request('/api/users/password','POST',{id:member.id,revision:member.revision,adminPassword,confirmed:true,...extra},headers));
(async()=>{
 const migrationDb=new DatabaseSync(':memory:');
 for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')&&f<'0017').sort())migrationDb.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
 for(const [id,status] of [['existing','active'],['removed','deleted']]){migrationDb.prepare('INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,?,?,?,?,?)').run(id,id+'@test.local',id,'unit',status,'{}','2026-10-03','2026-10-03');migrationDb.prepare('INSERT INTO password_accounts(member_id,username,password_hash) VALUES(?,?,?)').run(id,id,'EXISTING-HASH');}
 migrationDb.exec(fs.readFileSync(path.join(root,'drizzle/0017_password_self_service.sql'),'utf8'));
 assert.equal(migrationDb.prepare("SELECT must_change FROM password_accounts WHERE member_id='existing'").get().must_change,1);assert.equal(migrationDb.prepare("SELECT must_change FROM password_accounts WHERE member_id='removed'").get().must_change,0);assert.equal(migrationDb.prepare("SELECT password_hash FROM password_accounts WHERE member_id='existing'").get().password_hash,'EXISTING-HASH');assert.equal(migrationDb.prepare("SELECT password_ciphertext FROM password_accounts WHERE member_id='existing'").get().password_ciphertext,null);migrationDb.close();
 const initial='Initial-admin-123',adminPassword='Private-admin-987',initialStaff='Initial-staff-123',staffPassword='Chosen-staff-987';
 env.INITIAL_ADMIN_PASSWORD=initial;
 await signIn('admin',initial);const initialCookie=cookie;
 let u=(await (await sessionApi.GET()).json());assert.equal(u.mustChangePassword,true);assert.equal(u.isAdmin,true);
 await assert.rejects(()=>auth.session(),e=>e.status===428);assert.equal((await userApi.GET()).status,428);assert.equal((await ownPassword.GET()).status,200);
 let r=await change('wrong',adminPassword);assert.equal(r.status,403);
 assert.equal((await change(initial,adminPassword,'mismatch')).status,400);
 assert.equal((await change(initial,initial)).status,400);
 assert.equal((await change(initial,adminPassword,adminPassword,{memberId:'another'})).status,400);
 assert.equal((await change(initial,adminPassword,adminPassword,{}, {origin:'https://evil.test'})).status,403);
 assert.equal((await change(initial,adminPassword,adminPassword,{}, {'x-assistant-account':'wrong'})).status,409);
 r=await change(initial,adminPassword);assert.equal(r.status,200,await r.clone().text());assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.ok(!(await r.clone().text()).includes(adminPassword));
 cookie=initialCookie;await assert.rejects(()=>auth.session(),e=>e.status===401);
 await signIn('admin',adminPassword);assert.equal((await auth.session()).mustChangePassword,false);const adminCookie=cookie;
 let member=(await (await userApi.POST(request('/api/users','POST',{username:'employee',password:initialStaff,name:'Employee',unit:'تولید',status:'active',permissions}))).json()).member;
 assert.equal(member.mustChangePassword,true);assert.equal(member.hasStoredPassword,true);
 let raw=sql.prepare('SELECT * FROM password_accounts WHERE member_id=?').get(member.id);assert.notEqual(raw.password_ciphertext,initialStaff);assert.ok(raw.password_ciphertext.startsWith('v1.'));
 let publicList=await (await userApi.GET()).text();assert.ok(!publicList.includes('password_hash'));assert.ok(!publicList.includes('password_ciphertext'));assert.ok(!publicList.includes(initialStaff));
 r=await show(member,adminPassword);assert.equal(r.status,200);assert.equal((await r.json()).password,initialStaff);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal(sql.prepare("SELECT count(*) n FROM access_audit WHERE action='view_member_password'").get().n,1);
 assert.equal((await show(member,adminPassword,{confirmed:false})).status,400);
 assert.equal((await show(member,adminPassword,{}, {'x-assistant-account':'other'})).status,409);
 assert.equal((await show({...member,revision:0},adminPassword)).status,409);
 assert.equal((await show(member,adminPassword,{}, {origin:'https://evil.test'})).status,403);
 for(let i=0;i<6;i++)r=await show(member,'bad-proof');assert.equal(r.status,429);sql.prepare('DELETE FROM login_attempts').run();
 await signIn('employee',initialStaff);const staffCookie=cookie;
 assert.equal((await show(member,adminPassword)).status,428,'forced user cannot access admin API');
 assert.equal((await load('app/api/records/route.ts').GET(request('/api/records'))).status,428,'business reads blocked at server');
 assert.equal((await change(initialStaff,staffPassword)).status,200);await assert.rejects(()=>auth.session(),e=>e.status===401);
 await signIn('employee',staffPassword);assert.equal((await auth.session()).isAdmin,false);assert.equal((await show(member,adminPassword)).status,403,'ordinary staff cannot reveal even own password');
 const employeeActor=await auth.session();const before=sql.prepare('SELECT version,password_hash,password_ciphertext FROM password_accounts WHERE member_id=?').get(member.id);
 // Missing key must fail before writing credentials.
 const vaultKey=env.PASSWORD_VAULT_KEY;delete env.PASSWORD_VAULT_KEY;assert.equal((await change(staffPassword,'Next-staff-password')).status,503);env.PASSWORD_VAULT_KEY=vaultKey;assert.deepEqual(sql.prepare('SELECT version,password_hash,password_ciphertext FROM password_accounts WHERE member_id=?').get(member.id),before);
 // Transaction failure must roll back hash, ciphertext, flag, audit and sessions.
 const auditBefore=sql.prepare('SELECT count(*) n FROM access_audit').get().n;
 sql.exec("CREATE TRIGGER fail_password_change BEFORE UPDATE ON app_members BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END");
 assert.equal((await change(staffPassword,'Next-staff-password')).status,503);sql.exec('DROP TRIGGER fail_password_change');assert.deepEqual(sql.prepare('SELECT version,password_hash,password_ciphertext FROM password_accounts WHERE member_id=?').get(member.id),before);assert.equal(sql.prepare('SELECT count(*) n FROM access_audit').get().n,auditBefore);assert.equal((await auth.session()).userId,employeeActor.userId);
 cookie=adminCookie;member=(await (await userApi.GET()).json()).members.find(m=>m.id===member.id);
 r=await show(member,adminPassword);assert.equal(r.status,200);assert.equal((await r.json()).password,staffPassword);
 // A broken cipher/key and an audit failure must never reveal a value.
 const cipher=sql.prepare('SELECT password_ciphertext FROM password_accounts WHERE member_id=?').get(member.id).password_ciphertext;
 env.PASSWORD_VAULT_KEY=require('node:crypto').randomBytes(32).toString('base64');assert.equal((await show(member,adminPassword)).status,503);env.PASSWORD_VAULT_KEY=vaultKey;
 sql.prepare('UPDATE password_accounts SET password_ciphertext=? WHERE member_id=?').run('v1.corrupt.invalid',member.id);assert.equal((await show(member,adminPassword)).status,503);sql.prepare('UPDATE password_accounts SET password_ciphertext=? WHERE member_id=?').run(cipher,member.id);
 sql.exec("CREATE TRIGGER fail_reveal_audit BEFORE INSERT ON access_audit WHEN NEW.action='view_member_password' BEGIN SELECT RAISE(ABORT,'AUDIT_FAILURE'); END");assert.equal((await show(member,adminPassword)).status,503);sql.exec('DROP TRIGGER fail_reveal_audit');
 // Legacy hashes cannot be recovered; do not fabricate a password.
 sql.prepare('UPDATE password_accounts SET password_ciphertext=NULL WHERE member_id=?').run(member.id);assert.equal((await show(member,adminPassword)).status,409);sql.prepare('UPDATE password_accounts SET password_ciphertext=? WHERE member_id=?').run(cipher,member.id);
 const adminActor=await auth.session();await load('lib/mcp/context.ts').mcpActor.run(adminActor,async()=>assert.equal((await show(member,adminPassword)).status,403,'MCP cannot call plaintext endpoint'));
 r=await userApi.PATCH(request('/api/users','PATCH',{...member,password:'Admin-reset-password'}));assert.equal(r.status,200);member=(await r.json()).member;assert.equal(member.mustChangePassword,true);assert.equal((await (await show(member,adminPassword)).json()).password,'Admin-reset-password');
 await signIn('employee','Admin-reset-password');assert.equal((await (await sessionApi.GET()).json()).mustChangePassword,true);await assert.rejects(()=>auth.session(),e=>e.status===428);
 const staffToken='nfy_'+require('node:crypto').randomBytes(32).toString('hex');sql.prepare('INSERT INTO mcp_tokens(id,token_hash,subject,email,name,scope,expires,created) VALUES(?,?,?,?,?,?,?,?)').run('staff-fixture-token',await load('lib/mcp/auth.ts').tokenHash(staffToken),'local:'+member.id,'','fixture','read_write','2099-01-01','2026-10-03');await assert.rejects(()=>load('lib/mcp/auth.ts').tokenPrincipal(staffToken),e=>e.status===428);
 assert.equal((await change('Admin-reset-password','Staff-final-password')).status,200);assert.equal(sql.prepare("SELECT revoked FROM mcp_tokens WHERE id='staff-fixture-token'").get().revoked,1);
 await signIn('employee','Staff-final-password');const principal={user:await auth.session(),scope:'read_write',tokenId:null};
 assert.equal((await catalog.executeTool('get_password_account_status',{},base,principal)).canChange,true);
 assert.equal((await catalog.executeTool('change_own_password',{currentPassword:'Staff-final-password',newPassword:'Via-secure-client-123',repeatPassword:'Via-secure-client-123',confirmed:true},base,principal)).changed,true);
 const policy=load('lib/assistant-policy.ts');assert.equal(policy.assistantWriteNames.has('change_own_password'),false);assert.equal(catalog.tools.some(t=>t.name.includes('reveal_password')),false);
 await signIn('employee','Via-secure-client-123');
 const priorVersion=sql.prepare('SELECT version,password_hash FROM password_accounts WHERE member_id=?').get(member.id),priorAudit=sql.prepare('SELECT count(*) n FROM access_audit').get().n;
 beforeBatch=()=>{sql.prepare('UPDATE password_accounts SET version=version+1 WHERE member_id=?').run(member.id);sql.prepare('UPDATE app_members SET revision=revision+1 WHERE id=?').run(member.id);};
 assert.equal((await change('Via-secure-client-123','Concurrent-password-123')).status,409);assert.equal(sql.prepare('SELECT password_hash FROM password_accounts WHERE member_id=?').get(member.id).password_hash,priorVersion.password_hash);assert.equal(sql.prepare('SELECT count(*) n FROM access_audit').get().n,priorAudit);
 cookie=adminCookie;member=(await (await userApi.GET()).json()).members.find(m=>m.id===member.id);
 assert.equal((await (await show(member,adminPassword)).json()).password,'Via-secure-client-123');
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{id:member.id,revision:member.revision,confirmed:true}))).status,200);assert.equal(sql.prepare('SELECT password_ciphertext FROM password_accounts WHERE member_id=?').get(member.id).password_ciphertext,null);
 cookie='';identity=owner;assert.equal((await ownPassword.GET()).status,200);assert.equal((await change('anything','Another-password')).status,400);
 const audit=JSON.stringify(sql.prepare('SELECT * FROM access_audit').all());for(const secret of [initial,adminPassword,initialStaff,staffPassword,'Admin-reset-password','Via-secure-client-123',cipher])assert.ok(!audit.includes(secret),'audit contains a secret');
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 console.log('Password self-service passed: forced first change/API+MCP gate, current proof, account isolation, different/matching new password, secret encryption, reauthenticated audited reveal, role denial, rate limit, missing key/corruption/audit failure, rollback, reset enforcement, session/token revocation, secure MCP change and zero audit leaks.');
})().catch(e=>{console.error(e);process.exit(1)});
