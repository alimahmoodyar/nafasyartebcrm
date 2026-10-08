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
async function upload(user,id,purpose='waybill',bytes=new Uint8Array([137,80,78,71,13,10,26,10,1]),status=201){const key=crypto.randomUUID(),form=new FormData();form.set('file',new Blob([bytes]),'evidence.png');const r=await context.run(user,()=>filesApi.POST(new Request(base+'/api/transport/files?mission='+id+'&purpose='+purpose+'&requestId='+key,{method:'POST',headers:{origin:base},body:form})));assert.equal(r.status,status,await r.clone().text());return key}
async function create(kind,id,user=manager){return op(user,'create',{sourceKey:kind+':'+id,packages:1,route:'carrier',pickup:'مبدأ',destination:'مقصد',recipient:'گیرنده',phone:'09000000000',due:day,receiverId:['as_claim','as_case'].includes(kind)?'receiver':''})}
async function assign(id){return op(manager,'assign',{missionId:id,driverId:'driver',vehicleId:'car',due:day})}
async function collect(id){await op(driver,'checklist',{missionId:id,packagesChecked:true,itemsChecked:true,documentsChecked:true,conditionChecked:true});return op(driver,'collect',{missionId:id,packages:1,day,condition:'سالم'})}
(async()=>{
 seed('A','as_agent',{name:'Agent A',active:true,domain:'home',phone:'090',address:'A address'});seed('B','as_agent',{name:'Agent B',active:true,domain:'home'});
 seed('car','transport_vehicle',{name:'Van',plate:'11 A 123',active:true});
 seed('order','as_order',{domain:'home',agentId:'A',state:'approved',lines:[{id:'line',received:0,quantity:1000}]});
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('batch','batch','{}',?)").run(now);
 seed('shipment','as_shipment',{domain:'home',agentId:'A',orderId:'order',state:'prepared',lines:[{lineId:'line',batchId:'batch',partCode:'P',quantity:1000,unitRial:'100000'}]});balance('batch','service:transit:shipment',1000);
 let r=await create('as_shipment','shipment'),id=r.id;
 assert.equal((await get(driver)).missions.length,0);await get(agent2,id,404);await assign(id);
 assert.equal((await get(driver)).missions.length,1);assert.equal((await get(other)).missions.length,0);await get(other,id,404);
 await op(driver,'collect',{missionId:id,packages:1,day,condition:'سالم'},400);
 await op(driver,'checklist',{missionId:id,packagesChecked:true,itemsChecked:false,documentsChecked:true,conditionChecked:true},400);
 await op(manager,'checklist',{missionId:id,packagesChecked:true,itemsChecked:true,documentsChecked:true,conditionChecked:true},403);
 await op(driver,'blocker',{missionId:id,reason:'unknown',retryDay:day},400);
 const blocked=await op(driver,'blocker',{missionId:id,reason:'cargo_not_ready',retryDay:day});
 assert.equal(entity(id).data.state,'assigned','obstacle never fabricates collection');
 assert.ok(sql.prepare("SELECT COUNT(*) n FROM duty_runs WHERE id LIKE ? AND state='open'").get('transport:'+id+':blocker:%').n>=2,'driver and manager get follow-up tasks');
 await op(driver,'blocker',{missionId:id,reason:'recipient_absent',retryDay:day},409);
 await op(driver,'collect',{missionId:id,packages:1,day,condition:'سالم'},400);
 await op(manager,'blocker_resolve',{missionId:id});
 assert.equal(entity(id).data.blocker.state,'resolved');
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM duty_runs WHERE id LIKE ? AND state='open'").get('transport:'+id+':blocker:%').n,0);
 const reading=await op(driver,'vehicle_report',{missionId:id,reportKind:'reading',day,odometer:'1000'});
 await op(driver,'vehicle_report',{missionId:id,reportKind:'reading',day,odometer:'999'},400);
 await op(driver,'vehicle_report',{missionId:id,reportKind:'fuel',day,fuelLitres:'501',fuelCostRial:'10',reference:'fuel'},400);
 await op(driver,'vehicle_report',{missionId:id,reportKind:'fuel',day,fuelLitres:'20.5',fuelCostRial:'250000',reference:'FUEL-PRIVATE'});
 await op(driver,'vehicle_report',{missionId:id,reportKind:'fault',day,notes:'Observed tire fault'});
 assert.equal((await get(driver)).vehicleReports.length,3);assert.equal((await get(other)).vehicleReports.length,0);
 assert.ok(!JSON.stringify(await get(agent,id)).includes('FUEL-PRIVATE'),'fuel receipts stay private');
 const mileageReplay=await context.run(driver,()=>api.POST(request('/api/transport','POST',reading.body)));assert.equal(mileageReplay.status,200);assert.equal(entity(id).data.vehicleReports.length,3);
 const mileageStatus=await context.run(driver,()=>api.GET(request('/api/transport?id='+id+'&operation='+reading.body.id)));assert.equal((await mileageStatus.json()).saved,true);
 const mismatch=await context.run(driver,()=>api.POST(request('/api/transport','POST',{...reading.body,id:crypto.randomUUID()},{'X-Transport-Account':'other-driver'})));assert.equal(mismatch.status,403,'queued data cannot cross accounts');
 await op(driver,'checklist',{missionId:id,packagesChecked:true,itemsChecked:true,documentsChecked:true,conditionChecked:true});await assign(id);assert.equal(entity(id).data.checklist,undefined,'reassignment invalidates checklist');

 await op(other,'collect',{missionId:id,packages:1,day,condition:'good'},404);
 await op(driver,'receipt',{missionId:id,packages:1,day,result:'complete'},400);
 await collect(id);await upload(driver,id,'waybill',new Uint8Array([1,2,3]),400);const file=await upload(driver,id);
 await op(driver,'carrier',{missionId:id,carrier:'باربری',waybill:'WB123',tracking:'TRACK',day});
 assert.equal(entity(id).data.state,'carrier');assert.equal(entity('shipment').data.state,'shipped');assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_lots').get().n,0,'carrier is not final receipt');
 const fileDenied=await context.run(agent2,()=>filesApi.GET(request('/api/transport/files?mission='+id+'&id='+file)));assert.equal(fileDenied.status,404);
 const fileOk=await context.run(agent,()=>filesApi.GET(request('/api/transport/files?mission='+id+'&id='+file)));assert.equal(fileOk.status,200);
 await op(agent,'receipt',{missionId:id,packages:1,day,result:'damage'});assert.equal(entity(id).data.state,'disputed');assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_lots').get().n,0);
 await op(manager,'resolve',{missionId:id,resolution:'accepted'});
 r=await op(agent,'receipt',{missionId:id,packages:1,day,result:'complete'});assert.equal(entity(id).data.state,'delivered');assert.equal(entity('shipment').data.state,'received');assert.equal(entity('order').data.state,'received');assert.equal(sql.prepare('SELECT quantity FROM service_lots').get().quantity,1000);
 const repeat=await context.run(agent,()=>api.POST(request('/api/transport','POST',r.body)));assert.equal(repeat.status,200);assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_lots').get().n,1);
 assert.ok(!JSON.stringify(await get(driver,id)).includes('unitRial'),'driver does not see invoice price');
 const cost=await op(driver,'expense',{missionId:id,amountRial:'123456',reference:'cost-ref'});await upload(driver,id,'expense');const agentView=JSON.stringify(await get(agent,id));assert.ok(!agentView.includes('123456'));assert.ok(!agentView.includes('cost-ref'));assert.equal((await get(agent,id)).files.filter(f=>f.data.purpose==='expense').length,0);
 await op(finance,'expense_review',{missionId:id,expenseId:cost.body.id,approved:true});assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_ledger').get().n,0,'expense approval does not pay');
 seed('claim','as_claim',{domain:'home',agentId:'A',serial:'S1',caseId:'case',partCode:'P',quantity:1000,state:'sent',tracking:'RETURN',amountRial:'100000',due:day});
 r=await create('as_claim','claim',agent);const back=r.id;await assign(back);await collect(back);assert.equal(entity('claim').data.state,'sent','driver collection is not internal receipt');await op(driver,'offer',{missionId:back,handoverTo:'پذیرش',day});await op(driver,'receipt',{missionId:back,packages:1,day,result:'complete',location:'RET-1'},403);await op(receiver,'receipt',{missionId:back,packages:1,day,result:'complete',location:'RET-1'});assert.equal(entity('claim').data.state,'received');assert.equal(entity('claim').data.location,'RET-1');assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_ledger').get().n,0,'physical receipt never credits warranty');
 seed('case','as_case',{domain:'home',agentId:'A',serial:'S1',state:'referred',customerName:'Customer',phone:'090',nationalCode:'VERY_PRIVATE',complaint:'PRIVATE MEDICAL'});
 r=await create('as_case','case',agent);await assign(r.id);await collect(r.id);assert.ok(!JSON.stringify(await get(driver,r.id)).includes('VERY_PRIVATE'));assert.ok(!JSON.stringify(await get(driver,r.id)).includes('PRIVATE MEDICAL'));await op(driver,'offer',{missionId:r.id,handoverTo:'پذیرش',day});await op(receiver,'receipt',{missionId:r.id,packages:1,day,result:'complete'});assert.equal(entity('case').data.state,'referred','physical arrival does not fabricate intake');assert.ok(entity('case').data.physicalArrival);
 seed('party','party',{name:'Agent A',active:true,phone:'090',address:'A address',serviceAgentId:'A'});seed('sale','sale',{partyId:'party',state:'in_transit',deviceIds:['D1'],recipient:{name:'Agent A',phone:'090',address:'A address'}});seed('D1','build',{state:'in_transit',saleId:'sale'});sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('D1','device',?,?)").run(JSON.stringify({code:'SERIAL-1',model:'NF5'}),now);balance('D1','in_transit',1000);
 r=await create('sale','sale');await assign(r.id);await collect(r.id);await op(driver,'carrier',{missionId:r.id,carrier:'Carrier',waybill:'W2',day});assert.equal(entity(r.id).data.missingDocuments,true);await op(agent,'receipt',{missionId:r.id,packages:1,day,result:'complete'});assert.equal(entity('D1').data.state,'delivered');assert.equal(sql.prepare("SELECT quantity FROM inventory_balances WHERE item_id='D1' AND warehouse='in_transit'").get().quantity,0);
 await upload(driver,r.id);assert.equal(entity(r.id).data.missingDocuments,false);
 seed('case2','as_case',{domain:'home',agentId:'B',serial:'S2',state:'referred'});await create('as_case','case2');await op(agent,'create',{sourceKey:'as_case:case2',packages:1,route:'direct',pickup:'x',destination:'y',recipient:'z',phone:'1',due:day},403);
 await transport.installTransportPositions(admin);await transport.installTransportPositions(admin);assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='position' AND id LIKE 'transport-position:%'").get().n,2);
 await transport.syncTransportTasks();assert.ok(sql.prepare("SELECT COUNT(*) n FROM duty_runs WHERE template_id LIKE 'transport:%'").get().n>0);
 const user=await context.run(manager,()=>auth.requireAccess());let denied=false;try{await catalog.executeTool('transport_apply',{id:crypto.randomUUID(),mode:'vehicle',revision:0,data:{name:'X',plate:'X',active:true},confirmed:true},base,{user,scope:'read',tokenId:null})}catch{denied=true}assert.ok(denied);
 for(const name of ['upload_transport_file','record_transport_checklist','report_transport_blocker','resolve_transport_blocker','record_transport_vehicle_report'])assert.ok(catalog.discoverTools().some(t=>t.name===name));
 const driverPrincipal=await context.run(driver,()=>auth.requireAccess());
 const result=await catalog.executeTool('record_transport_vehicle_report',{id:crypto.randomUUID(),missionId:id,revision:entity(id).revision,reportKind:'reading',day,notes:'MCP mileage evidence',data:{odometer:'1001'},confirmed:true},base,{user:driverPrincipal,scope:'read_write',tokenId:null});assert.ok(result);assert.equal(entity(id).data.vehicleReports.at(-1).odometer,1001);
 let deniedMCP=false;try{await catalog.executeTool('report_transport_blocker',{id:crypto.randomUUID(),missionId:id,revision:entity(id).revision,reason:'other',retryDay:day,notes:'No write scope',confirmed:true},base,{user:driverPrincipal,scope:'read',tokenId:null})}catch{deniedMCP=true}assert.ok(deniedMCP);
 const p=load('lib/permissions.ts');assert.throws(()=>p.validatePermissions({...empty,serviceRoles:['agent'],serviceDomains:['home'],serviceAgentId:'A',transportRoles:['manager']}));
 console.log('Transport passed: driver/agent isolation, private documents/prices, partial-damage hold, atomic final inventory receipt, idempotency, actual return custody without warranty credit, source links, costs, positions, tasks and MCP scopes.');
})().catch(e=>{console.error(e);process.exit(1)});
