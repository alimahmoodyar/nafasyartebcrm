const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');console.error('SQL rollback',e.message);throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const printApi=load('app/api/personnel/print/route.ts');
const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/personnel/route.ts'),files=load('app/api/personnel/files/route.ts'),domain=load('lib/personnel.ts'),catalog=load('lib/mcp/tools.ts'),tasks=load('app/api/tasks/route.ts'),duties=load('lib/duties.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next};
const base='https://test.local',now=new Date().toISOString(),today=duties.dayAt(),day=duties.addDay(today,-10),next=duties.addDay(today,2);
const req=(url,b,origin=base)=>new Request(base+url,{method:b?'POST':'GET',headers:{origin,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});
function actor(id,roles=[],extra={}){const u={userId:'local:'+id,email:id+'@test.local',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],personnelRoles:roles,...extra}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'company','active',?,?,?,?)").run(id,u.email,id,u.userId,JSON.stringify(u.permissions),now,now);return u;}

const alice=actor('alice'),bob=actor('bob'),manager=actor('manager'),other=actor('other'),buyer=actor('buyer',[],{supplyRoles:['domestic']}),external=actor('external',[],{salesAgentId:'outside',salesRoles:['agent']});
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
for(const m of ['alice','bob'])seed('employee-'+m,'hr_employee',{memberId:m,state:'active',unit:'office',managerId:'manager'});
seed('employee-manager','hr_employee',{memberId:'manager',state:'active',unit:'office',managerId:'other'});
seed('material-known','material',{name:'Known',code:'123',unit:'عدد'});
const intake=load('app/api/employee-purchases/route.ts'),domain2=load('lib/employee-purchases.ts');
const body=(extra={})=>({id:crypto.randomUUID(),mode:'create',revision:0,confirmed:true,kind:'goods',title:'New test item',quantity:'2',unitName:'عدد',timing:'normal',...extra});
async function call(u,b){return ctx.run(u,()=>intake.POST(req('/api/employee-purchases',b)));}
const read=u=>ctx.run(u,()=>intake.GET(req('/api/employee-purchases')));
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
(async()=>{
const search=await ctx.run(alice,()=>intake.GET(req('/api/employee-purchases?search=Known')));assert.equal(search.status,200,await search.clone().text());assert.equal((await search.json()).materials[0].id,'material-known');
seed('delegate','hr_delegate',{managerId:'manager',memberId:'other',start:day,end:next});
let b=body(),r=await call(alice,b);assert.equal(r.status,200,await r.clone().text());assert.equal((await call(alice,b)).status,200);const id=b.id;assert.equal(row(id).data.state,'manager');
assert.equal((await (await read(bob)).json()).requests.length,0);assert.equal((await (await read(manager)).json()).requests.length,1);assert.equal((await (await read(other)).json()).requests[0].canReview,true);assert.equal((await read(external)).status,403);
assert.equal((await call(bob,body({mode:'approve',requestId:id,revision:1}))).status,404);
assert.equal((await call(manager,body({mode:'approve',requestId:id,revision:1,quantity:3}))).status,400);
assert.equal((await call(manager,body({mode:'approve',requestId:id,revision:1,quantity:1}))).status,400);
assert.equal((await call(manager,body({mode:'approve',requestId:id,revision:1,quantity:1,notes:'reduced need'}))).status,200);assert.equal(row(id).data.state,'procurement');
assert.equal((await call(manager,body({mode:'approve',requestId:id,revision:1}))).status,409);
assert.equal((await call(alice,body({requestId:id,revision:2}))).status,400);
r=await call(alice,body({materialId:'material-known'}));assert.equal(r.status,200);const known=(await r.json()).id;assert.equal(row(known).data.state,'warehouse');
r=await call(manager,body());assert.equal(r.status,200);assert.equal(row((await r.json()).id).data.state,'procurement');
assert.equal((await call(alice,body({kind:'service',expected:''}))).status,400);assert.equal((await call(alice,body({timing:'urgent',notes:''}))).status,400);assert.equal((await call(alice,body({timing:'date',due:'2026-02-30'}))).status,400);
const forbidden=await call(external,body());assert.equal(forbidden.status,403);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_balances').get().n,0);
assert.ok(sql.prepare("SELECT COUNT(*) n FROM duty_runs WHERE template_id LIKE 'employee-purchase:%'").get().n>0);
console.log('PASS employee intake: scope, current manager, direct manager route, known stock route, conditional fields, reduction, stale revision, exact retry, no stock/payment posting, work duties.');
})().catch(e=>{console.error(e);process.exit(1)});
