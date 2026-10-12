const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let batchFailure='',batchCalls=0;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){batchCalls++;const failure=batchFailure;batchFailure='';if(failure==='before')throw new Error('D1_TIMEOUT before write PRIVATE-INFRA-DETAIL');sql.exec('BEGIN');let result;try{result=[];for(const s of stmts)result.push(await s.run());sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}if(failure==='after')throw new Error('D1_TIMEOUT after commit PRIVATE-INFRA-DETAIL');return result;}};
const env={TRACE_OWNER_EMAIL:'owner@example.com',DB:db},cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return{env};if(n==='@/app/chatgpt-auth')return{getChatGPTUser:async()=>null};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout,clearTimeout,console},{filename:file});return exports;}

const context=load('lib/mcp/context.ts').mcpActor,today=load('lib/duties.ts').dayAt(),base='https://test.local';
const importer=load('app/api/after-sales/catalog-import/route.ts');
const manager={userId:'manager',email:'manager@test.local',name:'Manager',isAdmin:false,permissions:{read:[],write:[],eventStages:[],serviceDomains:['home'],serviceRoles:['manager'],flowRoles:['inventory'],warehouses:[]}};
const rows=[{code:'98000001',name:'Set fixture',unit:'ست',consumerPriceRial:'999999999999999999'},{code:'98000002',name:'Pair fixture',unit:'جفت',consumerPriceRial:'123456789012345678'}];
const data={domain:'home',source:'failure-fixture.xlsx',validFrom:today,rows};
const counts=()=>({materials:sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='material'").get().n,tariffs:sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='as_tariff'").get().n,operations:sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,audits:sql.prepare("SELECT COUNT(*) n FROM access_audit WHERE action='service_part_import'").get().n});
async function invoke(payload,status=200,actor=manager){const request=new Request(base+'/api/after-sales/catalog-import',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:typeof payload==='string'?payload:JSON.stringify(payload)}),response=await context.run(actor,()=>importer.POST(request)),result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
(async()=>{
 const initial=counts(),preview=await invoke({mode:'preview',...data});assert.deepEqual(counts(),initial);
 const body={mode:'commit',...data,id:randomUUID(),confirmed:true,catalogSnapshot:preview.catalogSnapshot};
 batchFailure='after';const failed=await invoke(body,503);
 assert.ok(!failed.error.includes('D1_TIMEOUT')&&!failed.error.includes('PRIVATE-INFRA-DETAIL'),'infrastructure exceptions remain private');
 const committed=counts();assert.deepEqual(committed,{materials:2,tariffs:2,operations:1,audits:1});assert.equal(batchCalls,1,'transaction committed before response was lost');
 const repeated=await invoke(body);assert.equal(repeated.saved,true);assert.equal(repeated.repeated,true);assert.equal(repeated.importId,body.id);assert.equal(repeated.newMaterialCount,2);assert.equal(repeated.newTariffCount,2);assert.deepEqual(counts(),committed);assert.equal(batchCalls,1,'same UUID replay does not execute another batch');
 const prices=sql.prepare("SELECT data FROM flow_entities WHERE type='as_tariff'").all().map(t=>JSON.parse(t.data).consumerPriceRial).sort();assert.deepEqual(prices,rows.map(r=>r.consumerPriceRial).sort(),'retry preserves exact 18-digit money');
 await invoke({...body,source:'changed-request.xlsx'},409);assert.deepEqual(counts(),committed);
 await invoke('{',400);assert.deepEqual(counts(),committed);
 await invoke({mode:'preview',...data},403, {...manager,permissions:{...manager.permissions,flowRoles:[]}});
 const next={...data,rows:[{code:'98000003',name:'No write before timeout',unit:'عدد',consumerPriceRial:'555'}]},nextPreview=await invoke({mode:'preview',...next}),nextBody={mode:'commit',...next,id:randomUUID(),confirmed:true,catalogSnapshot:nextPreview.catalogSnapshot};
 batchFailure='before';await invoke(nextBody,503);assert.deepEqual(counts(),committed);
 const saved=await invoke(nextBody);assert.equal(saved.saved,true);assert.equal(saved.repeated,undefined);assert.equal(saved.importId,nextBody.id);assert.deepEqual(counts(),{materials:3,tariffs:3,operations:2,audits:2});
 console.log('PASS import uncertain response: commit-then-timeout 503, same UUID replay restores result, exact prices, no duplicate writes, pre-write retry, private failures, malformed JSON 400 and permission 403.');
})().catch(e=>{console.error(e);process.exitCode=1;});
