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
const shipments=load('app/api/purchase-shipments/route.ts'),files=load('app/api/purchase-shipments/files/route.ts'),contract=load('lib/shipment-contract.ts');
async function ship(mode,b={},status=200,user=actor('foreign')){const body={id:crypto.randomUUID(),confirmed:true,mode,notes:'Actual documented evidence',...b};const r=await context.run(user,()=>shipments.POST(request('/api/purchase-shipments','POST',body)));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return {...d,body};}
const shipment=id=>entities('purchase_shipment').find(s=>s.id===id);
async function attach(sid,kind,reference='DOC-1',user=actor('foreign'),status=200){const s=shipment(sid),id=crypto.randomUUID(),q=new URLSearchParams({id,shipment:sid,revision:String(s.revision),kind,issuedOn:today,reference,filename:'evidence.pdf',confirmed:'true'});const bytes=new TextEncoder().encode('%PDF-1.4 actual uploaded document');const r=await context.run(user,()=>files.POST(new Request(base+'/api/purchase-shipments/files?'+q,{method:'POST',headers:{origin:base},body:bytes})));assert.equal(r.status,status,await r.clone().text());return id;}
const today=load('lib/duties.ts').dayAt();
(async()=>{
 identity=owner;await auth.session();const now=new Date().toISOString();
 const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
 seed('mat','material',{code:'01',name:'Valve',unit:'عدد',specs:'General A'});seed('sup','supplier',{name:'Foreign Factory',route:'foreign',active:true});seed('link','supplier_material',{supplierId:'sup',materialId:'mat',supplierCode:'V-1',supplierSpecs:'Model A',status:'approved'});
 const line={linkId:'link',quantity:'10',unitPrice:'5.5',packaging:'Box 10',netKg:'2',grossKg:'3',volumeM3:'0.04'},create={supplierId:'sup',title:'Valve shipment',reference:'REF-1',currency:'USD',day:today,lines:[line]};
 await ship('create',create,403,actor('domestic'));await ship('create',{...create,lines:[{...line,grossKg:'1'}]},400);await ship('create',{...create,lines:[line,line]},400);
 const a=await ship('create',create);assert.equal((await ship('create',a.body)).repeated,true);
 await ship('actual',{shipmentId:a.id,revision:1,day:today,lines:[line],documentId:'none'},409);
 const pack=await attach(a.id,'packing');await ship('historical',{shipmentId:a.id,revision:1,day:today,documentId:pack,lines:[line]});assert.equal(shipment(a.id).data.state,'loaded');
 let r=await context.run(actor('foreign'),()=>shipments.GET(request('/api/purchase-shipments?link=link&quantity=20&packaging=Box%2010')));let d=await r.json();assert.equal(d.prediction.netKg,4);assert.equal(d.prediction.grossKg,6);assert.equal(d.prediction.volumeM3,0.08);assert.equal(d.prediction.sampleCount,1);assert.ok(!JSON.stringify(d.files).includes('objectKey'));
 r=await context.run(actor('domestic'),()=>shipments.GET(request('/api/purchase-shipments')));d=await r.json();assert.equal(d.shipments.length,0);
 r=await context.run(actor('domestic'),()=>files.GET(request('/api/purchase-shipments/files?id='+pack)));assert.equal(r.status,404);
 await ship('specifications',{linkId:'link',revision:1,materialRevision:1,generalSpecs:'General A',supplierSpecs:'Model B',day:today});assert.equal(entities('supplier_material')[0].data.status,'pending');assert.equal(shipment(a.id).data.actual.lines[0].supplierSpecs,'Model A');
 r=await context.run(actor('foreign'),()=>shipments.GET(request('/api/purchase-shipments?link=link&quantity=20&packaging=Box%2010')));assert.equal((await r.json()).prediction.available,false);
 await ship('specifications',{linkId:'link',revision:1,materialRevision:1,generalSpecs:'General A',supplierSpecs:'Model C',day:today},409);
 const b=await ship('create',{...create,reference:'REF-2'});let s=shipment(b.id),doc=await attach(b.id,'registration');await ship('register',{shipmentId:b.id,revision:s.revision,day:today,reference:'ORDER-1',documentId:doc});
 s=shipment(b.id);doc=await attach(b.id,'permit');await ship('permit',{shipmentId:b.id,revision:s.revision,day:today,reference:'PERMIT-1',documentId:doc});
 s=shipment(b.id);doc=await attach(b.id,'packing');await ship('actual',{shipmentId:b.id,revision:s.revision,day:today,documentId:doc,lines:[{...line,netKg:'2.5',grossKg:'3.5',volumeM3:'0.05',unitPrice:'6'}]});
 s=shipment(b.id);doc=await attach(b.id,'registration','AMEND-1');await ship('amend',{shipmentId:b.id,revision:s.revision,day:today,reference:'AMEND-1',documentId:doc});s=shipment(b.id);assert.equal(s.data.initial.lines[0].netKg,'2');assert.equal(s.data.amendments[0].lines[0].netKg,'2.5');assert.equal(s.data.amendments[0].lines[0].unitPrice,'6');
 for(const kind of ['proforma','invoice','green_sheet'])await attach(b.id,kind);
 const prediction=contract.packingPrediction(entities('purchase_shipment'),{...s.data.actual.lines[0],quantity:'20'});assert.equal(prediction.netKg,5);assert.equal(prediction.sampleCount,1);
 const mcpRead=await catalog.executeTool('get_purchase_shipments',{search:'Valve',supplier:'',material:'',link:'',quantity:'',packaging:''},base,{user:actor('foreign'),scope:'read',tokenId:null});assert.equal(mcpRead.shipments.length,2);
 const mcpWrite=await catalog.executeTool('purchase_shipment_apply',{id:crypto.randomUUID(),confirmed:true,mode:'create',data:{...create,reference:'MCP-3',notes:'Documented MCP draft'}},base,{user:actor('foreign'),scope:'read_write',tokenId:null});assert.ok(mcpWrite.saved);assert.equal(shipment(mcpWrite.id).data.state,'draft');
 const reset=load('lib/reset-contract.ts');sql.exec('BEGIN');sql.exec('DELETE FROM flow_entities WHERE '+reset.resetWhere('flow_entities','operations'));assert.equal(entities('purchase_shipment').length,0);assert.equal(entities('shipment_file').length,0);assert.equal(entities('purchase_specification').length,1);sql.exec('ROLLBACK');assert.equal(entities('purchase_shipment').length,3);
 sql.exec("UPDATE reset_control SET phase='maintenance'");await ship('create',{...create,reference:'FROZEN'},423);assert.equal(entities('purchase_shipment').length,3);sql.exec("UPDATE reset_control SET phase='testing'");
 assert.ok(catalog.tools.some(t=>t.name==='purchase_shipment_apply'));assert.ok(catalog.tools.some(t=>t.name==='upload_purchase_shipment_file'));
 console.log('Purchase shipment tests passed: route privacy, validation, evidence, version, retry, packing forecasts, preserved snapshots, stages and FK-safe reset rollback');
})().catch(e=>{console.error(e);process.exitCode=1;});
