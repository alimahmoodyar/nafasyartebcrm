const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const f=beforeBatch;beforeBatch=null;f();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db},cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return{env};if(n==='@/app/chatgpt-auth')return{getChatGPTUser:async()=>null};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,Headers,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout,clearTimeout,console},{filename:file});return exports;}

const context=load('lib/mcp/context.ts').mcpActor,profiles=load('lib/profile-review.ts'),runtime=load('lib/service-role-preview.ts'),base='https://test.local',today=load('lib/duties.ts').dayAt();
const admin={userId:'actual-admin',email:'owner@example.com',name:'Actual tester',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};
const position=id=>profiles.profileSession(admin,id,[]);
const api=load('app/api/after-sales/route.ts'),flow=load('app/api/flow/route.ts'),parts=load('app/api/after-sales/parts/route.ts'),commercial=load('app/api/after-sales/commercial/route.ts');
async function form(who,route,body,expected=200){const response=await context.run(who,()=>route.POST(new Request(base+'/api/form',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)})));const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;}
async function read(who,route,url='/api/form'){const response=await context.run(who,()=>route.GET(new Request(base+url)));const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return{data,response};}
const op=(who,route,body)=>form(who,route,{id:randomUUID(),domain:'home',confirmed:true,...body});
const entity=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return{...r,data:JSON.parse(r.data)}};
(async()=>{
 const rep=position('home-service-representative'),warehouse=position('central-store'),engineer=position('technical'),expert=position('home-service'),manager=position('home-service-manager'),ceo=position('ceo'),finance=position('finance-director'),quality=position('quality');
 // Merely entering any role cannot create fixtures, accounts, or another workspace.
 for(const id of ['home-service-representative','home-service','home-service-manager','central-store','technical','quality','logistics','ceo','finance-director']){
  const p=position(id);await runtime.runServiceRolePreview(p,resolved=>{assert.equal(resolved.userId,admin.userId);assert.equal(resolved.isAdmin,false);return Promise.resolve()});
 }
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM training_flow_entities').get().n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM app_members').get().n,0);
 // Regression: a freshly entered role with no shared agency must open every
 // read-only home/form workspace without claiming the agency is inactive.
 for(const route of ['app/api/after-sales/route.ts','app/api/after-sales/parts/route.ts','app/api/after-sales/commercial/route.ts','app/api/after-sales/contracts/route.ts','app/api/after-sales/payments/route.ts','app/api/after-sales/part-repairs/route.ts']){
  const result=await read(rep,load(route),'/api/form?domain=home');assert.ok(!result.data.error,route);
 }
 const ordinary={...rep,profileReview:undefined};
 for(const route of ['app/api/after-sales/route.ts','app/api/after-sales/commercial/route.ts','app/api/after-sales/contracts/route.ts','app/api/after-sales/payments/route.ts']){
  const denied=await context.run(ordinary,()=>load(route).GET(new Request(base+'/api/form?domain=home')));assert.ok([403,404].includes(denied.status),'Ordinary missing-agency account stays denied: '+route);
 }
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n,0,'Opening an empty role creates no agency or financial data');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM training_flow_entities').get().n,0);

 // Existing application warehouse, created using its ordinary owning handler.
 const warehouseOperation=randomUUID(),warehouseId='warehouse:'+warehouseOperation;
 await form(admin,flow,{id:warehouseOperation,mode:'warehouse',confirmed:true,name:'انبار مرکزی پرند',warehouseType:'storage',directReceiptEnabled:true,quarantineWarehouseId:'',parentId:'',serviceDomain:'',serviceOwner:'',locations:['P-1-1-1'],active:true,revision:0});
 const warehouseRead=await read(warehouse,flow);
 assert.equal(warehouseRead.response.headers.get('X-Service-Role-Preview'),'shared');
 assert.ok(warehouseRead.data.warehouses.some(w=>w.id===warehouseId&&w.canReceive));
 await op(warehouse,flow,{mode:'material',code:'99001',name:'قطعه مشترک',unit:'عدد',kind:'raw',specs:'Test',fields:[{key:'appearance',label:'ظاهر',type:'result',unit:'',min:'',max:'',required:true}]});
 // A shared catalog can exist before its first service agency: this was the live failing state.
 const populatedEmpty=await read(rep,api,'/api/after-sales?domain=home');assert.equal(populatedEmpty.data.unassignedProfile,true);assert.equal(populatedEmpty.data.materials.length,0);
 const product=await form(engineer,load('app/api/records/route.ts'),{kind:'product',data:{code:'TEST-E2E',name:'محصول مشترک',group:'اکسیژن‌ساز',model:'E2E',productionMode:'routine',warrantyMonths:'12',status:'فعال',notes:'Test'}},201);
 await op(engineer,load('app/api/production/route.ts'),{mode:'bom',productId:product.record.id,previousVersion:0,lines:[{partCode:'99001',quantity:'1'}]});
 assert.ok(sql.prepare('SELECT id FROM bom_versions WHERE product_id=?').get(product.record.id));
 const newAgent=randomUUID();await form(manager,api,{id:newAgent,mode:'agent',domain:'home',confirmed:true,nationalId:'1234500001',mobile:'09123456789',name:'نماینده مشترک',code:'SHARED-E2E',province:'تهران',city:'تهران',phone:'02100000000',address:'Test',active:true});
 const session=await read(rep,load('app/api/session/route.ts'));
 assert.equal(session.data.permissions.serviceAgentId,newAgent);
 assert.equal(session.data.userId,admin.userId);assert.equal(session.data.isAdmin,false);
 const catalog=await read(expert,parts);assert.ok(catalog.data.materials.some(m=>m.code==='99001'));assert.ok(catalog.data.products.some(p=>p.id===product.record.id));
 await op(expert,parts,{mode:'eligibility',agentId:newAgent,revision:entity(newAgent).revision,products:[{productId:product.record.id}],notes:'Test'});
 const proposal=await op(expert,parts,{mode:'catalog_propose',productId:product.record.id,catalogRevision:0,parts:[{partCode:'99001'}],notes:'Test'});
 await op(ceo,parts,{mode:'catalog_decide',requestId:proposal.id,revision:1,approved:true,notes:'Admin role walkthrough'});
 const credit=await op(expert,commercial,{mode:'credit_propose',agentId:newAgent,limitRial:'100000',notes:'Test'});
 await op(manager,commercial,{mode:'credit_decide',requestId:credit.id,revision:1,approved:true,notes:'Test'});
 const price=await op(manager,commercial,{mode:'part_price_propose',partCode:'99001',priceRial:'100',validFrom:today,notes:'Test'});
 await op(finance,commercial,{mode:'part_price_decide',requestId:price.id,revision:1,approved:true,notes:'Test'});
 const ready=await read(rep,parts,'/api/after-sales/parts?q=99001');assert.equal(ready.data.items.length,1);
 const item=ready.data.items[0];await op(rep,api,{mode:'order',agentId:newAgent,lines:[{tariffId:item.tariffId,quantity:'2',expectedTariffRevision:item.tariffRevision}],notes:'Test'});
 assert.ok(sql.prepare('SELECT id FROM service_ledger WHERE agent_id=?').get(newAgent));
 const receipt=await op(warehouse,flow,{mode:'receipt',receiptVersion:2,warehouseId,materialId:'material:99001',day:today,quantity:'2',receiptNote:'Test shared receipt',noteRoles:[],notePeople:[],evidenceIds:[],deliveryClue:{}});
 assert.ok(receipt.receiptId);
 const started=await op(quality,flow,{mode:'start_incoming_qc',receiptId:receipt.receiptId});
 await op(quality,flow,{mode:'incoming_qc',receiptId:receipt.receiptId,revision:started.revision,accepted:'2',values:{appearance:'pass'},notes:'Test'});
 assert.equal(entity(receipt.receiptId).data.state,'awaiting_warehouse');
 assert.ok(sql.prepare('SELECT batch_id FROM inventory_batches').get());
 const bank=load('app/api/sales/bank/route.ts');
 for(const id of ['sales-finance','treasurer']){const current=await read(position(id),bank,'/api/sales/bank?roleTest=true');assert.ok(current.data.agents.some(a=>a.id===newAgent),'Legacy roleTest links see shared service representative');}
 assert.equal((await context.run(rep,()=>bank.GET(new Request(base+'/api/sales/bank?roleTest=true')))).status,403);
 const other=await form(rep,api,{id:randomUUID(),mode:'create',domain:'home',agentId:'OTHER',serial:'S',customer:'C',phone:'09123456789',day:today,complaint:'fault'},403);assert.ok(other.error);
 const hospital=await context.run(rep,()=>api.GET(new Request(base+'/api/after-sales?domain=hospital')));assert.equal(hospital.status,403);
 const setup=load('app/api/role-profiles/warehouse-setup/route.ts');await form(admin,setup,{mode:'warehouse'},410);await form(rep,setup,{mode:'warehouse'},403);
 for(const table of ['flow_entities','records','inventory_batches','service_ledger','app_members'])assert.equal(sql.prepare('SELECT COUNT(*) n FROM training_'+table).get().n,0,table+' never redirected');
 assert.ok(sql.prepare("SELECT actor FROM access_audit WHERE action='automatic_representative_account'").all().every(a=>a.actor===admin.userId));
 assert.equal(entity(newAgent).data.creditLimitRial,'100000');
 console.log('PASS shared role workflow: existing Parand warehouse, catalog, BOM, representative, approvals, order, receipt/QC and bank visibility share application records; actor/scope preserved; no implicit training writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
