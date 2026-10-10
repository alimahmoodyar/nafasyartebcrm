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

const suppliers=load('app/api/suppliers/route.ts'),domain=load('lib/suppliers.ts');
const qc={...actor('qc'),permissions:{...actor('qc').permissions,flowRoles:['qc'],supplyRoles:[]}};
async function supplier(mode,b={},status=200,user=actor('domestic')){const body={id:crypto.randomUUID(),confirmed:true,mode,...b};const r=await context.run(user,()=>suppliers.POST(request('/api/suppliers','POST',body))),d=await r.json();assert.equal(r.status,status,mode+': '+JSON.stringify(d));return {...d,body};}
(async()=>{
 identity=owner;await auth.session();
 const today=load('lib/duties.ts').dayAt(),later=new Date(Date.now()+10*86400000).toISOString().slice(0,10),future=new Date(Date.now()+20*86400000).toISOString().slice(0,10),now=new Date().toISOString();
 for(const role of ['sales','ceo','inventory','engineering','finance','domestic','foreign']){const a=actor(role);sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',?,?,1,?,?)").run(a.userId,a.email,a.name,a.userId,JSON.stringify(a.permissions),now,now);}
 const p=await create('product',{code:'SUP',name:'SupplierTest',group:'G',model:'M',warrantyMonths:'12',status:'فعال'});
 await op('material',{code:'01',name:'Part',unit:'عدد',specs:'V1',defaultLocation:'A-1-1-1',reorderPoint:'0',targetStock:'0',fields:[{key:'quality',label:'Quality',type:'number',unit:'%',min:'90',max:'100',required:true}],qcOwner:'',warehouseOwner:'',procurementOwner:'',revision:0});
 const material=entities('material')[0];
 await source('routes',{materialId:material.id,revision:material.revision,routes:['domestic']},200,actor('engineering'));
 await operate({mode:'bom',productId:p.id,previousVersion:0,lines:[{partCode:'01',name:'Part',unit:'عدد',quantity:'2'}]});
 const supplierBody={name:'Factory A',country:'ایران',phone:'02100000000',contact:'Contact',route:'domestic',kind:'manufacturer',active:true};
 await supplier('supplier',supplierBody,403,actor('sales'));
 await supplier('supplier',{...supplierBody,confirmed:false},400);
 const s1=await supplier('supplier',supplierBody),s2=await supplier('supplier',{...supplierBody,name:'Factory B'});
 assert.equal((await supplier('supplier',s1.body)).repeated,true);
 const l1=await supplier('link',{supplierId:s1.id,materialId:material.id}),l2=await supplier('link',{supplierId:s2.id,materialId:material.id});
 await supplier('link',{supplierId:s1.id,materialId:material.id},409);
 assert.equal((await domain.supplierMetrics(entities('supplier_material')[0])).quality,null);
 const review={linkId:l1.id,revision:1,status:'approved',qualityRisk:'low',supplyRisk:'medium',reviewDue:future,rationale:'Sample verified',evidence:'QC-123',scores:{}};
 await supplier('review',review,403,actor('ceo'));await supplier('review',{...review,scores:{quality:101}},400,qc);
 await supplier('review',review,200,qc);assert.equal(entities('supplier_review')[0].data.score,null);
 const pid=(await source('create',{productId:p.id,count:5,origin:'forecast',needBy:future,reference:'RFQ',notes:'test'},200,actor('sales'))).planId;
 await source('approve',{planId:pid,count:5,needBy:future,notes:'approved'},200,actor('ceo'));await source('calculate',{planId:pid,notes:'start'},200,actor('inventory'));
 let d=await detail(pid,actor('domestic'));assert.equal(d.work.filter(w=>w.role==='domestic').length,2);assert.ok(d.work.some(w=>w.instructions?.includes('02100000000')&&w.instructions.includes('V1')));
 const task=sql.prepare("SELECT * FROM duty_runs WHERE assignee='domesticUser' AND state='open' LIMIT 1").get();assert.ok(JSON.parse(task.data).sourcingWorkflow);
 const tasks=load('app/api/tasks/route.ts');assert.equal((await context.run(actor('domestic'),()=>tasks.POST(request('/api/tasks','POST',{id:crypto.randomUUID(),mode:'submit',taskId:task.id,revision:task.revision,note:'done'})))).status,400);
 const quote={planId:pid,partCode:'01',route:'domestic',supplierLinkId:l1.id,supplier:'spoof',unitPrice:'100',currency:'IRR',fxRate:'1',fxDate:today,fxSource:'rial',extrasRial:'0',costNotes:'included',eta:later,validUntil:future,paymentTerms:'cash',specs:'V1',reference:'Q-1'};
 await source('quote',{...quote,supplierLinkId:''},400,actor('domestic'));
 await source('quote',quote,200,actor('domestic'));let q=entities('sourcing_quote')[0];assert.equal(q.data.supplier,'Factory A');
 await source('quote',quote,409,actor('domestic'));
 await source('technical',{planId:pid,quoteId:q.id,quoteRevision:q.revision,result:'pass',notes:'matches'},200,actor('engineering'));
 await source('award',{planId:pid,partCode:'01',quoteId:q.id,notes:'Choose qualified supplier'},400,actor('ceo'));
 assert.equal((await detail(pid,actor('domestic'))).work.filter(w=>w.role==='domestic').length,1);
 await source('quote',{planId:pid,partCode:'01',route:'domestic',supplierLinkId:l2.id,unavailable:true,reason:'No response after follow up'},200,actor('domestic'));
 await source('award',{planId:pid,partCode:'01',quoteId:q.id,notes:'Choose qualified supplier'},400,actor('ceo'));
 q=entities('sourcing_quote').find(x=>x.id===q.id);
 await source('financial_review',{planId:pid,quoteId:q.id,quoteRevision:q.revision,result:'pass',notes:'cost verified'},403,actor('engineering'));
 await source('financial_review',{planId:pid,quoteId:q.id,quoteRevision:q.revision,result:'pass',notes:'cost verified'},200,actor('finance'));
 let link=entities('supplier_material').find(l=>l.id===l1.id);
 await supplier('review',{...review,revision:link.revision,status:'conditional',restrictions:'Trial order',maxQuantity:'1'},200,qc);
 await source('award',{planId:pid,partCode:'01',quoteId:q.id,notes:'Choose qualified supplier'},409,actor('ceo'));
 link=entities('supplier_material').find(l=>l.id===l1.id);await supplier('review',{...review,revision:link.revision},200,qc);
 await source('award',{planId:pid,partCode:'01',quoteId:q.id,notes:'Choose qualified supplier'},200,actor('ceo'));
 const order=entities('purchase_order')[0];assert.equal(order.data.supplierLinkId,l1.id);assert.equal(order.data.promisedEta,later);
 await source('finance',{planId:pid,status:'approved',budgetRial:'100000',availableOn:today,notes:'funded'},200,actor('finance'));
 link=entities('supplier_material').find(l=>l.id===l1.id);await supplier('review',{...review,revision:link.revision,status:'suspended'},200,qc);
 await source('issue_order',{planId:pid,orderId:order.id,reference:'PAY'},409,actor('finance'));
 assert.equal(entities('purchase_order')[0].data.state,'awaiting_funding');
 link=entities('supplier_material').find(l=>l.id===l1.id);await supplier('review',{...review,revision:link.revision},200,qc);
 const sp=entities('supplier').find(x=>x.id===s1.id);await supplier('supplier',{...sp.data,supplierId:sp.id,revision:sp.revision,phone:'02111111111'});
 await source('issue_order',{planId:pid,orderId:order.id,reference:'PAY'},409,actor('finance'));
 link=entities('supplier_material').find(l=>l.id===l1.id);await supplier('review',{...review,revision:link.revision},200,qc);
 const qa={...actor('qa'),permissions:{read:[],write:[],eventStages:[],qmsRoles:['qa']}};
 const tech=async(scope,targetId,authority,decision,user,extra={},status=200)=>supplier('technical',{scope,targetId,revision:entities(scope).find(e=>e.id===targetId).revision,authority,decision,reason:'Technical decision based on real evidence',evidence:'QA-REPORT-1',...extra},status,user);
 await tech('supplier_material',l1.id,'quality','hold',qa);
 await source('issue_order',{planId:pid,orderId:order.id,reference:'PAY'},409,actor('finance'));
 await tech('supplier_material',l1.id,'quality','release',qa);
 await source('issue_order',{planId:pid,orderId:order.id,reference:'PAY'},200,actor('finance'));
 await source('receive',{orderId:order.id,day:today,quantity:'10',notes:'received'},200,actor('inventory'));
 const receipt=entities('receipt')[0];await op('incoming_qc',{receiptId:receipt.id,accepted:'9',rejected:'1',values:{quality:'95'},notes:'one rejected'});
 const metrics=await domain.supplierMetrics(link);assert.equal(metrics.quality,90);assert.equal(metrics.delivery,100);
 const foreign=await context.run(actor('foreign'),()=>suppliers.GET(request('/api/suppliers')));assert.equal((await foreign.json()).suppliers.length,0);
 const engineering=await context.run(actor('engineering'),()=>suppliers.GET(request('/api/suppliers')));const safe=await engineering.json();assert.equal(safe.orders[0].data.totalRial,undefined);
 const reviewNow=entities('supplier_material').find(l=>l.id===l1.id);
 const mcpReview=await catalog.executeTool('review_material_supplier',{id:crypto.randomUUID(),linkId:l1.id,revision:reviewNow.revision,status:'approved',qualityRisk:'low',supplyRisk:'medium',reviewDue:future,rationale:'review via same handler',evidence:'QC-MCP',restrictions:'',maxQuantity:'',scores:{},confirmed:true},base,{user:qc,scope:'read_write',tokenId:null});assert.equal(mcpReview.saved,true);
 const pid2=(await source('create',{productId:p.id,count:1,origin:'forecast',needBy:future,reference:'RFQ-2'})).planId;
 await source('approve',{planId:pid2,count:1,needBy:future,notes:'approved'});await source('calculate',{planId:pid2,notes:'start'});
 const oldRound=current(pid2).data.lines[0].round;await source('quote',{...quote,planId:pid2});
 await source('refresh_suppliers',{planId:pid2,notes:'new round after supplier change'},200,actor('engineering'));
 assert.equal(current(pid2).data.lines[0].round,oldRound+1);assert.equal((await detail(pid2,actor('domestic'))).work.filter(w=>w.role==='domestic').length,2);
 assert.ok(entities('sourcing_quote').some(q=>q.data.planId===pid2&&q.data.round===oldRound));
 const guide=await catalog.executeTool('get_supplier_guide',{},base,{user:actor('domestic'),scope:'read',tokenId:null});assert.ok(guide.workflow);
 const result=await catalog.executeTool('get_suppliers',{material:material.id},base,{user:actor('domestic'),scope:'read',tokenId:null});assert.equal(result.links.length,2);
 await assert.rejects(()=>catalog.executeTool('link_material_supplier',{id:crypto.randomUUID(),supplierId:s1.id,materialId:material.id,supplierCode:'',notes:'',confirmed:true},base,{user:actor('domestic'),scope:'read',tokenId:null}),/read-only/);
 await source('refresh_suppliers',{planId:pid,notes:'blocked by active purchase'},400,actor('engineering'));
 const expired={...link,data:{...link.data,reviewDue:'2000-01-01'}},spCurrent=entities('supplier').find(x=>x.id===s1.id),mCurrent=entities('material')[0];assert.ok(domain.qualification(expired,spCurrent,mCurrent).includes('بازبینی')||domain.qualification(expired,spCurrent,mCurrent).includes('ارزیابی'));
 const changed={...mCurrent,data:{...mCurrent.data,specs:'V2'}};assert.ok(domain.qualification({...link,data:{...link.data,supplierRevision:spCurrent.revision}},spCurrent,changed).includes('مشخصات'));
 // Independent technical holds, permission boundaries, stale design and reset coverage.
 const engineer=actor('engineering');
 await tech('material',material.id,'engineering','hold',engineer);
 await tech('material',material.id,'quality','hold',qa);
 await assert.rejects(()=>domain.checkPurchaseTechnical(material.id,l1.id),/توقف فنی/);
 await tech('material',material.id,'engineering','release',qa,{},403);
 await tech('material',material.id,'engineering','release',engineer);
 await assert.rejects(()=>domain.checkPurchaseTechnical(material.id,l1.id),/توقف فنی/);
 const freshQuote={...quote,planId:pid2};await source('quote',freshQuote,409,actor('domestic'));
 await tech('material',material.id,'quality','release',qa);
 await domain.checkPurchaseTechnical(material.id,l1.id);
 const oldMaterial=entities('material').find(m=>m.id===material.id);
 const args={id:crypto.randomUUID(),confirmed:true,targetId:material.id,scope:'material',revision:oldMaterial.revision,authority:'engineering',decision:'change',reason:'Design revision after service feedback',evidence:'SERVICE-REPORT',specs:'V2'};
 const mp={user:engineer,scope:'read_write',tokenId:null};await catalog.executeTool('control_purchase_technical',args,base,mp);
 assert.equal((await catalog.executeTool('control_purchase_technical',args,base,mp)).repeated,true);
 assert.equal(entities('material').find(m=>m.id===material.id).data.designVersion,1);
 await tech('material',material.id,'engineering','release',engineer);
 await source('quote',freshQuote,409,actor('domestic'));
 await assert.rejects(()=>domain.checkPurchaseTechnical(material.id,'',{specs:oldMaterial.data.specs,designVersion:0}),/طراحی/);
 await tech('supplier_material',l1.id,'quality','hold',actor('domestic'),{},403);
 const viewer={...qa,permissions:{...qa.permissions,qmsRoles:['observer']}};assert.equal(domain.technicalAuthorities(viewer).length,0);
 const qaRead=await context.run(qa,()=>suppliers.GET(request('/api/suppliers')));assert.equal(qaRead.status,200);assert.equal((await qaRead.json()).orders[0].data.totalRial,undefined);
 assert.equal((await context.run(qa,()=>sourcing.GET(request('/api/sourcing')))).status,200);
 await assert.rejects(()=>catalog.executeTool('control_purchase_technical',{...args,id:crypto.randomUUID()},base,{...mp,scope:'read'}),/read-only/);
 const reset=load('lib/reset-contract.ts');assert.ok(reset.resetFlowCatalog.includes('material'));assert.ok(reset.resetFlowCatalog.includes('supplier_material'));
 sql.exec("UPDATE reset_control SET phase='maintenance'");await tech('material',material.id,'quality','hold',qa,{},423);sql.exec("UPDATE reset_control SET phase='testing'");
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 console.log('Supplier workflow passed: permissions, confirmation, idempotency, unique links, evidence, null ratings, task contacts, real-action completion, all-target responses, finance gate, conditional ceiling, suspension/requalification at issue, receipt metrics, privacy and MCP.');
})().catch(e=>{console.error(e);process.exit(1)});
