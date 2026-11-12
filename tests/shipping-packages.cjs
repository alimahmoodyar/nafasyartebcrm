const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
let beforeBatch,tail=Promise.resolve(),bwip;
const db={prepare(q){let args=[];return{bind(...values){args=values;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}},batch(statements){const task=tail.then(async()=>{if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn()}sql.exec('BEGIN');try{for(const statement of statements)await statement.run();sql.exec('COMMIT');return[]}catch(e){sql.exec('ROLLBACK');throw e}});tail=task.catch(()=>{});return task}};
const env={DB:db,BUCKET:{},TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64')},cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n==='cloudflare:workers'?{env}:n==='@/app/chatgpt-auth'?{getChatGPTUser:async()=>null}:n==='@bwip-js/generic'?bwip:n.startsWith('@/')||n.startsWith('.')?load((n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n))+'.ts'):require(n),Response,Request,URL,URLSearchParams,Date,Intl,Map,Set,Error,crypto:globalThis.crypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,FormData,File,Blob,Buffer,btoa,atob,structuredClone,setTimeout,clearTimeout,console});return exports}


const context=load('lib/mcp/context.ts').mcpActor,api=load('app/api/fulfillment/route.ts'),labels=load('app/api/finished-packages/route.ts'),transport=load('app/api/transport/route.ts'),contract=load('lib/shipping-packages.ts'),now=new Date().toISOString(),today=load('lib/duties.ts').dayAt(),base='https://test.local';
function actor(id,permissions){const u={userId:'local:'+id,email:id+'@test.local',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],...permissions}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,'test','active',?,1,?,?)").run(id,u.email,id,JSON.stringify(u.permissions),now,now);return u}
const admin={userId:'admin',name:'Admin',email:'owner@example.com',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions},rep=actor('rep',{salesRoles:['agent'],salesAgentId:'agent'}),other=actor('other',{salesRoles:['agent'],salesAgentId:'other-agent'}),driver=actor('driver',{transportRoles:['driver']});
function insert(id,type,data){sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now)}
const record=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
function req(path,b){return new Request(base+path,{method:b?'POST':'GET',headers:{origin:base,...(b?{'content-type':'application/json'}:{})},...(b?{body:JSON.stringify(b)}:{})})}
async function post(u,b,status=200,target=api){const r=await context.run(u,()=>target.POST(req(target===api?'/api/fulfillment':'/api/transport',b))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
async function get(u,q,status=200){const r=await context.run(u,()=>labels.GET(req('/api/finished-packages'+q)));assert.equal(r.status,status,await r.clone().text());return r}
const devices=Array.from({length:10},(_,i)=>'device:'+i),pack={id:crypto.randomUUID(),mode:'pack',saleId:'sale',deviceIds:devices,confirmed:true,senderName:'Test sender',senderPhone:'02100000000',senderCity:'Test city',senderAddress:'Test address',recipientCity:'Test city'};
insert('agent','sales_agent',{name:'Test agency',active:true,kind:'representative'});insert('other-agent','sales_agent',{name:'Other',active:true,kind:'representative'});
sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('product:1','product',?,?)").run(JSON.stringify({code:'1',name:'P',model:'M',packageCapacity:'4'}),now);
insert('sale','sale',{salesAgentId:'agent',partyId:'agent',productId:'product:1',state:'reserved',count:10,deviceIds:devices,recipient:{name:'Test recipient',phone:'09000000000',address:'Test address'}});
for(const [i,id] of devices.entries()){insert(id,'build',{state:'reserved',saleId:'sale'});sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'device',?,?)").run(id,JSON.stringify({code:'NF-'+i,product:'product:1',model:'M'}),now);sql.prepare("INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,'finished',1000)").run(id+'@finished',id);}
(async()=>{
 bwip=await import('@bwip-js/generic');
 for(const v of [-1,0,1.5,101,'bad'])assert.throws(()=>contract.packageCapacity(v));assert.equal(contract.packageCapacity(''),1);const mixed=contract.splitShippingPackages([{deviceId:'a',serial:'a',productId:'p1',model:'M1',capacity:4},{deviceId:'b',serial:'b',productId:'p2',model:'M2',capacity:4}],()=>crypto.randomUUID());assert.equal(mixed.length,2,'Different models cannot share a package');
 await post(rep,pack,403);await post(admin,{id:crypto.randomUUID(),mode:'dispatch',saleId:'sale',deviceIds:devices,carrierId:'driver',handedOver:true},409);await post(admin,{...pack,deviceIds:[...devices,devices[0]]},400);
 await post(admin,pack);await post(admin,pack);const p=record('sale').data.shippingPackages;assert.deepEqual(p.map(x=>x.deviceIds.length),[4,4,2]);assert.equal(new Set(p.flatMap(x=>x.deviceIds)).size,10);assert.equal(record('device:0').data.state,'reserved');
 assert.equal(contract.parseShippingQr(contract.shippingQr('sale',p[0].id)).saleId,'sale');
 await get(other,'?code='+encodeURIComponent(contract.shippingQr('sale',p[0].id)),404);
 const print=await (await get(rep,'?saleId=sale&format=print')).text();assert.ok(print.includes('NF-0'));assert.equal((print.match(/<svg/g)||[]).length,3);assert.ok(!print.includes('مادر'));assert.equal(record('device:0').data.state,'reserved');
 await post(admin,{...pack,id:crypto.randomUUID()},409);
 const dispatch={id:crypto.randomUUID(),mode:'dispatch',saleId:'sale',deviceIds:devices,carrierId:'driver',handedOver:true};await post(admin,dispatch);await post(admin,dispatch);assert.equal(sql.prepare("SELECT SUM(quantity) n FROM inventory_balances WHERE warehouse='finished'").get().n,0);assert.equal(sql.prepare("SELECT SUM(quantity) n FROM inventory_balances WHERE warehouse='in_transit'").get().n,10000);

 const wrong=actor('wrong-driver',{transportRoles:['driver']});
 const pickup=(p,chosen,notes='')=>({id:crypto.randomUUID(),mode:'pickup_package',saleId:'sale',packageId:p.id,deviceIds:chosen,notes,confirmed:true});
 await get(driver,'?code='+encodeURIComponent(contract.shippingQr('sale',p[0].id)));
 await get(wrong,'?code='+encodeURIComponent(contract.shippingQr('sale',p[0].id)),404);
 await post(wrong,pickup(p[0],p[0].deviceIds),403);
 await post(driver,pickup(p[0],[devices[8]]),409);
 await post(driver,pickup(p[0],p[0].deviceIds.slice(0,2)),400);
 const partial=pickup(p[0],p[0].deviceIds.slice(0,2),'two missing');await post(driver,partial);await post(driver,partial);assert.equal(record('sale').data.acknowledgedDeviceIds.length,2);assert.equal(record(devices[0]).data.state,'in_transit');
 await post(driver,pickup(p[0],p[0].deviceIds.slice(2)));await post(driver,pickup(p[1],p[1].deviceIds));assert.equal(record('sale').data.acknowledgedDeviceIds.length,8);
 const sale=record('sale');sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify({...sale.data,transportId:'mission'}),'sale');
 insert('mission','transport',{kind:'sale',salesAgentId:'agent',sourceId:'sale',sourceIds:['sale'],items:devices.map((id,i)=>({deviceId:id,serial:'NF-'+i,quantity:1})),route:'direct',state:'assigned',driverId:'driver',packages:3,receivedDeviceIds:[],history:[]});

 await post(driver,pickup(p[2],p[2].deviceIds));assert.equal(record('mission').data.state,'collected');assert.equal(record('mission').data.collectedDeviceIds.length,10);assert.equal(record('sale').data.acknowledgedDeviceIds.length,10);assert.equal(record(devices[0]).data.state,'in_transit');
 await post(driver,{id:crypto.randomUUID(),mode:'offer',missionId:'mission',revision:record('mission').revision,day:today,handoverTo:'Test representative',notes:'Test handover',confirmed:true},200,transport);
 const receive=(packageId,chosen,notes='')=>({id:crypto.randomUUID(),mode:'receipt',missionId:'mission',revision:record('mission').revision,packageId,deviceIds:chosen,day:today,result:notes?'shortage':'complete',notes,confirmed:true});
 await post(driver,receive(p[0].id,p[0].deviceIds),403,transport);
 await post(rep,receive(p[0].id,[devices[9]]),409,transport);
 const first=receive(p[0].id,p[0].deviceIds);const race=await Promise.all([first,{...first,id:crypto.randomUUID()}].map(body=>context.run(rep,()=>transport.POST(req('/api/transport',body)))));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);await post(rep,first,200,transport);assert.equal(record('mission').data.state,'offered');assert.equal(record('mission').data.receivedDeviceIds.length,4);assert.equal(record(devices[4]).data.state,'in_transit');
 await post(rep,receive(p[1].id,p[1].deviceIds.slice(0,3)),400,transport);
 await post(rep,receive(p[1].id,p[1].deviceIds.slice(0,3),'one serial absent'),200,transport);assert.equal(record('mission').data.state,'disputed');assert.deepEqual(record('mission').data.destinationShortageIds,[devices[7]]);
 await post(rep,receive(p[2].id,p[2].deviceIds),200,transport);assert.equal(record('mission').data.state,'disputed');assert.equal(record('mission').data.receivedDeviceIds.length,9);
 await post(rep,receive(p[1].id,[devices[7]]),200,transport);assert.equal(record('mission').data.state,'delivered');assert.equal(record('sale').data.state,'delivered');assert.equal(record('mission').data.receivedDeviceIds.length,10);
 assert.equal(sql.prepare("SELECT SUM(quantity) n FROM inventory_balances WHERE warehouse='in_transit'").get().n,0);
 await post(rep,receive(p[0].id,p[0].deviceIds),400,transport);
 const read=await (await get(rep,'?code='+encodeURIComponent(contract.shippingQr('sale',p[0].id)))).json();assert.equal(read.mission.receivedDeviceIds.length,10);
 const catalog=load('lib/mcp/tools.ts');for(const name of ['pack_finished_sale','get_finished_shipping_package'])assert.ok(catalog.tools.some(t=>t.name===name));
 console.log('PASS finished packages: 4+4+2 single-model grouping, immutable/reprint identity, no print stock effect, own-agent access, role denial, repeated operation, per-package receipt does not mark other packages missing, partial+remaining receipt, exactly once stock and final delivery.');
})().catch(e=>{console.error(e);process.exitCode=1});



