const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
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
const alice=actor('alice'),bob=actor('bob'),manager=actor('manager'),hr=actor('hr',['hr']),payroll=actor('payroll',['payroll']),approver=actor('approver',['approver']),finance=actor('finance',['finance']),treasury=actor('treasury',['treasury']),ceo=actor('ceo',['executive_viewer']),external=actor('external',[],{salesAgentId:'outside',salesRoles:['agent']});
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
async function get(u,q=''){const r=await ctx.run(u,()=>api.GET(req('/api/personnel'+q)));return {status:r.status,data:await r.json()}}
async function post(u,b){const r=await ctx.run(u,()=>api.POST(req('/api/personnel',{id:crypto.randomUUID(),confirmed:true,revision:0,notes:'Actual evidence',...b})));return {status:r.status,data:await r.json()}}
async function ok(u,b){const r=await post(u,b);assert.equal(r.status,200,JSON.stringify({b,r}));return r.data.id;}
const apply=(u,id,mode,extra={})=>post(u,{recordId:id,revision:row(id).revision,mode,...extra});
const success=async(u,id,mode,extra={})=>{const r=await apply(u,id,mode,extra);assert.equal(r.status,200,JSON.stringify({mode,r}));return r};
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
const profile={mode:'employee',code:'A01',memberId:'alice',managerId:'manager',start:day,end:'',title:'Engineer',unit:'Production',location:'Factory',employment:'Full time',leaveMinutes:960,bankAccount:'PRIVATE-BANK',personal:'PRIVATE-PERSONAL'};
(async()=>{
 const production=load('app/api/routine-production/route.ts'),people=load('lib/production-people.ts'),planner=load('lib/routine-planning.ts'),reports=load('lib/routine-production.ts');
 const admin={...hr,isAdmin:true};
 const worker=actor('factory',[],{roleAssignment:{roles:['production_worker']}}),foreman=actor('factory-chief',[],{flowRoles:['production']}),accountant=actor('accountant',['payroll']),qc=actor('quality',[],{flowRoles:['qc']});
 const hrId=await ok(hr,{...profile,leaveMinutes:0,productionEligible:true});
 assert.equal(row(hrId).data.productionEligible,true);const permissionsBefore=sql.prepare("SELECT permissions FROM app_members WHERE id='alice'").get().permissions;
 let source=await production.routineSource();assert.ok(people.productionEligible(source.members.find(m=>m.id==='alice'),source.entities));
 assert.ok(people.productionEligible(source.members.find(m=>m.id===foreman.userId.slice(6)),source.entities));
 assert.ok(!people.productionEligible(source.members.find(m=>m.id==='accountant'),source.entities));assert.ok(!people.productionEligible(source.members.find(m=>m.id==='external'),source.entities));
 // Production role grants default inclusion even before the HR dossier is completed.
 assert.ok(people.productionEligible(source.members.find(m=>m.id==='factory'),source.entities));
 const read=async()=>{const r=await ctx.run(admin,()=>production.GET());assert.equal(r.status,200);return r.json()};
 let view=await read();assert.ok(view.members.some(m=>m.id==='alice'&&m.title==='Engineer'));assert.ok(view.members.some(m=>m.id==='factory'));assert.ok(!view.members.some(m=>m.id==='accountant'||m.id==='quality'||m.id==='external'));
 assert.ok(view.qualityMembers.some(m=>m.id==='quality'),'Reviewer pool stays separate');assert.ok(!JSON.stringify(view.members).includes('PRIVATE-'),'No bank or personal HR fields leak to production');
 const ownRole=reports.routineRoles(alice);assert.equal(ownRole.foreman,false);assert.equal(ownRole.quality,false,'Eligibility does not grant operation approval rights');
 const participant=load('lib/production-participant.ts');assert.equal(await participant.productionParticipant(alice),true);assert.equal(await participant.productionParticipant(external),false);
 const navigation=load('lib/navigation-access.ts');assert.equal(navigation.canOpenSection({...alice,productionParticipant:true},'routine-production'),true);assert.equal(navigation.canOpenSection({...alice,productionParticipant:true},'users'),false);
 const sessionTool=catalog.tools.find(t=>t.name==='get_session');assert.equal((await ctx.run(alice,()=>sessionTool.run({},base,{user:alice}))).productionParticipant,true);
 const postProduction=async b=>ctx.run(admin,()=>production.POST(req('/api/routine-production',{id:crypto.randomUUID(),confirmed:true,notes:'Evidence',...b})));
 const routeId=crypto.randomUUID();assert.equal((await postProduction({id:routeId,mode:'route',materialId:'part',steps:[{title:'Fit',minutes:5,bom:[]}]})).status,404);
 seed('part','material',{code:'22',name:'Valve',unit:'عدد'});
 assert.equal((await postProduction({id:routeId,mode:'route',materialId:'part',steps:[{title:'Fit',minutes:5,bom:[]}]})).status,200);
 assert.equal((await postProduction({mode:'policy',effective:day,restMinutes:0,setupMinutes:0,lowerPercent:90,upperPercent:110})).status,200);
 const estimate=load('app/api/routine-production/estimate/route.ts'),input={routeId,method:'quantity',count:4,memberIds:['alice'],day:today,days:1,start:'08:00',end:'09:00'};
 const calculate=async x=>{const r=await ctx.run(admin,()=>estimate.POST(req('/api/routine-production/estimate',x)));return {status:r.status,data:await r.json()}};
 const good=await calculate(input);assert.equal(good.status,200,JSON.stringify(good.data));assert.equal((await calculate({...input,memberIds:['accountant']})).status,400);
 const finalPreview=load('lib/finished-planning.ts').finishedPreview;source=await production.routineSource();const finalSource={...source,records:[{id:'product',kind:'product',payload:JSON.stringify({name:'Final',productionMode:'routine'})}],entities:[...source.entities,{id:'initial-version',revision:1,type:'product_version',data:{productId:'product',version:1,design:'D1',effectiveFrom:'2000-01-01'}},{id:'approved',type:'sourcing_plan',revision:1,data:{state:'released',approvedBy:'ceo',productId:'product',count:20}},{id:'final-route',type:'routine_route',revision:1,data:{productId:'product',steps:source.entities.find(e=>e.id===routeId).data.steps}}]};
 assert.equal((await finalPreview({...input,routeId:'final-route',productId:'product',sourcingPlanId:'approved'},finalSource)).feasible,true);await assert.rejects(()=>finalPreview({...input,routeId:'final-route',productId:'product',sourcingPlanId:'approved',memberIds:['accountant']},finalSource));
 const lotId=crypto.randomUUID();assert.equal((await postProduction({id:lotId,mode:'lot',routeId,title:'Remaining',count:4})).status,200);
 const assignment={mode:'assign',lotId,revision:row(lotId).revision,stage:0,count:4,memberId:'accountant',day:today,start:'08:00',end:'09:00'};assert.equal((await postProduction(assignment)).status,400,'Manual allocation cannot bypass the filtered candidate pool');
 // A participant's own production read stays personal and exposes no HR roster.
 const planned=await postProduction({...input,mode:'plan',previewKey:good.data.previewKey,qcMemberId:'quality'});assert.equal(planned.status,200,await planned.text());
 const ownRead=await ctx.run(alice,()=>production.GET());const ownData=await ownRead.json();assert.equal(ownData.roles.foreman,false);assert.equal(ownData.members.length,0);assert.ok(ownData.jobs.length>0&&ownData.jobs.every(j=>j.data.memberId==='alice'));
 const future={...input,day:next},futureEstimate=await calculate(future);assert.equal(futureEstimate.status,200);
 const futureId=crypto.randomUUID(),preRace=row(hrId),originalBatch=db.batch.bind(db);let race=true;
 db.batch=async statements=>{if(race){race=false;sql.prepare('UPDATE flow_entities SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify({...row(hrId).data,productionEligible:false}),hrId);}return originalBatch(statements)};
 const raced=await postProduction({...future,id:futureId,mode:'plan',previewKey:futureEstimate.data.previewKey,qcMemberId:'quality'});assert.notEqual(raced.status,200,'Concurrent HR exclusion must fail atomic plan creation');assert.equal(row(futureId),null);assert.equal(row(hrId).data.productionEligible,false,'Concurrent HR change remains committed');
 db.batch=originalBatch;sql.prepare('UPDATE flow_entities SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify(preRace.data),hrId);
 // Changing unrelated profile fields must preserve the explicit operational flag.
 await success(hr,hrId,'employee',{...profile,leaveMinutes:0,title:'Assembly support'});assert.equal(row(hrId).data.productionEligible,true);
 const before=JSON.stringify(row(hrId));assert.equal((await apply(alice,hrId,'employee',{...profile,leaveMinutes:0,productionEligible:false})).status,403);assert.equal(JSON.stringify(row(hrId)),before);
 assert.equal((await apply(hr,hrId,'employee',{...profile,leaveMinutes:0,productionEligible:'yes'})).status,400);assert.equal(JSON.stringify(row(hrId)),before);
 // MCP uses the same audited employee writer and excludes the person immediately.
 assert.equal(catalog.tools.find(t=>t.name==='personnel_apply').inputSchema.properties.productionEligible.type,'boolean');
 assert.ok(load('lib/operation-form-fields.ts').visiblePersonnelFields({mode:'employee'}).includes('productionEligible'));
 await ctx.run(hr,()=>catalog.tools.find(t=>t.name==='personnel_apply').run({id:crypto.randomUUID(),confirmed:true,recordId:hrId,revision:row(hrId).revision,notes:'Remove from assembly pool',...profile,leaveMinutes:0,productionEligible:false},base,{}));
 assert.equal(row(hrId).data.productionEligible,false);view=await read();assert.ok(!view.members.some(m=>m.id==='alice'));assert.equal((await calculate(input)).status,400);
 assert.equal(await participant.productionParticipant(alice),false,'Personal entry follows HR exclusion');
 const oldCount=sql.prepare('SELECT count(*) n FROM flow_entities').get().n;
 const save=await postProduction({...input,mode:'plan',previewKey:good.data.previewKey,qcMemberId:'quality'});assert.equal(save.status,400);assert.equal(sql.prepare('SELECT count(*) n FROM flow_entities').get().n,oldCount,'A stale/off candidate cannot create a plan');
 assert.equal(sql.prepare("SELECT permissions FROM app_members WHERE id='alice'").get().permissions,permissionsBefore);
 assert.ok(row(hrId).data.history.some(h=>h.previous?.productionEligible===true),'Eligibility changes retain previous values in audit history');
 // Overrides cannot bypass account inactivity, external identity or ended employment.
 source=await production.routineSource();const member=source.members.find(m=>m.id==='factory');
 const eligibleProfile={type:'hr_employee',data:{memberId:'factory',state:'active',productionEligible:true,start:day,end:day}};
 assert.equal(people.productionEligible(member,[eligibleProfile],today),false);assert.equal(people.productionEligible({...member,status:'disabled'},[]),false);
 assert.equal(people.productionEligible(member,[{type:'hr_employee',data:{memberId:'factory',state:'active',productionEligible:false}}]),false,'Explicit exclusion overrides a production role');
 assert.equal(people.productionEligible(member,[{...eligibleProfile,data:{...eligibleProfile.data,state:'disabled',end:''}}]),false);
 console.log('PASS production people: role defaults, HR opt-in/out and preservation, separate reviewer pool, minimal projection, both API and MCP scope, stale-plan denial, audit, no permission mutation, employment/account restrictions.');
})().catch(e=>{console.error(e);process.exitCode=1});
