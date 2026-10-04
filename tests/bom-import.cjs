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

const importer=load('app/api/bom-import/route.ts'),parser=load('lib/bom-import.ts');
async function run(body,status=200){const r=await importer.POST(request('/api/bom-import','POST',body));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
(async()=>{
 identity=owner;await auth.session();
 const grid=[['30100012','کد محصول:','سوشیا','نام محصول:','2040001358','کد فرمول:'],['1','مقدار:'],['ردیف','کد کالا','عنوان کالا','مقدار واحد اصلی','مقدار واحد فرعی']];
 for(let i=0;i<81;i++)grid.push([String(i+1),String(10000000+i),'قطعه '+i,'1','0']);
 grid[3]=['1','\u200f10100822','لوله','0/107','0/0001'];grid[4]=['2','10100021','ابر','4,200','0/21'];
 let draft=parser.parseBomGrid(grid);assert.equal(draft.lines.length,81);draft=parser.applyApprovedFiveLitre(draft);assert.equal(draft.lines[0].quantity,'107');assert.equal(draft.lines[0].unit,'گرم');assert.equal(draft.lines[1].quantity,'4200');assert.equal(draft.lines[1].unit,'سانتی‌متر مربع');
 assert.throws(()=>parser.parseBomGrid([...grid,grid[3]]),/تکراری/);
 assert.throws(()=>parser.applyApprovedFiveLitre({...draft,formulaCode:'another'}));
 const product='import-product';sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'product',?,'now')").run(product,JSON.stringify({code:'30100012',name:'Device'}));
 let body={productId:product,previousVersion:0,source:'test.xls',lines:parser.importLines(draft.lines)};
 const preview=await run({mode:'preview',...body});assert.equal(preview.newCodes.length,81);assert.equal(sql.prepare('SELECT count(*) n FROM bom_versions').get().n,0);
 let commit={...body,mode:'commit',id:crypto.randomUUID(),confirmed:true,catalogSnapshot:preview.catalogSnapshot};
 await run({...commit,confirmed:false},400);await run({...commit,catalogSnapshot:'wrong'},409);
 let saved=await run(commit);assert.equal(saved.createdMaterials,81);
 assert.equal((await run(commit)).repeated,true);assert.equal(sql.prepare('SELECT count(*) n FROM bom_versions').get().n,1);
 assert.equal(sql.prepare('SELECT count(*) n FROM inventory_balances').get().n,0,'no invented stock');
 assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE kind='batch'").get().n,0,'no invented batches');
 assert.equal(JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id='material:10100822'").get().data).fields.length,0,'no invented QC');
 body={...body,previousVersion:1};const again=await run({...body,mode:'preview'});assert.equal(again.unchanged,true);await run({...body,mode:'commit',confirmed:true,id:crypto.randomUUID(),catalogSnapshot:again.catalogSnapshot});assert.equal(sql.prepare('SELECT count(*) n FROM bom_versions').get().n,1);
 await run({...commit,source:'different'},409);
 const conflict={...body,lines:body.lines.map((l,i)=>i===0?{...l,unit:'متر'}:l)};const bad=await run({...conflict,mode:'preview'});assert.equal(bad.errors.length,1);await run({...conflict,mode:'commit',confirmed:true,id:crypto.randomUUID(),catalogSnapshot:bad.catalogSnapshot},400);
 const changed={...body,lines:body.lines.map((l,i)=>i===0?{...l,quantity:'108'}:l)};const cp=await run({...changed,mode:'preview'});assert.equal(cp.changed.length,1);
 // Simulate a material update between preview and commit.
 sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='material:10100822'").run();await run({...changed,mode:'commit',confirmed:true,id:crypto.randomUUID(),catalogSnapshot:cp.catalogSnapshot},409);
 const refreshed=await run({...changed,mode:'preview'});await run({...changed,mode:'commit',confirmed:true,id:crypto.randomUUID(),catalogSnapshot:refreshed.catalogSnapshot});assert.equal(sql.prepare('SELECT count(*) n FROM bom_versions').get().n,2);assert.equal(JSON.parse(sql.prepare('SELECT lines FROM bom_versions WHERE version=1').get().lines).find(l=>l.partCode==='10100822').quantity,'107');
 // Fail a write inside the transaction: no partial material/BOM/audit changes.
 const newLine={partCode:'99999999',name:'Rollback',unit:'عدد',quantity:'1'};const rb={...body,previousVersion:2,lines:[...body.lines,newLine]};const rp=await run({...rb,mode:'preview'});const rid=crypto.randomUUID();
 sql.exec("CREATE TRIGGER reject_test_bom BEFORE INSERT ON bom_versions BEGIN SELECT RAISE(ABORT,'test failure'); END");await run({...rb,mode:'commit',confirmed:true,id:rid,catalogSnapshot:rp.catalogSnapshot},400);sql.exec('DROP TRIGGER reject_test_bom');assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE id='material:99999999'").get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM inventory_operations WHERE id=?').get(rid).n,0);
 const readToken=await mint('read');token=readToken.token;identity=null;assert.ok((await call('commit_bom_import',{...rb,id:crypto.randomUUID(),catalogSnapshot:rp.catalogSnapshot,confirmed:true})).error);
 identity=owner;const writeToken=await mint('read_write');token=writeToken.token;identity=null;const mp=await call('preview_bom_import',rb);assert.ok(mp.catalogSnapshot,JSON.stringify(mp));const mc=await call('commit_bom_import',{...rb,id:crypto.randomUUID(),catalogSnapshot:mp.catalogSnapshot,confirmed:true});assert.equal(mc.saved,true);
 identity=null;await run({...body,mode:'preview'},401);
 sql.prepare('INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run('reader','reader@example.com','Reader','unit','active','reader',JSON.stringify({read:['product'],write:[],eventStages:[]}),'now','now');identity={userId:'reader',email:'reader@example.com',displayName:'Reader',fullName:null};await run({...body,mode:'preview'},403);
 const reset=load('lib/reset-contract.ts');assert.equal(reset.resetWhere('bom_versions','operations'),'0=1');assert.ok(reset.resetWhere('flow_entities','operations').includes("'material'"));assert.equal(reset.resetWhere('bom_versions','full'),'1=1');
 if(process.env.BOM_GRID){const actual=parser.applyApprovedFiveLitre(parser.parseBomGrid(JSON.parse(fs.readFileSync(process.env.BOM_GRID,'utf8'))));assert.equal(actual.lines.length,81);assert.equal(parser.importLines(actual.lines).length,81);assert.equal(actual.lines.find(l=>l.partCode==='10100326').quantity,'2');assert.equal(actual.lines.find(l=>l.partCode==='10100822').quantity,'107');console.log('Real uploaded accounting report: 81 rows parsed; approved units and aluminium correction validated.');}
 console.log('PASS: BOM parser, 81-row atomic import, retries, duplicate file, units, stale preview, immutable versions, rollback, permissions, MCP and reset coverage.');
})().catch(e=>{console.error(e);process.exitCode=1});
