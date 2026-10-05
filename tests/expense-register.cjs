const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{for(const s of stmts)await s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
let user={userId:'owner',name:'Owner',isAdmin:true,permissions:{finance:'write'}};
class AccessError extends Error{constructor(m,s){super(m);this.status=s;}}
const auth={AccessError,requireAccess:async()=>user,checkOrigin:r=>{if(r.headers.get('origin')!=='https://test.local')throw new AccessError('origin',403);},accessResponse:e=>e instanceof AccessError?Response.json({error:e.message},{status:e.status}):null};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==='@/lib/storage')return {storage:()=>db};if(n==='@/lib/authorization')return auth;if(n==='@/lib/firmware-storage')return {boundedBody:async r=>new Uint8Array(await r.arrayBuffer())};if(n.startsWith('@/'))return load(n.slice(2)+'.ts');return require(n)},Response,Request,URL,Error,Date,Intl,Map,Set,TextEncoder,TextDecoder,Uint8Array,crypto:globalThis.crypto,console},{filename:file});return exports;}
const lib=load('lib/expense-register.ts'),api=load('app/api/expense-register/route.ts');
const body=(mode,extra={})=>({mode,id:crypto.randomUUID(),confirmed:true,notes:'verified evidence',revision:0,...extra});
async function post(b,status=200){const r=await api.POST(new Request('https://test.local/api/expense-register',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(b)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const get=async()=>{const r=await api.GET();assert.equal(r.status,200);return r.json();};
(async()=>{
assert.equal(lib.suggestExpense('حمل کمپرسور').treatment,'review');assert.equal(lib.suggestExpense('حمل خرید کمپرسور').group,'purchase');assert.equal(lib.suggestExpense('پیش پرداخت خرید کمپرسور').treatment,'advance');
const line={description:'برق کارخانه',amount:'100',group:'overhead',treatment:'production',center:'تولید',account:'6101 برق',linkId:''};
const draft=body('save',{day:'2026-10-05',reference:'INV1',supplier:'Vendor',total:'100',lines:[line]});const saved=await post(draft);await post(draft);await post({...draft,total:'101'},409);
await post(body('save',{...draft,id:crypto.randomUUID(),lines:[{...line,amount:'99'}]}),400);
await post({...draft,id:crypto.randomUUID()},409);
await post({...draft,id:crypto.randomUUID(),reference:'INV2',lines:[{...line,linkId:'missing'}]},400);
await post(body('approve',{recordId:saved.id,revision:1}));let data=await get();assert.equal(data.records[0].data.state,'approved');
await post({...draft,id:crypto.randomUUID(),recordId:saved.id,revision:2},400);
await post(body('rule',{sourceId:saved.id,lineIndex:0}));const suggestion=await post({mode:'suggest',description:'برق کارخانه'});assert.equal(suggestion.account,'6101 برق');assert.equal(suggestion.confidence,'rule');
await post(body('reopen',{recordId:saved.id,revision:2}));await post(body('approve',{recordId:saved.id,revision:2}),409);
await post({...draft,id:crypto.randomUUID(),recordId:saved.id,revision:3,lines:[{...line,account:''}]});await post(body('approve',{recordId:saved.id,revision:4}),400);
user={userId:'read',permissions:{finance:'read'}};assert.equal((await api.GET()).status,200);await post(body('approve',{recordId:saved.id,revision:4}),403);user.permissions={finance:'write',salesAgentId:'a'};assert.equal((await api.GET()).status,403);
user={userId:'owner',name:'Owner',isAdmin:true,permissions:{finance:'write'}};
const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){sql.exec('BEGIN');for(const t of Object.keys(reset.resetTables))sql.exec('DELETE FROM '+t+' WHERE '+reset.resetWhere(t,scope));assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type IN ('expense_register','expense_rule')").get().n,0);sql.exec('ROLLBACK');}
sql.exec("UPDATE reset_control SET phase='maintenance'");await post(body('approve',{recordId:saved.id,revision:4}),400);await post({...draft,id:crypto.randomUUID(),reference:'INV3'},409);sql.exec("UPDATE reset_control SET phase='testing'");
console.log('PASS expense classification: ambiguity, nonexpense, approved rules, balanced splits, duplicate source, links, roles, revisions, replay, immutable approval, reset rollback and freeze');
})().catch(e=>{console.error(e);process.exit(1)});
