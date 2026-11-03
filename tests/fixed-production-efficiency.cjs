const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,structuredClone,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}


const api=load('app/api/routine-production/route.ts'),ctx=load('lib/mcp/context.ts').mcpActor,permissions=load('lib/permissions.ts');
let user={userId:'owner',name:'Owner',isAdmin:true,permissions:permissions.allPermissions};const admin=user;
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-10-01','2026-10-01');
const member=(id,p)=>sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,'unit','active',?,?,?)").run(id,id+'@test',id,JSON.stringify({read:[],write:[],eventStages:[],...p}),'2026-10-01','2026-10-01');
const body=(mode,x={})=>({id:crypto.randomUUID(),mode,confirmed:true,notes:'Documented evidence',...x});
async function post(b,status=200){const r=await ctx.run(user,()=>api.POST(new Request('https://test.local/api/routine-production',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(b)})));const d=await r.json();assert.equal(r.status,status,b.mode+': '+JSON.stringify(d));return d;}
async function get(){const r=await ctx.run(user,()=>api.GET());assert.equal(r.status,200);return r.json();}
const row=id=>{const x=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...x,data:JSON.parse(x.data)};};
async function change(mode,id,x={},status=200){return post(body(mode,{[mode==='assign'||mode==='quality'||mode==='cost'?'lotId':'jobId']:id,revision:row(id).revision,...x}),status);}
const stock=(id,code,wh,q)=>{sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'batch',?,'2026-10-01')").run(id,JSON.stringify({partCode:code,unit:'عدد',status:'تأیید',quantity:String(q/1000)}));sql.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'opening','{}','owner','2026-10-01',1)").run(id);sql.prepare('INSERT INTO inventory_entries(id,operation_id,item_id,warehouse,delta) VALUES(?,?,?,?,?)').run(id,id,id,wh,q);sql.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,?)').run(id+'@'+wh,id,wh,q);entity('price:'+id,'cost_price',{batchId:id,unitCost:'100'});};

const estimate=load('app/api/routine-production/estimate/route.ts');
async function preview(input,status=200){const r=await ctx.run(user,()=>estimate.POST(new Request('https://test.local/api/routine-production/estimate',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(input)})));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
(async()=>{
 member('worker',{});entity('part','material',{code:'22',name:'Valve',unit:'عدد'});
 const policy=body('policy',{effective:'2026-11-01',restMinutes:60,setupMinutes:20,lowerPercent:90,upperPercent:110});
 await post(policy);await post(policy);assert.equal(row(policy.id).data.efficiencyPercent,100);
 const before=sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n;
 for(const efficiencyPercent of [80,0,101,'100'])await post(body('policy',{...policy,id:crypto.randomUUID(),efficiencyPercent}),400);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n,before,'Invalid factors cannot write');
 const oldPolicy={effective:'2026-11-02',version:2,restMinutes:60,setupMinutes:20,efficiencyPercent:80,lowerPercent:90,upperPercent:110};
 entity('old-policy','routine_policy',oldPolicy);const original=JSON.stringify(row('old-policy'));
 const route=body('route',{materialId:'part',steps:[{title:'Assembly',minutes:5,crewSize:1,allowancesIncluded:false,bom:[]}]});await post(route);
 const input={routeId:route.id,method:'people',memberIds:['worker'],day:'2026-11-03',days:1,start:'08:00',end:'16:00'};
 const p=await preview(input);assert.equal(p.count,80,'(480 - 60 - 20) / 5 = 80, even when the selected old policy stores 80%');
 assert.equal((await preview({...input,method:'quantity',count:80})).feasible,true);
 const planner=load('lib/routine-planning.ts'),source=await load('app/api/routine-production/route.ts').routineSource();
 const copied=planner.routinePolicy(source.entities,input.day);assert.equal(copied.data.efficiencyPercent,100);assert.equal(JSON.stringify(row('old-policy')),original,'Selecting old settings never rewrites them');
 const confirmed=body('plan',{...input,previewKey:p.previewKey,qcMemberId:'worker'});await post(confirmed);
 const job=(await get()).jobs.find(j=>j.data.planId===confirmed.id);assert.equal(job.data.policy.efficiencyPercent,100);assert.equal(job.data.report.target,80);assert.equal(job.data.report.lower,72);assert.equal(job.data.report.upper,80,'Upper target remains capped by actual assignment');
 const oldJob={...row(job.id).data,policy:oldPolicy,assigned:100};
 const reports=load('lib/routine-production.ts');assert.equal(reports.targetFor(oldJob).standard,64,'Historical job snapshots keep their original factor');
 entity('old-job','routine_job',{...oldJob,state:'closed',closedReport:{target:64,standard:64,usefulMinutes:320}});
 const oldSnapshot=JSON.stringify(row('old-job'));assert.equal((await get()).jobs.find(j=>j.id==='old-job').data.report.target,64);assert.equal(JSON.stringify(row('old-job')),oldSnapshot);
 const manualLot=body('lot',{routeId:route.id,title:'Manual remaining work',count:80});await post(manualLot);
 const assignment=body('assign',{lotId:manualLot.id,revision:row(manualLot.id).revision,memberId:'worker',day:'2026-11-04',start:'08:00',end:'16:00',stage:0,count:80,rework:false});await post(assignment);assert.equal(row(assignment.id).data.policy.efficiencyPercent,100,'Legacy/manual assignment also copies the fixed basis');
 const finalPreview=load('lib/finished-planning.ts').finishedPreview;
 const finalSource={...source,records:[{id:'product',kind:'product',payload:JSON.stringify({name:'Finished',productionMode:'routine'})}],entities:[...source.entities.filter(e=>e.type!=='routine_job'&&e.type!=='plan'),{id:'approved',revision:1,type:'sourcing_plan',data:{state:'released',approvedBy:'ceo',productId:'product',count:100}},{id:'final-route',revision:1,type:'routine_route',data:{productId:'product',steps:row(route.id).data.steps}}]};
 assert.equal((await finalPreview({...input,routeId:'final-route',productId:'product',sourcingPlanId:'approved'},finalSource)).count,80,'Final production uses the same fixed basis');
 const catalog=load('lib/mcp/tools.ts'),tool=catalog.tools.find(t=>t.name==='routine_production_apply');
 const schema=load('lib/operation-form-fields.ts').operationDataSchema('routine_production_apply','policy');assert.equal(schema.properties.efficiencyPercent,undefined,'Assistant form cannot ask for an editable factor');
 const mid=crypto.randomUUID();await ctx.run(user,()=>tool.run({id:mid,confirmed:true,mode:'policy',data:{effective:'2026-11-03',restMinutes:60,setupMinutes:20,lowerPercent:90,upperPercent:110,notes:'MCP fixed basis'}},'https://test.local',{}));assert.equal(row(mid).data.efficiencyPercent,100);
 const badId=crypto.randomUUID();await assert.rejects(()=>ctx.run(user,()=>tool.run({id:badId,confirmed:true,mode:'policy',data:{...policy,efficiencyPercent:80}},'https://test.local',{})));assert.equal(sql.prepare('SELECT id FROM flow_entities WHERE id=?').get(badId),undefined);
 user={userId:'local:worker',name:'Worker',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};await post(body('policy',{effective:'2026-11-03',restMinutes:0,setupMinutes:0,lowerPercent:90,upperPercent:110}),403);
 console.log('PASS fixed time basis: policy defaults and HTTP/MCP rejection, both capacity directions, final/shared scheduler, new job snapshot 100%, unchanged historical settings and closed reports, role denial and idempotency.');
})().catch(e=>{console.error(e);process.exitCode=1});
