const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
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
(async()=>{
 identity=owner;await auth.session();
 const body={username:'Worker01',password:'Test-password-123',name:'Worker',unit:'انبار',status:'active',permissions};
 let r=await userApi.POST(request('/api/users','POST',body));assert.equal(r.status,201);let m=(await r.json()).member;assert.equal(m.username,'worker01');assert.equal(m.email,'');assert.ok(!JSON.stringify(m).includes(body.password));
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes(body.password));assert.ok(sql.prepare('SELECT password_hash FROM password_accounts').get().password_hash.startsWith('pbkdf2-sha256'));
 assert.equal((await userApi.POST(request('/api/users','POST',body))).status,409);
 r=await userApi.PATCH(request('/api/users','PATCH',{...m,unit:'بازرگانی'}));assert.equal(r.status,400);
 for(const unit of ['بازرگانی — داخلی','بازرگانی — خارجی']) {
  r=await userApi.PATCH(request('/api/users','PATCH',{...m,unit}));assert.equal(r.status,200);m=(await r.json()).member;
  assert.equal(m.unit,unit);assert.equal(JSON.stringify(m.permissions),JSON.stringify(load('lib/permissions.ts').validatePermissions(permissions)));
  assert.equal((await (await userApi.GET()).json()).members.find(x=>x.id===m.id).unit,unit);
 }

 assert.equal((await login.POST(request('/api/auth/login','POST',body,{origin:'https://evil.test'}))).status,403);
 identity=null;assert.equal((await enter('bad')).status,401);r=await enter();assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];const oldCookie=cookie;
 sql.prepare('UPDATE password_accounts SET must_change=0 WHERE member_id=?').run(m.id); // onboarded fixture; forced flow is tested separately
 let actor=await auth.session();assert.equal(actor.isAdmin,false);assert.equal(actor.username,'worker01');assert.equal(actor.permissions.write.length,0);assert.equal((await userApi.GET()).status,403);
 cookie='';identity=owner;r=await userApi.PATCH(request('/api/users','PATCH',{...m,password:'Changed-password-123'}));assert.equal(r.status,200);m=(await r.json()).member;
 cookie=oldCookie;await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';identity=null;assert.equal((await enter()).status,401);r=await enter('Changed-password-123');assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];
 assert.equal((await logout.POST(request('/api/auth/logout','POST'))).status,200);await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';
 identity=owner;r=await userApi.PATCH(request('/api/users','PATCH',{...m,status:'disabled'}));assert.equal(r.status,200);identity=null;assert.equal((await enter('Changed-password-123')).status,401);
 for(let i=0;i<11;i++)r=await enter('bad');assert.equal(r.status,429);
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes('Changed-password-123'));
 cookie='';identity=null;env.INITIAL_ADMIN_PASSWORD='Install-test-password-123';
 r=await login.POST(request('/api/auth/login','POST',{username:'admin',password:'wrong'}));assert.equal(r.status,401);assert.equal(sql.prepare("SELECT subject FROM app_identity WHERE id='local_admin'").get(),undefined);
 r=await login.POST(request('/api/auth/login','POST',{username:'admin',password:env.INITIAL_ADMIN_PASSWORD}));assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];assert.equal((await auth.session({allowPasswordChange:true})).mustChangePassword,true);sql.prepare("UPDATE password_accounts SET must_change=0 WHERE member_id='bootstrap-local-admin'").run();assert.equal((await auth.session()).isAdmin,true);
 token=(await mint()).token;assert.equal((await load('lib/mcp/auth.ts').tokenPrincipal(token)).user.isAdmin,true);
 let admin=(await (await userApi.GET()).json()).members.find(x=>x.username==='admin');
 r=await userApi.PATCH(request('/api/users','PATCH',{...admin,password:'Replacement-admin-password'}));assert.equal(r.status,200);await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';
 assert.equal((await login.POST(request('/api/auth/login','POST',{username:'admin',password:env.INITIAL_ADMIN_PASSWORD}))).status,401);
 assert.equal((await login.POST(request('/api/auth/login','POST',{username:'admin',password:'Replacement-admin-password'}))).status,200);

 // Edit/delete lifecycle: same API used by UI and MCP, real SQLite transactions.
 cookie='';identity=owner;sql.prepare('DELETE FROM login_attempts').run();
 const createLocal=async username=>(await (await userApi.POST(request('/api/users','POST',{...body,username}))).json()).member;
 let target=await createLocal('remove-me');const other=await createLocal('keep-me');
 const enterNamed=async username=>{sql.prepare('UPDATE password_accounts SET must_change=0 WHERE username=?').run(username);cookie='';identity=null;const r=await login.POST(request('/api/auth/login','POST',{username,password:body.password}));assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];return cookie;};
 const seedMemberToken=async()=>{const token='nfy_'+require('node:crypto').randomBytes(32).toString('hex'),id=crypto.randomUUID(),who=await auth.session();sql.prepare('INSERT INTO mcp_tokens(id,token_hash,subject,email,name,scope,expires,created) VALUES(?,?,?,?,?,?,?,?)').run(id,await load('lib/mcp/auth.ts').tokenHash(token),who.userId,who.email,'fixture','read_write','2099-01-01','2026-10-03');return {id,token};};
 const firstSession=await enterNamed('remove-me');const firstToken=await seedMemberToken();assert.equal((await load('lib/mcp/auth.ts').tokenPrincipal(firstToken.token)).user.username,'remove-me');
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{id:other.id,revision:other.revision,confirmed:true}))).status,403,'staff denied');
 cookie='';identity=owner;
 const oldRevision=target.revision;
 r=await userApi.PATCH(request('/api/users','PATCH',{...target,username:'renamed-user',name:'Edited name',unit:'تولید'}));assert.equal(r.status,200);target=(await r.json()).member;assert.equal(target.username,'renamed-user');assert.equal(target.name,'Edited name');
 cookie=firstSession;await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';await assert.rejects(()=>load('lib/mcp/auth.ts').tokenPrincipal(firstToken.token));identity=owner;
 assert.equal((await userApi.PATCH(request('/api/users','PATCH',{...target,revision:oldRevision,name:'Stale'}))).status,409);
 const auditCount=()=>sql.prepare('SELECT count(*) n FROM access_audit').get().n;
 let before=auditCount();r=await userApi.PATCH(request('/api/users','PATCH',{...target,username:'keep-me',name:'Must roll back'}));assert.equal(r.status,409);assert.equal(auditCount(),before);assert.equal(sql.prepare('SELECT name FROM app_members WHERE id=?').get(target.id).name,'Edited name');
 const liveCookie=await enterNamed('renamed-user'),liveToken=await seedMemberToken();cookie='';identity=owner;
 sql.prepare("INSERT INTO mcp_streams(id,token_id,expires,lease,lease_until) VALUES('delete-stream',?,'2099-01-01','lease','2099-01-01')").run(liveToken.id);
 const deleteBody={id:target.id,revision:target.revision,confirmed:true};
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{...deleteBody,accountName:'wrong name'}))).status,409);
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{...deleteBody,confirmed:false}))).status,400);
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',deleteBody,{origin:'https://evil.test'}))).status,403);
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',deleteBody,{'x-assistant-account':'wrong-account'}))).status,409);
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{...deleteBody,revision:oldRevision}))).status,409);
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{id:admin.id,revision:admin.revision,confirmed:true}))).status,403,'local admin protected from other admin');
 assert.equal((await userApi.PATCH(request('/api/users','PATCH',{...admin,status:'disabled'}))).status,403);
 assert.equal((await (await userApi.GET()).json()).members.find(m=>m.id===admin.id).canDelete,false);
 // An existing duty FK and attribution must survive removal.
 sql.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,due,state,data,created,updated) VALUES('historical-duty','template','2026-10-03',?,'2026-10-04','completed','{}','2026-10-03','2026-10-03')").run(target.id);
 sql.exec("CREATE TRIGGER reject_test_delete BEFORE UPDATE ON app_members WHEN NEW.status='deleted' BEGIN SELECT RAISE(ABORT,'SQLITE_TEST_FAILURE'); END");
 before=auditCount();assert.equal((await userApi.DELETE(request('/api/users','DELETE',deleteBody))).status,503);assert.equal(auditCount(),before);assert.equal(sql.prepare('SELECT status FROM app_members WHERE id=?').get(target.id).status,'active');assert.equal((await load('lib/mcp/auth.ts').tokenPrincipal(liveToken.token)).user.username,'renamed-user');sql.exec('DROP TRIGGER reject_test_delete');
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',deleteBody))).status,200);
 assert.equal(sql.prepare("SELECT count(*) n FROM mcp_streams WHERE id='delete-stream'").get().n,0);
 before=auditCount();assert.equal((await userApi.DELETE(request('/api/users','DELETE',deleteBody))).status,200);assert.equal(auditCount(),before,'retry is idempotent');
 assert.ok(!(await (await userApi.GET()).json()).members.some(m=>m.id===target.id));assert.equal(sql.prepare("SELECT assignee FROM duty_runs WHERE id='historical-duty'").get().assignee,target.id);assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM password_sessions WHERE member_id=?').get(target.id).n,0);assert.equal(sql.prepare('SELECT status FROM app_members WHERE id=?').get(other.id).status,'active');
 assert.equal((await userApi.PATCH(request('/api/users','PATCH',{...target,status:'active'}))).status,404);
 assert.equal((await userApi.POST(request('/api/users','POST',{...body,username:'renamed-user'}))).status,409,'deleted identity cannot be reused');
 cookie=liveCookie;await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';await assert.rejects(()=>load('lib/mcp/auth.ts').tokenPrincipal(liveToken.token));identity=null;
 assert.equal((await login.POST(request('/api/auth/login','POST',{username:'renamed-user',password:body.password}))).status,401);
 identity=owner;
 const legacy=(await (await userApi.POST(request('/api/users','POST',{email:'legacy@example.com',name:'Legacy',unit:'انبار',status:'active',permissions}))).json()).member;
 identity={userId:'legacy-subject',email:'legacy@example.com',displayName:'Legacy'};await auth.session();identity=owner;
 assert.equal((await userApi.DELETE(request('/api/users','DELETE',{id:legacy.id,revision:legacy.revision,confirmed:true}))).status,200);
 await assert.rejects(()=>auth.resolveIdentity({userId:'legacy-subject',email:'legacy@example.com',displayName:'Legacy'}),e=>e.status===403);
 // MCP must enforce the same explicit confirmation and role checks.
 const ownerPrincipal={user:await auth.session(),scope:'read_write',tokenId:null};
 await assert.rejects(()=>catalog.executeTool('delete_user',{id:other.id,revision:other.revision,confirmed:false},base,ownerPrincipal));
 const updated=await catalog.executeTool('update_user',{id:other.id,revision:other.revision,email:'',name:'Via MCP',unit:other.unit,status:'active',permissions:other.permissions,confirmed:true},base,ownerPrincipal);assert.equal(updated.member.name,'Via MCP');
 assert.equal((await catalog.executeTool('delete_user',{id:other.id,revision:updated.member.revision,confirmed:true},base,ownerPrincipal)).deleted,true);
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes(body.password));
 console.log('Account lifecycle passed: editing, rename/revocation, duplicate rollback, stale revision, deletion confirmation/roles/origin, protected admin, legacy accounts, retained history, failed-delete rollback, MCP parity and retry.');
 console.log('Bootstrap admin passed: no seed on bad password, administrator session and MCP, changed password persists.');
 console.log('Password accounts passed: creation, unique usernames, hashing, no secrets in audit, login, CSRF, permission enforcement, reset/session revocation, logout, disabling and rate limiting.');
})().catch(e=>{console.error(e);process.exit(1)});
