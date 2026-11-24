const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const root=path.join(__dirname,'..');
const sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(name=>name.endsWith('.sql')).sort()){
 sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
}
const db={prepare(query){
 let args=[];
 return {
  bind(...values){args=values;return this;},
  async first(){return sql.prepare(query).get(...args)||null;},
  async all(){return {results:sql.prepare(query).all(...args)};},
 };
}};
class AccessError extends Error{constructor(message,status){super(message);this.status=status;}}
let isAdmin=true;
const auth={
 AccessError,
 accessResponse:e=>e.status?Response.json({error:e.message},{status:e.status}):String(e).includes('RESET_MAINTENANCE')?Response.json({},{status:423}):null,
 requireAdmin:async()=>{if(!isAdmin)throw new AccessError('Unauthorized',403);return {userId:'owner'};},
 checkOrigin:r=>{if(r.headers.get('origin')!=='https://test.local')throw new AccessError('Origin',403);},
};
const cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);
 if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const resolve=name=>{
  if(name==='@/lib/authorization')return auth;
  if(name==='@/lib/firmware-storage')return {boundedBody:r=>r.arrayBuffer()};
  if(name==='@/lib/storage')return {storage:()=>db};
  if(name==='@/lib/training-context')return {trainingContext:{getStore:()=>false}};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  if(name.startsWith('./'))return load(path.resolve(path.dirname(file),name)+'.ts');
  return require(name);
 };
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:resolve,Date,URL,Response,TextDecoder},{filename:file});
 return exports;
}
const api=load('app/api/legacy-activations/route.ts');
const contract=load('lib/legacy-activation-import.ts');
function request(body,query='',origin='https://test.local'){
 const headers={'origin':origin,'x-assistant-account':'owner'};
 return new Request('https://test.local/api/legacy-activations'+query,{
  headers,method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function post(body,expected=200){
 const response=await api.POST(request(body));
 const data=await response.json();
 assert.equal(response.status,expected,JSON.stringify(data));
 return data;
}
async function get(query=''){
 const response=await api.GET(request(null,query));
 assert.equal(response.status,200);
 return response.json();
}
const row={activeId:'123',activeDate:'2026-11-17T09:10:11.000Z',status:'0',channel:'1',serial:'0012345678',agencyId:'27',agencyName:'Old Agency'};
const preview=rows=>post({mode:'preview',rows});
const importer=rows=>({mode:'import',rows,file:'sample.xlsx',confirmed:true});
const persisted=()=>sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='legacy_activation_event'").get().n;
const addAgent=(id,kind,active)=>sql.prepare("INSERT INTO flow_entities(id,type,data,created,updated) VALUES(?,'sales_agent',?,'2026-11-17','2026-11-17')").run(id,JSON.stringify({name:'Edited name',code:'AB',kind,active}));

(async()=>{
 const header=['activeId','activeDate','activeStatus','activeChannel','DeviceFullSerial','DeviceSetSerial','SetId','SetSerial','AgencyId','AgencyCode','AgencyName','profileNatCode'];
 const sample=[12,new Date('2026-11-17T09:10:11Z'),0,1,'00123','','','','27','','نام قبلی','0012345678'];
 const parsed=contract.parseLegacyWorkbook([header,sample,[...sample.slice(0,10),'املای متفاوت','0012345678'],[...sample.slice(0,8),'28']]);
 assert.equal(parsed.repeated,1);assert.equal(parsed.conflicts.size,1);assert.equal(parsed.events.length,0);
 assert.deepEqual(await preview([row]),{known:[]});
 assert.equal(persisted(),0);
 await post({...importer([row]),confirmed:false},400);
 const [first,second]=await Promise.all([post(importer([row])),post(importer([row]))]);
 assert.equal(first.saved+second.saved,1);
 assert.equal(persisted(),1);
 assert.equal((await preview([{...row,agencyName:'Current spelling'}])).known[0].status,'same');
 const richer={...row,details:{firstName:'نام نمونه',email:'fixture@example.test',mobile:'09120000000',issuedCode:'00421',agencyActive:'1',unknownColumn:'do not keep'}};
 assert.equal((await preview([richer])).known[0].status,'enrich');
 assert.equal((await get('?view=history&q=123')).rows[0].event.details,undefined,'preview is read only');
 const enrichment=await post(importer([richer]));
 assert.equal(enrichment.saved,0);
 assert.equal(enrichment.enriched,1);
 assert.equal((await post(importer([richer]))).enriched,0);
 const enriched=(await get('?view=history&q=123')).rows[0].event;
 assert.equal(enriched.details.issuedCode,'00421');
 assert.equal(enriched.details.firstName,'نام نمونه');
 assert.equal(enriched.details.unknownColumn,undefined);
 const differing={...richer,details:{email:'different@example.test'}};
 assert.equal((await preview([differing])).known[0].status,'conflict');
 assert.equal((await post(importer([differing]))).enriched,0);
 const conflict={...row,agencyId:'28'};
 assert.equal((await preview([conflict])).known[0].status,'conflict');
 assert.equal((await post(importer([conflict,{...row,activeId:'124'}]))).saved,1);
 assert.equal(persisted(),2);
 const history=await get('?view=history&q=0012345678');
 assert.equal(history.rows.length,2);assert.equal(history.rows[0].event.serial,'0012345678');
 assert.equal(history.rows[0].event.agencyId,'27');assert.equal(history.rows[0].salesName,'');
 addAgent('sale','representative',true);addAgent('inactive','representative',false);addAgent('lead','referrer',true);
 assert.equal((await get()).sales.length,1);
 const link={mode:'link',confirmed:true,legacyId:'27',salesId:'sale',revision:0};
 await post({...link,salesId:'inactive'},409);
 await post({...link,salesId:'lead'},409);
 assert.equal((await post(link)).revision,1);
 assert.equal((await post(link)).revision,1);
 const mapped=(await get('?view=history&q=123')).rows[0];
 assert.equal(mapped.event.agencyName,'Old Agency');
 assert.equal(mapped.salesName,'Edited name');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_activations').get().n,0);
 sql.prepare("UPDATE reset_control SET phase='maintenance' WHERE id=1").run();
 await post(importer([{...row,activeId:'125'}]),423);
 isAdmin=false;
 await post(importer([{...row,activeId:'126'}]),403);
 assert.equal((await api.GET(request(null))).status,403);
 console.log('PASS legacy activation: read-only preview, source ID repeats and conflicts, concurrent import, agency link, preserved source spelling, unchanged warranty and maintenance freeze.');
})().catch(e=>{console.error(e);process.exitCode=1;});
