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
const db={async batch(statements){
 sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}
},prepare(query){
 let args=[];
 return {
  bind(...values){args=values;return this;},
  async first(){return sql.prepare(query).get(...args)||null;},
  async all(){return {results:sql.prepare(query).all(...args)};},
  execute(){return {results:sql.prepare(query).all(...args)};},
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
const row={activeId:'123',activeDate:'2026-11-17T09:10:11.000Z',status:'0',channel:'1',serial:'0012345678',deviceSetSerial:'00123456',agencyId:'27',agencyName:'Old Agency'};
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
 assert.equal((await get()).hasEvents,false);
 assert.equal(persisted(),0);
 await post({...importer([row]),confirmed:false},400);
 const [first,second]=await Promise.all([post(importer([row])),post(importer([row]))]);
 assert.equal(first.saved+second.saved,1);
 assert.equal(persisted(),1);
 assert.equal((await get()).hasEvents,true);
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
 const byChassis=await get('?'+new URLSearchParams({view:'history',q:'۰۰۱۲۳۴۵۶'}));
 assert.equal(byChassis.rows.length,2);
 assert.equal(byChassis.rows[0].event.deviceSetSerial,'00123456');
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
 const recovery={mode:'initialize-serials'};
 const pairs=[['9030711001','599030711'],['1370516216','50070516'],['1456789000','10056789'],['8123456000','50123456'],
  ['1123470000','51123470'],['1123471000','11123471'],['2123471000','12123471'],['3123470000','53123470'],['4123471000','14123471']];
 let nextId=200;
 const seeds=[];
 for(const [code,out] of pairs){
  seeds.push({...row,activeId:String(nextId++),serial:code,deviceSetSerial:out});
  seeds.push({...row,activeId:String(nextId++),serial:code.slice(0,7)+'999',deviceSetSerial:''});
 }
 const missing=seeds[1];
 seeds.push({...row,activeId:'800',serial:'2550205443',deviceSetSerial:'62550205'},
  {...row,activeId:'801',serial:'2550205999',deviceSetSerial:''},
  {...row,activeId:'802',serial:'9039999000',deviceSetSerial:''},
  {...row,activeId:'803',serial:'9030711',deviceSetSerial:''});
 // Records written by release 71 before initialization.
 for(const seed of seeds)sql.prepare("INSERT INTO flow_entities(id,type,data,created,updated) VALUES(?,'legacy_activation_event',?,'old','old')").run('legacy-activation:'+seed.activeId,JSON.stringify({event:contract.cleanLegacyActivation(seed),file:'old.xlsx'}));
 const audit=await get('?view=serial-recovery');
 assert.equal(audit.counts.formula,pairs.length+1);assert.equal(audit.counts.mismatch,1);assert.equal(audit.counts.conflict,1);assert.equal(audit.counts.unsupported,1);
 const snapshot=()=>sql.prepare("SELECT data FROM flow_entities WHERE id=?").get('legacy-activation:'+missing.activeId).data;
 const before=JSON.parse(snapshot());assert.equal(before.event.deviceSetSerial,'');
 await post(recovery);const initialized=snapshot();await post(recovery);assert.equal(snapshot(),initialized);
 const after=JSON.parse(snapshot());assert.equal(after.event.deviceSetSerial,pairs[0][1]);delete after.serialRecovery;after.event.deviceSetSerial='';assert.deepEqual(after,before);
 for(let i=0;i<pairs.length;i++)assert.equal((await get('?view=history&q='+seeds[i*2+1].activeId)).rows[0].event.deviceSetSerial,pairs[i][1]);
 assert.equal((await preview([missing])).known[0].status,'same');
 assert.equal((await get('?view=history&q=801')).rows[0].event.deviceSetSerial,'');
 const byId=async id=>(await get('?view=history&q='+id)).rows[0];
 const event=(activeId,serial,deviceSetSerial='')=>({...row,activeId,serial,deviceSetSerial});
 await post(importer([event('810','5123456789'),event('811','5123456789','ABC-01')]));
 assert.equal((await byId('810')).event.deviceSetSerial,'ABC-01');assert.equal((await byId('810')).serialRecovery.method,'exact');
 await post(importer([event('812','5123456789','ABC-02')]));
 assert.equal((await byId('810')).event.deviceSetSerial,'');assert.equal((await byId('811')).event.deviceSetSerial,'ABC-01');
 await post(importer([event('820','9031234000')]));assert.equal((await byId('820')).serialRecovery.method,'formula');
 await post(importer([event('821','9031234000','599031234')]));assert.equal((await byId('820')).serialRecovery.method,'exact');
 await post(importer([event('822','9031234000','OTHER')]));assert.equal((await byId('820')).event.deviceSetSerial,'');
 await post(importer([event('830','7123456000')]));await post(importer([event('830','7123456000','REAL')]));
 assert.equal((await byId('830')).event.deviceSetSerial,'REAL');assert.equal((await byId('830')).serialRecovery,undefined);
 await post(importer([event('840','3123456000')]));await post(importer([event('840','3123456000','53345678')]));
 assert.equal((await byId('840')).event.deviceSetSerial,'53345678');assert.equal((await byId('840')).serialRecovery,undefined);
 await post(importer([event('841','3123456000')]));assert.equal((await byId('841')).event.deviceSetSerial,'');
 const review=await get('?view=serial-recovery');assert.ok(review.rows.some(r=>r.id==='legacy-activation:841'&&r.status==='conflict'));
 sql.prepare("UPDATE reset_control SET phase='maintenance' WHERE id=1").run();
 await post(importer([{...row,activeId:'125'}]),423);
 isAdmin=false;
 await post(importer([{...row,activeId:'126'}]),403);
 assert.equal((await api.GET(request(null))).status,403);
 console.log('PASS legacy activation: read-only preview, source ID repeats and conflicts, concurrent import, agency link, preserved source spelling, unchanged warranty and maintenance freeze.');
})().catch(e=>{console.error(e);process.exitCode=1;});
