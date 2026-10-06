const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const s=sql.prepare(q);if(s.columns().length)return {results:s.all(...args),meta:{changes:0}};return {results:[],meta:{changes:s.run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
class AccessError extends Error{constructor(message,status){super(message);this.status=status}}
const admin={userId:'owner',name:'مدیر',username:'admin',isAdmin:true,permissions:{}},alice={userId:'alice',name:'علی',username:'ali',isAdmin:false,permissions:{}},bob={userId:'bob',name:'رضا',username:'reza',isAdmin:false,permissions:{}};
let user=admin,queue=[],calls=0;const cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>{if(n==='@/lib/authorization')return{AccessError,session:async()=>{if(!user)throw new AccessError('login',401);return user;},accessResponse:e=>e instanceof AccessError?Response.json({error:e.message},{status:e.status}):null};if(n==='@/lib/storage')return{storage:()=>db};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n);},fetch:async()=>{calls++;const q=queue.shift();if(q instanceof Error)throw q;return q||Response.json({choices:[]});},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,AbortController,setTimeout,clearTimeout,console},{filename:file});return exports;
}
const usage=load('lib/llm-usage.ts'),provider=load('lib/llm-provider.ts'),route=load('app/api/llm-usage/route.ts'),training=load('lib/training-context.ts'),reset=load('lib/reset-contract.ts'),dates=load('lib/persian-date.ts');
const profile={id:'p1',name:'Test',model:'model-test',base_url:'https://provider.test/v1'};
const invoke=(who=alice,source='assistant',requestId=crypto.randomUUID(),round=1)=>provider.providerRequest(profile,'secret-key','/chat/completions',{model:profile.model,temperature:0.3,messages:[{role:'user',content:'PROMPT_SECRET'}]},{user:who,source,requestId,round});
const get=async query=>{const r=await route.GET(new Request('https://test/api/llm-usage?'+(query||'')));return {status:r.status,data:await r.json()}};
(async()=>{
 // Both supported usage shapes, numeric details only, no treating absent usage as zero.
 let n=usage.normalizeUsage({prompt_tokens:100,completion_tokens:25,total_tokens:125,prompt_tokens_details:{cached_tokens:60},completion_tokens_details:{reasoning_tokens:10},secret:'KEY_SECRET'});
 assert.equal(n.total,125);assert.equal(n.cached,60);assert.equal(n.reasoning,10);assert.ok(!JSON.stringify(n).includes('KEY_SECRET'));
 n=usage.normalizeUsage({input_tokens:3,output_tokens:4,total_tokens:9,output_tokens_details:{reasoning_tokens:2}});assert.equal(n.total,7);assert.equal(n.mismatch,true);
 n=usage.normalizeUsage(null);assert.equal(n.total,null);assert.equal(n.complete,false);
 n=usage.normalizeUsage({prompt_tokens:-1,completion_tokens:'5'});assert.equal(n.input,null);assert.equal(n.output,null);
 // Two actual calls for one logical turn, provider details preserved, caller ownership unforgeable by provider.
 const id=crypto.randomUUID();for(let round=1;round<=2;round++){queue.push(Response.json({id:'resp-'+round,model:'resolved-model',usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120,prompt_tokens_details:{cached_tokens:50},user_id:'bob',message:'RESPONSE_SECRET'}}));await invoke(alice,'assistant',id,round);}
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM llm_usage WHERE request_id=?').get(id).n,2);
 assert.equal(sql.prepare('SELECT SUM(total_tokens) n FROM llm_usage WHERE user_id=?').get('alice').n,240);
 // Explicit retry has its own record and unknown rejected usage, never duplicated successful totals.
 queue.push(Response.json({error:{code:'unsupported_parameter',param:'temperature',message:'KEY_SECRET'}},{status:400}),Response.json({usage:{input_tokens:10,output_tokens:5,total_tokens:15}}));await invoke(bob,'connection_test');
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM llm_usage WHERE user_id='bob'").get().n,2);
 assert.equal(sql.prepare("SELECT SUM(total_tokens) n FROM llm_usage WHERE user_id='bob'").get().n,15);
 queue.push(Response.json({choices:[]}));await invoke(bob,'hospital_assistant');
 queue.push(new Error('NETWORK_SECRET'));await assert.rejects(()=>invoke(alice),/اتصال/);
 queue.push(Response.json({usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3},error:{code:'rate_limit'}},{status:429}));await assert.rejects(()=>invoke(bob),/HTTP 429/);
 const before=sql.prepare('SELECT COUNT(*) n FROM llm_usage').get().n;queue.push(Response.json({data:[]}));await provider.providerRequest(profile,'secret-key','/models');assert.equal(sql.prepare('SELECT COUNT(*) n FROM llm_usage').get().n,before);
 // More than one page; aggregates must cover all rows, never just ten visible requests.
 for(let i=0;i<24;i++){queue.push(Response.json({usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}}));await invoke(alice);}
 let r=await get('pageSize=10');assert.equal(r.status,200);assert.equal(r.data.rows.length,10);assert.equal(r.data.summary.requests,31);assert.equal(r.data.summary.totalTokens,330);assert.equal(r.data.summary.inputTokens,260);assert.equal(r.data.summary.outputTokens,70);assert.equal(r.data.summary.unknownUsage,3);assert.equal(r.data.pages,4);assert.equal(r.data.daily.reduce((sum,d)=>sum+d.totalTokens,0),330);assert.equal(r.data.users.reduce((sum,d)=>sum+d.totalTokens,0),330);
 const ids=new Set(r.data.rows.map(r=>r.id));r=await get('page=2&pageSize=10');assert.ok(r.data.rows.every(r=>!ids.has(r.id)));assert.equal(r.data.summary.totalTokens,330);
 user=alice;r=await get('pageSize=100');assert.ok(r.data.rows.every(r=>r.user_id==='alice'));assert.equal(r.data.summary.totalTokens,312);assert.equal(r.data.userCount,1);assert.equal(r.data.topUsers[0].userId,'alice');assert.equal((await get('userId=bob')).status,403);
 user={...bob,permissions:{hospitalCenterId:'hospital'}};r=await get();assert.equal(r.status,200);assert.equal(r.data.summary.totalTokens,18);
 user=null;assert.equal((await get()).status,401);user=admin;assert.equal((await get('to=wrong')).status,400);assert.equal((await get('from=2026-10-07&to=2026-10-06')).status,400);assert.equal((await get('pageSize=500')).status,400);assert.equal((await get('from=2025-01-01&to=2026-10-06')).status,400);
 assert.equal(dates.localDay('2026-10-05T20:29:59Z'),'2026-10-05');assert.equal(dates.localDay('2026-10-05T20:30:00Z'),'2026-10-06');
 // Exact inclusive Tehran days and deterministic zero-filled chart boundaries.
 sql.prepare('UPDATE llm_usage SET day=? WHERE request_id=?').run('2026-10-01',id);r=await get('from=2026-10-01&to=2026-10-02&pageSize=10');assert.equal(r.data.summary.requests,2);assert.equal(r.data.summary.totalTokens,240);assert.equal(r.data.daily.length,2);assert.equal(r.data.daily[1].requests,0);
 const serialized=JSON.stringify(sql.prepare('SELECT * FROM llm_usage').all());for(const secret of ['secret-key','PROMPT_SECRET','RESPONSE_SECRET','NETWORK_SECRET','KEY_SECRET'])assert.ok(!serialized.includes(secret));
 // Training cannot leak reads or bill company; maintenance cannot send untracked requests.
 const callCount=calls;await training.trainingContext.run({actor:'admin',role:'test'},async()=>{assert.equal((await get()).status,403);await assert.rejects(()=>invoke(),/آموزش/)});assert.equal(calls,callCount);
 sql.exec("UPDATE reset_control SET phase='maintenance',internal=0 WHERE id=1");await assert.rejects(()=>invoke(),/RESET_MAINTENANCE/);assert.equal(calls,callCount);assert.throws(()=>sql.exec('DELETE FROM llm_usage'),/RESET_MAINTENANCE/);assert.throws(()=>sql.exec("UPDATE llm_usage SET total_tokens=0"),/RESET_MAINTENANCE/);
 sql.exec("UPDATE reset_control SET phase='testing' WHERE id=1");assert.ok(reset.resetTables.llm_usage);assert.equal(reset.resetWhere('llm_usage','operations'),'1=1');assert.equal(reset.resetWhere('llm_usage','full'),'1=1');
 const count=sql.prepare('SELECT COUNT(*) n FROM llm_usage').get().n;sql.exec('BEGIN');sql.exec('DELETE FROM llm_usage');sql.exec('ROLLBACK');assert.equal(sql.prepare('SELECT COUNT(*) n FROM llm_usage').get().n,count);
 console.log('LLM usage passed: numeric details, retries, failures/unknown, all sources, per-user ACL, paging/global totals/charts, Tehran boundaries, training isolation, reset freeze and rollback.');
})().catch(e=>{console.error(e);process.exit(1)});
