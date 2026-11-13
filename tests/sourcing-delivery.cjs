let clockNow='2026-11-05T20:29:59.000Z';class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clockNow]));}static now(){return new Date(clockNow).getTime();}}
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date:ClockDate,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const production=load('app/api/production/route.ts'),recordsApi=load('app/api/records/route.ts');
async function create(kind,data){const r=await recordsApi.POST(request('/api/records','POST',{kind,data}));const d=await r.json();assert.equal(r.status,201,JSON.stringify(d));return d.record;}
async function operate(b,status=200){const r=await production.POST(request('/api/production','POST',{id:crypto.randomUUID(),...b}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}

const flow=load('app/api/flow/route.ts'),templateApi=load('app/api/quality/templates/route.ts'),qualityApi=load('app/api/quality/reports/route.ts');
async function op(mode,b={},status=200){const r=await flow.POST(request('/api/flow','POST',{id:crypto.randomUUID(),mode,...b}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const entities=type=>sql.prepare('SELECT * FROM flow_entities WHERE type=? ORDER BY created,id').all(type).map(x=>({...x,data:JSON.parse(x.data)}));
const stock=(id,wh)=>sql.prepare('SELECT quantity FROM inventory_balances WHERE item_id=? AND warehouse=?').get(id,wh)?.quantity||0;
// Serialize test transactions as D1 does; callers may still read the same stale version.
let batchTail=Promise.resolve();const rawBatch=db.batch.bind(db);db.batch=stmts=>{const next=batchTail.then(()=>rawBatch(stmts));batchTail=next.catch(()=>{});return next};
const sourcing=load('app/api/sourcing/route.ts'),context=load('lib/mcp/context.ts').mcpActor;
const current=id=>entities('sourcing_plan').find(p=>p.id===id);
const actor=role=>({userId:role+'User',email:role+'@test.local',name:role,isAdmin:false,permissions:{read:[],write:[],eventStages:[],supplyRoles:[role],flowRoles:role==='inventory'?['inventory']:[],warehouses:role==='inventory'?['quarantine','raw']:[]}});
async function source(mode,b={},status=200,user){const body={id:crypto.randomUUID(),mode,...(b.planId?{revision:current(b.planId).revision}:{}),...b};const go=()=>sourcing.POST(request('/api/sourcing','POST',body));const r=user?await context.run(user,go):await go(),d=await r.json();assert.equal(r.status,status,mode+': '+JSON.stringify(d));return {...d,operationId:body.id};}
async function detail(id,user){const go=()=>sourcing.GET(request('/api/sourcing?id='+id));const r=user?await context.run(user,go):await go();assert.equal(r.status,200);return r.json();}

(async()=>{
 identity=owner;await auth.session();const now=clockNow,today=()=>load('lib/duties.ts').dayAt(),future='2027-01-31',later='2027-01-01';
 const delivery=load('lib/sourcing-delivery.ts');assert.equal(today(),'2026-11-05');assert.equal(delivery.addDeliveryDays('2026-12-31',1),'2027-01-01');assert.equal(delivery.addDeliveryDays('2028-02-28',1),'2028-02-29');assert.equal(delivery.addDeliveryDays('2026-03-21',0),'2026-03-21');assert.throws(()=>delivery.addDeliveryDays('2026-02-30',1));
 const put=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
 for(const role of ['inventory','engineering','domestic','foreign','ceo','finance','commerce_manager']){const a=actor(role);sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',?,?,1,?,?)").run(a.userId,a.email,a.name,a.userId,JSON.stringify(a.permissions),now,now);}
 await op('material',{code:'41',name:'Delivery clock material',unit:'عدد',specs:'V1',fields:[{key:'visual',label:'Visual',type:'text',unit:'',min:'',max:'',required:true}],revision:0});let material=entities('material')[0];await source('routes',{materialId:material.id,revision:material.revision,routes:['domestic']});material=entities('material')[0];
 put('supplier-A','supplier',{name:'Supplier A',active:true,route:'domestic'});put('link-A','supplier_material',{supplierId:'supplier-A',materialId:material.id,status:'approved',unit:'عدد',specs:'V1',supplierRevision:1,reviewDue:future});
 const makePlan=async reference=>(await source('direct_request',{confirmed:true,reference,materialId:material.id,materialRevision:material.revision,quantity:'10',needPriority:'planned',needBy:future,notes:'Actual requested quantity'},200,actor('inventory'))).planId;
 const quote=(planId,extra={})=>({planId,partCode:'41',route:'domestic',supplierLinkId:'link-A',quoteId:'',quoteRevision:0,unavailable:false,reason:'',supplier:'',unitPrice:'100',currency:'IRR',fxRate:'1',fxDate:today(),fxSource:'',extrasRial:'0',deliveryDays:10,deliveryStart:'confirmation',validUntil:future,paymentTerms:'Agreed terms',...extra});
 const approve=async id=>{let q=entities('sourcing_quote').find(q=>q.id===id);await source('technical',{planId:q.data.planId,quoteId:id,quoteRevision:q.revision,result:'pass',notes:'Matches technical need'},200,actor('engineering'));q=entities('sourcing_quote').find(q=>q.id===id);await source('financial_review',{planId:q.data.planId,quoteId:id,quoteRevision:q.revision,result:'pass',notes:'Cost reviewed'},200,actor('finance'));};
 const issue=async(pid,qid)=>{await approve(qid);const quote=entities('sourcing_quote').find(q=>q.id===qid);const ex=await source('request_exception',{planId:pid,partCode:'41',quoteId:qid,quoteRevision:quote.revision,kind:'contract',title:'Contracted delivery fixture',evidence:'Contract reference',notes:'Single contracted source',confirmed:true},200,actor('domestic'));await source('decide_exception',{planId:pid,exceptionId:ex.operationId,decision:'approve',notes:'Contract checked',confirmed:true},200,actor('ceo'));await source('award',{planId:pid,partCode:'41',quoteId:qid,notes:'Best qualified and timely proposal'},200,actor('commerce_manager'));let order=entities('purchase_order').find(o=>o.data.planId===pid);assert.equal(order.data.eta,'');assert.equal(order.data.promisedEta,'');await source('finance',{planId:pid,status:'approved',budgetRial:'1000',availableOn:today(),notes:'Budget approved'},200,actor('finance'));await source('issue_order',{planId:pid,orderId:order.id,reference:'FUND-'+pid},200,actor('finance'));return entities('purchase_order').find(o=>o.id===order.id);};
 const confirm=(o,extra={})=>({planId:o.data.planId,orderId:o.id,orderRevision:o.revision,confirmed:true,reference:'Supplier accepted order',notes:'Actual acceptance by supplier',...extra});
 const pid=await makePlan('DAYS-1');for(const value of [-1,1.5,'',null,true,3651])await source('quote',quote(pid,{deliveryDays:value}),400,actor('domestic'));
 await source('quote',quote(pid,{eta:later}),400,actor('domestic'));await source('quote',quote(pid,{deliveryStart:'invented'}),400,actor('domestic'));for(const value of ['0','1001'])await source('quote',quote(pid,{deliveryStart:'advance_payment',requiredAdvanceRial:value}),400,actor('domestic'));
 const qid=(await source('quote',quote(pid),200,actor('domestic'))).operationId,q=entities('sourcing_quote').find(q=>q.id===qid);assert.equal(q.data.deliveryDays,10);assert.ok(!('eta' in q.data));assert.equal(delivery.quoteEstimatedEta(q.data,today()),'2026-11-15');
 clockNow='2026-11-05T20:30:01.000Z';assert.equal(today(),'2026-11-06');assert.equal(delivery.quoteEstimatedEta(q.data,today()),'2026-11-16');assert.equal(delivery.quoteEstimatedEta({eta:'2026-12-01'},today()),'2026-12-01');
 let o=await issue(pid,qid);assert.equal(o.data.state,'issued');assert.equal(o.data.eta,'');assert.equal((await load('lib/sourcing.ts').coverage(current(pid)))[0].pipeline,0);let work=await detail(pid,actor('domestic'));assert.ok(work.work.some(w=>w.key==='confirm:'+o.id));assert.ok(work.orders[0].confirmation.needed);
 await source('track',{planId:pid,orderId:o.id,stage:'shipped',eta:later,notes:'Would bypass acceptance',reference:'SHIP'},409,actor('domestic'));
 await source('confirm_purchase',confirm(o,{confirmed:false}),400,actor('domestic'));await source('confirm_purchase',confirm(o),403,actor('finance'));await source('confirm_purchase',confirm(o),403,actor('foreign'));await source('confirm_purchase',confirm(o,{orderRevision:o.revision-1}),409,actor('domestic'));
 const revised=()=>({planId:pid,orderId:o.id,orderRevision:o.revision,confirmed:true,notes:'Supplier revised terms'});
 const reloadOrder=()=>{o=entities('purchase_order').find(x=>x.id===o.id);};
 const proposed={quantity:'9',unitPrice:'105',deliveryDays:10,deliveryStart:'confirmation',paymentTerms:'Revised terms',validUntil:future};
 await source('propose_order_terms',{...revised(),...proposed},200,actor('domestic'));reloadOrder();
 assert.equal(o.data.totalRial,'1000');assert.equal(o.data.termsAmendment.terms.totalRial,'945');
 await source('confirm_purchase',confirm(o),409,actor('domestic'));
 await source('approve_order_terms',{...revised(),result:'pass'},409,actor('ceo'));
 await source('review_order_terms',{...revised(),result:'pass'},403,actor('domestic'));
 const reviewVersion=o.revision;
 await source('review_order_terms',{...revised(),result:'pass'},200,actor('finance'));reloadOrder();
 await source('approve_order_terms',{...revised(),orderRevision:reviewVersion,result:'pass'},409,actor('ceo'));
 await source('approve_order_terms',{...revised(),result:'pass'},200,actor('ceo'));reloadOrder();
 assert.equal(o.data.totalRial,'945');assert.equal(o.data.quantity,9000);assert.equal(o.data.termsAmendment.state,'approved');assert.ok(!o.data.purchaseConfirmedAt);
 clockNow='2026-11-08T08:00:00.000Z';const confirmationBody={id:crypto.randomUUID(),mode:'confirm_purchase',revision:current(pid).revision,...confirm(o),deliveryStartedOn:'2000-01-01',eta:'2099-01-01'};
 let response=await context.run(actor('domestic'),()=>sourcing.POST(request('/api/sourcing','POST',confirmationBody)));assert.equal(response.status,200);o=entities('purchase_order').find(x=>x.id===o.id);assert.equal(o.data.deliveryStartedOn,'2026-11-08');assert.equal(o.data.promisedEta,'2026-11-18');assert.equal(o.data.eta,'2026-11-18');const original=o.data.promisedEta;
 clockNow='2026-11-09T08:00:00.000Z';response=await context.run(actor('domestic'),()=>sourcing.POST(request('/api/sourcing','POST',confirmationBody)));assert.equal(response.status,200);assert.equal((await response.json()).repeated,true);assert.equal(entities('purchase_order').find(x=>x.id===o.id).data.promisedEta,original);await source('confirm_purchase',confirm(o),409,actor('domestic'));
 let task=sql.prepare("SELECT * FROM duty_runs WHERE template_id LIKE ? AND state='open'").get('sourcing:'+pid+':po:'+o.id+'%');assert.ok(task);assert.equal(task.due,'2026-11-18T12:30:00.000Z');
 await source('track',{planId:pid,orderId:o.id,stage:'update',eta:'2026-11-21',notes:'Supplier requested a documented extension',reference:'EXT'},200,actor('domestic'));o=entities('purchase_order').find(x=>x.id===o.id);assert.equal(o.data.promisedEta,original);assert.equal(o.data.eta,'2026-11-21');assert.equal(o.data.history.at(-1).previousEta,'2026-11-18');task=sql.prepare('SELECT * FROM duty_runs WHERE id=?').get(task.id);assert.equal(task.due,'2026-11-21T12:30:00.000Z');assert.ok(JSON.parse(task.data).history.some(h=>h.mode==='delivery_due_updated'));
 const shipmentAction={planId:pid,orderId:o.id,orderRevision:o.revision,confirmed:true,quantity:'4',eta:'2026-11-21',notes:'First announced shipment'};
 await source('save_order_shipment',shipmentAction,403,actor('finance'));
 await source('save_order_shipment',shipmentAction,200,actor('domestic'));reloadOrder();
 assert.equal(o.data.shipments[0].declaredQuantity,4000);
 await source('save_order_shipment',{...shipmentAction,orderRevision:o.revision,shipmentId:o.data.shipments[0].id,waybill:'WAYBILL'},200,actor('domestic'));reloadOrder();
 assert.equal(o.data.shipments.length,1);assert.equal(o.data.shipments[0].waybill,'WAYBILL');
 const extensionBody=()=>({planId:pid,orderId:o.id,orderRevision:o.revision,confirmed:true,notes:'Documented contractual extension'});
 await source('request_delivery_extension',{...extensionBody(),eta:'2026-11-25'},200,actor('domestic'));reloadOrder();
 assert.equal(o.data.promisedEta,original);assert.equal(o.data.approvedDeliveryDue,undefined);
 await source('review_delivery_extension',{...extensionBody(),result:'pass'},403,actor('finance'));
 await source('review_delivery_extension',{...extensionBody(),result:'pass'},200,actor('ceo'));reloadOrder();
 assert.equal(o.data.promisedEta,original);assert.equal(o.data.approvedDeliveryDue,'2026-11-25');
 await source('track',{planId:pid,orderId:o.id,stage:'update',eta:'2026-11-28',notes:'New tracking estimate',reference:'TRACK-2'},200,actor('domestic'));reloadOrder();
 assert.equal(o.data.approvedDeliveryDue,'2026-11-25');assert.equal(o.data.eta,'2026-11-28');
 assert.equal(delivery.purchaseDeliveryStatus(o,[],'2026-11-21').reminder,false);
 assert.equal(delivery.purchaseDeliveryStatus(o,[],'2026-11-22').reminder,true);
 assert.equal(delivery.purchaseDeliveryStatus(o,[],'2026-11-25').late,false);
 assert.equal(delivery.purchaseDeliveryStatus(o,[],'2026-11-26').late,true);
 const arrival={data:{purchaseOrderId:o.id,day:'2026-11-25',quantity:9000,state:'pending_qc'}};
 assert.equal(delivery.purchaseDeliveryStatus(o,[arrival],'2026-11-26').late,false);
 arrival.data.rejected=1000;
 assert.equal(delivery.purchaseDeliveryStatus(o,[arrival],'2026-11-26').missing,1000);
 assert.equal(delivery.purchaseDeliveryStatus(o,[arrival],'2026-11-26').late,true);
 const replacement={data:{purchaseOrderId:o.id,day:'2026-11-27',quantity:1000,state:'pending_qc'}};
 assert.equal(delivery.purchaseDeliveryStatus(o,[arrival,replacement],'2026-11-27').reminder,false);
 assert.equal(delivery.purchaseDeliveryStatus(o,[arrival,replacement],'2026-11-27').late,true);

 const savedClock=clockNow;
 const activeDeliveryTasks=()=>sql.prepare("SELECT template_id,data FROM duty_runs WHERE state='open' AND template_id LIKE ?").all('sourcing:'+pid+':delivery_%');
 clockNow='2026-11-22T08:00:00.000Z';await load('lib/sourcing.ts').syncSourcingFollowups();
 assert.equal(activeDeliveryTasks().filter(t=>t.template_id.includes('delivery_reminder:')).length,1);
 clockNow='2026-11-26T08:00:00.000Z';await load('lib/sourcing.ts').syncSourcingFollowups();await load('lib/sourcing.ts').syncSourcingFollowups();
 assert.equal(activeDeliveryTasks().filter(t=>t.template_id.includes('delivery_reminder:')).length,1);
 assert.equal(activeDeliveryTasks().filter(t=>t.template_id.includes('delivery_alert:')).length,1);
 clockNow=savedClock;
 const legacyPlan=await makePlan('LEGACY-DATE');
 const legacyQuote=(await source('quote',quote(legacyPlan,{deliveryDays:undefined,deliveryStart:undefined,eta:later}),200,actor('domestic'))).operationId;
 await approve(legacyQuote);const legacyEx=await source('request_exception',{planId:legacyPlan,partCode:'41',quoteId:legacyQuote,quoteRevision:entities('sourcing_quote').find(q=>q.id===legacyQuote).revision,kind:'contract',title:'Legacy fixed-date contract',evidence:'Contract document',notes:'Contracted source',confirmed:true},200,actor('domestic'));await source('decide_exception',{planId:legacyPlan,exceptionId:legacyEx.operationId,decision:'approve',notes:'Contract verified',confirmed:true},200,actor('ceo'));await source('award',{planId:legacyPlan,partCode:'41',quoteId:legacyQuote,notes:'Qualified date-based offer'},200,actor('commerce_manager'));
 let legacy=entities('purchase_order').find(x=>x.data.planId===legacyPlan);
 const legacyBody=()=>({planId:legacyPlan,orderId:legacy.id,orderRevision:legacy.revision,confirmed:true,notes:'Revised fixed-date offer'});
 const reloadLegacy=()=>{legacy=entities('purchase_order').find(x=>x.id===legacy.id);};
 await source('propose_order_terms',{...legacyBody(),quantity:'9',unitPrice:'95',eta:'2026-11-26',paymentTerms:'Revised payment terms',validUntil:future},200,actor('domestic'));reloadLegacy();
 await source('issue_order',{planId:legacyPlan,orderId:legacy.id,reference:'Attempt before approval'},409,actor('finance'));
 await source('review_order_terms',{...legacyBody(),result:'pass'},200,actor('finance'));reloadLegacy();
 await source('approve_order_terms',{...legacyBody(),result:'pass'},200,actor('ceo'));reloadLegacy();
 assert.equal(legacy.data.eta,'2026-11-26');assert.equal(legacy.data.deliveryDays,undefined);assert.equal(legacy.data.totalRial,'855');
 await source('finance',{planId:legacyPlan,status:'approved',budgetRial:'1000',availableOn:today(),notes:'Budget approved'},200,actor('finance'));
 await source('issue_order',{planId:legacyPlan,orderId:legacy.id,reference:'FUND-LEGACY'},200,actor('finance'));reloadLegacy();
 await source('confirm_purchase',confirm(legacy),200,actor('domestic'));reloadLegacy();
 assert.equal(legacy.data.promisedEta,'2026-11-26');assert.ok(legacy.data.purchaseConfirmedAt);
 // Exact owner is enforced, not merely membership of the buyer role.
 const pid2=await makePlan('DAYS-ADVANCE');const q2=(await source('quote',quote(pid2,{deliveryDays:7,deliveryStart:'advance_payment',requiredAdvanceRial:'500'}),200,actor('domestic'))).operationId;let o2=await issue(pid2,q2);
 await source('assign_owner',{planId:pid2,role:'domestic',ownerId:'domesticUser',confirmed:true,notes:'Assigned buyer'});const outsider={...actor('domestic'),userId:'otherBuyer'};await source('confirm_purchase',confirm(o2),403,outsider);
 // Exercise historical posting and future-dated evidence on a pre-workflow order.
 const oldPaymentPolicy={...o2.data};delete oldPaymentPolicy.paymentWorkflowRequired;
 sql.prepare('UPDATE flow_entities SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify(oldPaymentPolicy),o2.id);
 o2=entities('purchase_order').find(x=>x.id===o2.id);
 const payables=load('app/api/purchase-payables/route.ts');async function pay(mode,b={},caseId){const body={id:crypto.randomUUID(),mode,confirmed:true,revision:caseId?entities('purchase_payable').find(c=>c.id===caseId).revision:0,notes:'Actual documented finance record',...(caseId?{caseId}:{}),...b};const r=await payables.POST(request('/api/purchase-payables','POST',body)),d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return {caseId:d.id,operationId:body.id};}
 const c=(await pay('create',{supplierId:'supplier-A',route:'domestic',title:'Advance evidence'})).caseId;const advance=(await pay('advance',{orderId:o2.id,amount:'1000',due:today(),condition:'Agreed advance',evidence:'Supplier proforma'},c)).operationId;
 await source('confirm_purchase',confirm(o2),409,actor('domestic'));assert.equal((await detail(pid2,actor('domestic'))).orders[0].confirmation.advanceSatisfied,false);
 const p1=(await pay('payment',{orderId:o2.id,advanceId:advance,amount:'200',day:today(),reference:'PAID-200',purpose:'Supplier advance',evidence:'Bank document'},c)).operationId;
 await pay('payment',{orderId:o2.id,advanceId:advance,amount:'300',day:'2026-12-01',reference:'FUTURE-300',purpose:'Future entry',evidence:'Future document'},c);await pay('payment',{orderId:o2.id,amount:'300',day:today(),reference:'NOT-ADVANCE',purpose:'Other order payment',evidence:'Bank document'},c);
 await source('confirm_purchase',confirm(o2),409,actor('domestic'));const p2=(await pay('payment',{orderId:o2.id,advanceId:advance,amount:'300',day:today(),reference:'PAID-300',purpose:'Balance advance',evidence:'Bank document'},c)).operationId;
 assert.equal((await detail(pid2,actor('domestic'))).orders[0].confirmation.advanceSatisfied,true);
 // A payment voided between read and commit invalidates the confirmation atomically.
 const savedBatch=db.batch;let intercept=true;db.batch=async stmts=>{if(intercept){intercept=false;const row=entities('purchase_payable').find(x=>x.id===c);row.data.payments.find(p=>p.id===p2).voided={actor:'finance',at:clockNow};sql.prepare('UPDATE flow_entities SET data=?,revision=revision+1 WHERE id=?').run(JSON.stringify(row.data),c);}return savedBatch(stmts)};
 await source('confirm_purchase',confirm(o2),409,actor('domestic'));db.batch=savedBatch;assert.ok(!entities('purchase_order').find(x=>x.id===o2.id).data.purchaseConfirmedAt);
 const p3=(await pay('payment',{orderId:o2.id,advanceId:advance,amount:'400',day:today(),reference:'PAID-400',purpose:'Remaining advance',evidence:'Bank document'},c)).operationId;
 const mid=crypto.randomUUID();await catalog.executeTool('confirm_sourcing_purchase',{id:mid,confirmed:true,revision:current(pid2).revision,...confirm(o2)},base,{user:actor('domestic'),scope:'read_write',tokenId:null});o2=entities('purchase_order').find(x=>x.id===o2.id);assert.equal(o2.data.promisedEta,'2026-11-16');assert.deepEqual(o2.data.advanceEvidence[0].paymentIds,[p1,p3]);assert.equal(o2.data.purchaseConfirmedBy,'domesticUser');
 const hidden=(await detail(pid2,actor('engineering'))).orders[0];assert.equal(hidden.data.requiredAdvanceRial,undefined);assert.equal(hidden.data.advanceEvidence,undefined);assert.equal(hidden.confirmation,undefined);
 // Competing confirmations, idempotent replay, reset freeze and FK-safe reset.
 const pid3=await makePlan('DAYS-RACE'),q3=(await source('quote',quote(pid3,{deliveryDays:0}),200,actor('domestic'))).operationId;const o3=await issue(pid3,q3);sql.exec("UPDATE reset_control SET phase='maintenance',internal=0");await source('confirm_purchase',confirm(o3),423,actor('domestic'));assert.ok(!entities('purchase_order').find(x=>x.id===o3.id).data.purchaseConfirmedAt);sql.exec("UPDATE reset_control SET phase='idle',internal=0");
 const version=current(pid3).revision,bodies=[0,1].map(()=>({id:crypto.randomUUID(),mode:'confirm_purchase',revision:version,...confirm(o3)}));const rs=await Promise.all(bodies.map(body=>context.run(actor('domestic'),()=>sourcing.POST(request('/api/sourcing','POST',body)))));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(entities('purchase_order').find(x=>x.id===o3.id).data.eta,today());assert.equal(entities('purchase_order').find(x=>x.id===o3.id).data.history.filter(h=>h.stage==='purchase_confirmed').length,1);
 const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){sql.exec('BEGIN');for(const table of Object.keys(reset.resetTables))sql.exec('DELETE FROM '+table+' WHERE '+reset.resetWhere(table,scope));assert.equal(entities('purchase_order').length,0);assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);sql.exec('ROLLBACK');}
 console.log('PASS delivery days: Tehran/calendar dates, relative RFQ estimates, no deadline at award/issue, buyer/owner/confirmation/version gates, actual advance-only threshold and concurrent void rollback, HTTP/MCP/replay/race, immutable promise and task rescheduling, redaction, zero-day delivery and reset/FK/freeze.');
})().catch(e=>{console.error(e);process.exitCode=1});
