const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
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
 assert.equal((await login.POST(request('/api/auth/login','POST',body,{origin:'https://evil.test'}))).status,403);
 identity=null;assert.equal((await enter('bad')).status,401);r=await enter();assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];const oldCookie=cookie;
 let actor=await auth.session();assert.equal(actor.isAdmin,false);assert.equal(actor.username,'worker01');assert.equal(actor.permissions.write.length,0);assert.equal((await userApi.GET()).status,403);
 cookie='';identity=owner;r=await userApi.PATCH(request('/api/users','PATCH',{...m,password:'Changed-password-123'}));assert.equal(r.status,200);m=(await r.json()).member;
 cookie=oldCookie;await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';identity=null;assert.equal((await enter()).status,401);r=await enter('Changed-password-123');assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];
 assert.equal((await logout.POST(request('/api/auth/logout','POST'))).status,200);await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';
 identity=owner;r=await userApi.PATCH(request('/api/users','PATCH',{...m,status:'disabled'}));assert.equal(r.status,200);identity=null;assert.equal((await enter('Changed-password-123')).status,401);
 for(let i=0;i<11;i++)r=await enter('bad');assert.equal(r.status,429);
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM access_audit').all()).includes('Changed-password-123'));
 cookie='';identity=null;env.INITIAL_ADMIN_PASSWORD='Install-test-password-123';
 r=await login.POST(request('/api/auth/login','POST',{username:'admin',password:'wrong'}));assert.equal(r.status,401);assert.equal(sql.prepare("SELECT subject FROM app_identity WHERE id='local_admin'").get(),undefined);
 r=await login.POST(request('/api/auth/login','POST',{username:'admin',password:env.INITIAL_ADMIN_PASSWORD}));assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0].split('=')[1];assert.equal((await auth.session()).isAdmin,true);
 token=(await mint()).token;assert.equal((await load('lib/mcp/auth.ts').tokenPrincipal(token)).user.isAdmin,true);
 let admin=(await (await userApi.GET()).json()).members.find(x=>x.username==='admin');
 r=await userApi.PATCH(request('/api/users','PATCH',{...admin,password:'Replacement-admin-password'}));assert.equal(r.status,200);await assert.rejects(()=>auth.session(),e=>e.status===401);cookie='';
 assert.equal((await login.POST(request('/api/auth/login','POST',{username:'admin',password:env.INITIAL_ADMIN_PASSWORD}))).status,401);
 assert.equal((await login.POST(request('/api/auth/login','POST',{username:'admin',password:'Replacement-admin-password'}))).status,200);
 console.log('Bootstrap admin passed: no seed on bad password, administrator session and MCP, changed password persists.');
 console.log('Password accounts passed: creation, unique usernames, hashing, no secrets in audit, login, CSRF, permission enforcement, reset/session revocation, logout, disabling and rate limiting.');
})().catch(e=>{console.error(e);process.exit(1)});
