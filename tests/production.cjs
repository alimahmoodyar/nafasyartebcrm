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

const production=load('app/api/production/route.ts'),recordsApi=load('app/api/records/route.ts');
async function create(kind,data){const r=await recordsApi.POST(request('/api/records','POST',{kind,data}));const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));return d.record;}
async function operate(b,status=200){const r=await production.POST(request('/api/production','POST',{id:crypto.randomUUID(),...b}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
(async()=>{
 identity=owner;await auth.session();
 const p=await create('product',{code:'P1',name:'Device',group:'G',model:'M',warrantyMonths:'12',status:'فعال'});
 const devices=[];for(let n=0;n<3;n++)devices.push(await create('device',{code:'D'+n,product:p.id,model:'M',design:'1',date:'2026-10-01'}));
 const batches=[];for(let n=1;n<=2;n++)batches.push(await create('batch',{code:'B'+n,partCode:'0'+n,part:'Part'+n,date:'2026-10-01',supplier:'S',quantity:'10',unit:'عدد',status:'تأیید'}));
 const bomId=crypto.randomUUID(),lines=[{partCode:'01',name:'Part1',unit:'عدد',quantity:'2'},{partCode:'02',name:'Part2',unit:'عدد',quantity:'3'}];
 await operate({mode:'bom',id:bomId,productId:p.id,previousVersion:0,lines});
 await operate({mode:'opening',batchId:batches[0].id,to:'line',quantity:'10'});
 await operate({mode:'opening',batchId:batches[1].id,to:'raw',quantity:'10'});
 await operate({mode:'move',batchId:batches[1].id,from:'raw',to:'line',quantity:'2'});
 const orderId=crypto.randomUUID(),allocations=batches.map((b,n)=>({partCode:'0'+(n+1),batchId:b.id,warehouse:'line'}));
 await operate({mode:'order',id:orderId,deviceId:devices[0].id,bomId,day:'2026-10-01',operator:'Operator',notes:'Test',allocations});
 const stock=()=>JSON.stringify(sql.prepare('SELECT * FROM inventory_balances ORDER BY id').all());const before=stock();
 await operate({mode:'finish',orderId},409);assert.equal(stock(),before);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM production_receipts').get().n,0);assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='event'").get().n,0);
 await operate({mode:'move',batchId:batches[1].id,from:'raw',to:'line',quantity:'4'});
 // New BOM version must not alter an existing sheet.
 await operate({mode:'bom',productId:p.id,previousVersion:1,lines:lines.map(l=>({...l,quantity:'9'}))});
 const finishId=crypto.randomUUID();await operate({mode:'finish',id:finishId,orderId});const after=stock();await operate({mode:'finish',id:finishId,orderId});await operate({mode:'finish',orderId});assert.equal(stock(),after);
 assert.equal(sql.prepare('SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse=?').get(batches[0].id,'line').quantity,8000);
 assert.equal(sql.prepare('SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse=?').get(devices[0].id,'finished').quantity,1000);
 assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='event'").get().n,3);
 await operate({mode:'opening',batchId:batches[0].id,to:'line',quantity:'1'},409);
 let r=await recordsApi.PATCH(request('/api/records','PATCH',{id:batches[0].id,previous:JSON.stringify(batches[0].data),data:{...batches[0].data,unit:'متر'}}));assert.equal(r.status,409);
 r=await recordsApi.DELETE(request('/api/records','DELETE',{id:batches[0].id,previous:JSON.stringify(batches[0].data),confirmed:true}));assert.equal(r.status,409);
 const blocked=await create('batch',{code:'Q1',partCode:'03',part:'Quarantine',date:'2026-10-01',supplier:'S',quantity:'10',unit:'عدد',status:'قرنطینه'});
 await operate({mode:'opening',batchId:blocked.id,to:'raw',quantity:'5'},400);await operate({mode:'opening',batchId:blocked.id,to:'quarantine',quantity:'5'});await operate({mode:'move',batchId:blocked.id,from:'quarantine',to:'line',quantity:'1'},400);
 await operate({mode:'move',batchId:batches[0].id,from:'line',to:'raw',quantity:'100'},409);assert.equal(stock().includes('-100'),false);
 assert.equal((await production.GET()).status,200);
 const cg=await call('get_costing');assert.ok(!cg.error,JSON.stringify(cg));assert.ok(cg.devices.length>0);const cp={id:crypto.randomUUID(),mode:'price',confirmed:true,data:{batchId:batches[0].id,unitCost:'100',reference:'TEST-INVOICE',revision:0,notes:'test purchase evidence'}};const cw=await call('costing_apply',cp);assert.ok(!cw.error,JSON.stringify(cw));assert.equal((await call('get_costing')).batches.find(b=>b.id===batches[0].id).price.data.unitCost,'100');
 identity=null;assert.equal((await production.POST(request('/api/production','POST',{mode:'finish',id:crypto.randomUUID(),orderId}))).status,401);
 console.log('Production passed: versioned BOM snapshot, approved matching batches, warehouse movements, opening once, all-or-nothing stock, idempotent receipt, trace events, unit protection, deletion protection, authentication.');
})().catch(e=>{console.error(e);process.exit(1)});
