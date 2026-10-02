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

const api=load('app/api/transport/route.ts'),filesApi=load('app/api/transport/files/route.ts'),context=load('lib/mcp/context.ts').mcpActor,transport=load('lib/transport.ts');
let tail=Promise.resolve();const originalBatch=db.batch.bind(db);db.batch=s=>{const next=tail.then(()=>originalBatch(s));tail=next.catch(()=>{});return next};
const now=new Date().toISOString(),day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'});
const admin={userId:'owner',email:'owner@example.com',name:'Admin',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};
const empty={read:[],write:[],eventStages:[]};
function actor(id,p){const u={userId:id,email:id+'@test.local',name:id,isAdmin:false,permissions:{...empty,...p}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'تدارکات','active',?,?,1,?,?)").run(id,u.email,id,id,JSON.stringify(u.permissions),now,now);return u}
const manager=actor('manager',{transportRoles:['manager']}),driver=actor('driver',{transportRoles:['driver']}),other=actor('other-driver',{transportRoles:['driver']}),receiver=actor('receiver',{serviceRoles:['inventory','intake'],serviceDomains:['home']}),finance=actor('finance',{finance:'write'}),agent=actor('agent',{serviceRoles:['agent'],serviceDomains:['home'],serviceAgentId:'A'}),agent2=actor('agent2',{serviceRoles:['agent'],serviceDomains:['home'],serviceAgentId:'B'});
function seed(id,type,data){sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now)}
function entity(id){const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}}
function balance(id,wh,n){sql.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,?)').run(id+'@'+wh,id,wh,n)}
async function op(user,mode,b={},status=200){const body={id:crypto.randomUUID(),mode,...(b.missionId?{revision:entity(b.missionId).revision}:{}),notes:'مدرک انجام مرحله',...b};const r=await context.run(user,()=>api.POST(request('/api/transport','POST',body))),d=await r.json();assert.equal(r.status,status,mode+': '+JSON.stringify(d));return {...d,body}}
async function get(user,id='',status=200){const r=await context.run(user,()=>api.GET(request('/api/transport'+(id?'?id='+id:'')))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}

const domestic=actor('domestic',{supplyRoles:['domestic']}),foreign=actor('foreign',{supplyRoles:['foreign']}),buyerStore=actor('buyer-store',{supplyRoles:['inventory']}),oldDriver=actor('old-driver',{serviceRoles:['logistics'],serviceDomains:['home'],flowRoles:['logistics']});
(async()=>{
 seed('car','transport_vehicle',{name:'Car',plate:'1',active:true});
 seed('service-position:home:logistics','position',{name:'تدارکات خدمات — خانگی',members:['old-driver'],supervisor:'manager',active:true,responsibilities:'Custom original description'});
 seed('service-position:hospital:logistics','position',{name:'تدارکات خدمات — بیمارستانی',members:['driver'],active:true});
 seed('prior-duty','duty_template',{title:'Keep my custom duty',positionId:'service-position:home:logistics',active:false});
 seed('prior-thread','inbox_thread',{sender:'receiver',recipientType:'position',recipientId:'service-position:home:logistics',recipientName:'old',title:'Retain conversation',state:'open',kind:'message',assignee:''});
 await transport.installTransportPositions(admin);await transport.installTransportPositions(admin);
 assert.equal(entity('transport-position:driver').data.name,'کارشناس تدارکات و حمل‌ونقل');
 assert.deepEqual([...entity('transport-position:driver').data.members].sort(),['driver','old-driver']);
 assert.equal(entity('service-position:home:logistics').data.active,false);
 assert.equal(entity('service-position:home:logistics').data.responsibilities,'Custom original description');
 assert.equal(entity('prior-duty').data.positionId,'transport-position:driver');assert.equal(entity('prior-duty').data.title,'Keep my custom duty');
 assert.equal(entity('prior-thread').data.recipientId,'transport-position:driver');
 const perms=JSON.parse(sql.prepare("SELECT permissions FROM app_members WHERE id='old-driver'").get().permissions);assert.deepEqual(perms.transportRoles,['driver']);assert.deepEqual(perms.serviceRoles,[]);assert.deepEqual(perms.serviceDomains,[]);assert.deepEqual(perms.flowRoles,[]);
 const service=load('lib/after-sales.ts');await service.installServicePositions(admin);assert.equal(entity('service-position:home:logistics').data.active,false);
 const duties=load('app/api/tasks/route.ts');const dir=await (await context.run(admin,()=>duties.GET(request('/api/tasks?view=positions')))).json();assert.equal(dir.positions.some(p=>p.id==='service-position:home:logistics'),false);
 for(const [key,domain] of [['home','home'],['hospital','hospital']]){seed(key,'as_case',{domain,serial:key+'-serial',state:'contact',customer:'Customer',phone:'123'});seed('mission-'+key,'transport',{code:key,kind:'as_case',sourceId:key,domain,driverId:'driver',receiverId:'receiver',inbound:true,state:'assigned',packages:1,due:day,history:[],expenses:[]});}
 for(const key of ['home','hospital']){assert.equal((await context.run(driver,()=>api.GET(request('/api/transport?id=mission-'+key)))).status,200);assert.equal((await context.run(other,()=>api.GET(request('/api/transport?id=mission-'+key)))).status,404);await op(driver,'collect',{missionId:'mission-'+key,packages:1,day,condition:'سالم'});}
 // Purchasing may initiate only its own route; driver requires no procurement role.
 seed('purchase','purchase_order',{route:'domestic',state:'issued',supplier:'Supplier',partCode:'PART',unit:'عدد',quantity:5000,unitPrice:'SECRET_PRICE',materialId:'material:PART'});
 const sources=await (await context.run(domestic,()=>api.GET(request('/api/transport')))).json();assert.ok(sources.sources.some(s=>s.id==='purchase'));assert.ok(!JSON.stringify(sources).includes('SECRET_PRICE'));
 assert.equal((await (await context.run(foreign,()=>api.GET(request('/api/transport')))).json()).sources.some(s=>s.id==='purchase'),false);
 const created=await op(domestic,'create',{sourceKey:'purchase_order:purchase',packages:2,route:'direct',pickup:'Supplier address',destination:'Quarantine warehouse',recipient:'Warehouse',phone:'123',due:day,receiverId:'buyer-store'}),mission=created.id;
 await op(manager,'assign',{missionId:mission,driverId:'driver',vehicleId:'car',due:day});
 const detail=await (await context.run(driver,()=>api.GET(request('/api/transport?id='+mission)))).json();assert.equal(detail.mission.data.requestingUnit,'بازرگانی داخلی');assert.equal(detail.mission.data.items[0].quantity,5);assert.ok(!JSON.stringify(detail).includes('SECRET_PRICE'));
 await op(driver,'collect',{missionId:mission,packages:2,day,condition:'سالم'});await op(driver,'offer',{missionId:mission,handoverTo:'Warehouse',day});
 await op(driver,'receipt',{missionId:mission,packages:2,day,result:'complete'},403);
 await op(buyerStore,'receipt',{missionId:mission,packages:2,day,result:'complete'});
 assert.equal(entity(mission).data.state,'delivered');assert.equal(entity('purchase').data.state,'issued');assert.equal(entity('purchase').data.physicalArrival.transportId,mission);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='receipt'").get().n,0);
 console.log('Unified transport passed: idempotent position consolidation preserving members/profiles/templates/inbox, old permission migration, no recreated service driver roles, same driver across home/hospital/purchase, own-route purchasing, assigned-only visibility, physical receipt without invented inventory/QC.');
})().catch(e=>{console.error(e);process.exit(1)});
