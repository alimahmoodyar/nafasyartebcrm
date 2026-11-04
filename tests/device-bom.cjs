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


const api=load('app/api/device-bom/route.ts'),context=load('lib/mcp/context.ts').mcpActor;
const get=async(id,user)=>{const fn=()=>api.GET(request('/api/device-bom?deviceId='+id));const r=user?await context.run(user,fn):await fn();return {status:r.status,data:await r.json()}};
(async()=>{identity=owner;await auth.session();const now=new Date().toISOString(),put=(id,kind,data)=>sql.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)').run(id,kind,JSON.stringify(data),now);
put('p','product',{name:'Product'});put('q','product',{name:'Other'});const lines=[{partCode:'001',name:'Precision part',quantity:'0.000001',unit:'گرم'}];
for(let n=1;n<=2;n++)sql.prepare('INSERT INTO bom_versions(id,product_id,version,lines,created,actor) VALUES(?,?,?,?,?,?)').run('b'+n,'p',n,JSON.stringify(n===1?lines:[{...lines[0],quantity:'99'}]),now,'owner');
for(const id of ['built','legacy','unbound','mismatch'])put(id,'device',{code:'SERIAL-'+id,product:id==='mismatch'?'q':'p'});
for(const id of ['built','mismatch'])sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'build',?,1,?,?)").run(id,JSON.stringify({bomId:'b1',state:'prepared'}),now,now);
const order=(device,bom)=>sql.prepare('INSERT INTO production_orders(id,device_id,bom_id,day,operator,notes,actor,created) VALUES(?,?,?,?,?,?,?,?)').run('order-'+device,device,bom,'2026-11-04','assembler','','owner',now);order('legacy','b1');
let r=await get('built');assert.equal(r.status,200);assert.equal(r.data.bom.version,1);assert.equal(r.data.bom.lines[0].quantity,'0.000001');assert.equal((await get('legacy')).data.bom.id,'b1');assert.equal((await get('unbound')).data.bom,null);assert.equal((await get('missing')).status,404);assert.equal((await get('mismatch')).status,409);
const reader=read=>({userId:'reader',email:'reader@test',name:'Reader',isAdmin:false,permissions:{read,write:[],eventStages:[]}});assert.equal((await get('built',reader(['device']))).status,403);assert.equal((await get('built',reader(['product']))).status,403);assert.equal((await get('built',reader(['device','product']))).status,200);
token=(await mint('read')).token;assert.equal((await call('get_device_bom',{deviceId:'built'})).bom.version,1);
order('built','b2');assert.equal((await get('built')).status,409);assert.equal(sql.prepare('SELECT COUNT(*) n FROM bom_versions').get().n,2);
console.log('PASS device BOM: exact frozen build and legacy versions, no latest fallback, full precision, mismatched/ambiguous links rejected, read permissions and MCP parity.');
})().catch(e=>{console.error(e);process.exitCode=1});
