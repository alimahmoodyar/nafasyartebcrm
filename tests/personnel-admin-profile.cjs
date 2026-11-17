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
 const auth=load('lib/authorization.ts'),review=load('lib/profile-review.ts'),profiles=load('lib/role-profiles.ts'),profileApi=load('app/api/role-profiles/route.ts'),personnel=load('app/api/personnel/route.ts');
 assert.equal(profiles.roleProfiles.filter(r=>r.id==='personnel-hr').length,1);
 const selected=await ctx.run(admin,()=>profileApi.POST(request('/api/role-profiles',{id:crypto.randomUUID(),confirmed:true,mode:'select_profile',profileId:'personnel-hr'})));assert.equal(selected.status,200,await selected.text());cookieValues[review.profileReviewCookie]='personnel-hr';
 const position=await ctx.run(admin,()=>auth.session());assert.equal(position.userId,'owner');assert.equal(position.isAdmin,false);assert.deepEqual(Array.from(position.permissions.personnelRoles),['hr']);assert.ok(!position.permissions.assetRoles?.includes('custodian'));
 const r=await ctx.run(admin,()=>personnel.GET(new Request('https://test.local/api/personnel'))),j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.deepEqual(Array.from(j.roles),['hr']);assert.deepEqual(Object.keys(j.employmentTypes),['تمام‌وقت','پاره‌وقت','کارآموز']);assert.equal(j.me,'');assert.equal(sql.prepare('SELECT count(*) AS n FROM app_members').get().n,0,'role review creates no employee');
 const created=await ctx.run(admin,()=>personnel.POST(request('/api/personnel',{id:crypto.randomUUID(),confirmed:true,revision:0,notes:'',mode:'personnel_create',name:'Contract before account',location:'Office',employment:'تمام‌وقت',start:'2026-01-01',nationalId:'0123456789',birthDate:'1990-01-01',maritalStatus:'single',mobile:'09121111111',address:'Office',emergencyContact:'Contact',bankAccount:'IR220000000000000000000001'})));assert.equal(created.status,200);const employeeId=(await created.json()).id,person=row(employeeId);
 const approved=await ctx.run(admin,()=>personnel.POST(request('/api/personnel',{id:crypto.randomUUID(),confirmed:true,revision:person.revision,notes:'',mode:'personnel_complete',recordId:employeeId})));assert.equal(approved.status,200);
 const contractId=crypto.randomUUID(),contract=await ctx.run(admin,()=>personnel.POST(request('/api/personnel',{id:contractId,confirmed:true,revision:0,notes:'',mode:'contract_save',memberId:person.data.memberId,start:'2026-01-01',end:'2026-12-31',baseSalary:'120000000',salaryBasis:'monthly'})));assert.equal(contract.status,200);assert.equal(row(contractId).data.state,'active');assert.equal(row(contractId).data.finalizedBy,'owner');assert.equal(row(contractId).data.history.at(-1).actor,'owner');assert.equal(sql.prepare('SELECT count(*) AS n FROM app_members').get().n,0,'HR role-profile finalization never invents an employee account');
 const forbidden={...position,userId:'fake',isAdmin:false};await assert.rejects(()=>ctx.run(forbidden,()=>load('lib/personnel.ts').hrActor(forbidden)),/انتخاب پروفایل فقط برای مدیر/);
 console.log('PASS administrative role profile: existing HR grant, actual actor identity, no fake employee/admin privilege, shared API and forged review denial');
})().catch(e=>{console.error(e);process.exitCode=1});
