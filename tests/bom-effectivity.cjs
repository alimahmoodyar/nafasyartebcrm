const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}


const api=load('app/api/bom-effectivity/route.ts');
const post=async b=>{const r=await api.POST(request('/api/bom-effectivity','POST',b));return {status:r.status,data:await r.json()}};
(async()=>{identity=owner;await auth.session();const now=new Date().toISOString();
sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('p','product','{}',?)").run(now);
for(let v=1;v<=2;v++)sql.prepare("INSERT INTO bom_versions(id,product_id,version,lines,created,actor) VALUES(?,?,?,?,?,?)").run('b'+v,'p',v,'[]',now,'owner');
const put=(id,type,data)=>sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)").run(id,type,JSON.stringify(data),now,now);
put('pending','sourcing_plan',{productId:'p',state:'pending'});put('released','sourcing_plan',{productId:'p',state:'released',bom:{id:'b1'}});put('wip','build',{state:'prepared',bomId:'b1',materials:[{batchId:'old'}]});
const base={productId:'p',bomId:'b2',scope:'plans',planIds:['pending'],notes:'approved engineering reference'};
let preview=await post({...base,mode:'preview'});assert.equal(preview.status,200);const body={...base,mode:'apply',id:crypto.randomUUID(),confirmed:true,qualityConfirmed:true,token:preview.data.token};
assert.equal((await post({...body,qualityConfirmed:false})).status,400);
assert.equal((await post({...body,token:'stale'})).status,409);
assert.equal((await post(body)).status,200);assert.equal((await post(body)).data.repeated,true);
assert.equal(JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id='pending'").get().data).effectiveBomId,'b2');
assert.equal(JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id='wip'").get().data).bomId,'b1');
assert.equal((await post({...base,mode:'preview',planIds:['released']})).status,409);
preview=await post({...base,mode:'preview'});sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='pending'").run();assert.equal((await post({...body,id:crypto.randomUUID(),token:preview.data.token})).status,409);
const future={...base,scope:'future',planIds:[]};preview=await post({...future,mode:'preview'});assert.equal((await post({...future,mode:'apply',id:crypto.randomUUID(),confirmed:true,qualityConfirmed:true,token:preview.data.token})).status,200);
assert.equal(JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id='bom-effective:p'").get().data).bomId,'b2');
const ctx=load('lib/mcp/context.ts').mcpActor;const denied=await ctx.run({userId:'reader',email:'reader@test',name:'Reader',isAdmin:false,permissions:{read:['product'],write:[],eventStages:[]}},()=>post({...future,mode:'preview'}));assert.equal(denied.status,403);
 token=(await mint('read')).token;assert.ok((await call('apply_bom_effectivity',{...future,mode:'preview'},token)).error);
 sql.prepare("INSERT INTO reset_control(id,phase,internal,updated) VALUES(1,'maintenance',0,?) ON CONFLICT(id) DO UPDATE SET phase='maintenance',internal=0").run(now);const frozenId=crypto.randomUUID();preview=await post({...future,mode:'preview'});assert.equal((await post({...future,mode:'apply',id:frozenId,confirmed:true,qualityConfirmed:true,token:preview.data.token})).status,423);assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(frozenId),undefined);
 console.log('PASS BOM execution points: exact pending plans, explicit QA confirmation, stale previews, retries, future activation, frozen WIP/released plans.');
})().catch(e=>{console.error(e);process.exitCode=1});

