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


const api=load('app/api/after-sales/route.ts'),fileApi=load('app/api/after-sales/files/route.ts'),printApi=load('app/api/after-sales/print/route.ts'),context=load('lib/mcp/context.ts').mcpActor,service=load('lib/after-sales.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=s=>{const next=tail.then(()=>batch(s));tail=next.catch(()=>{});return next};
const entities=type=>sql.prepare('SELECT * FROM flow_entities WHERE type=?').all(type).map(x=>({...x,data:JSON.parse(x.data)}));
const entity=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
const actor=(role,agent='')=>({userId:role+(agent||'User'),email:role+'@test.local',name:role+(agent||''),isAdmin:false,permissions:{read:[],write:[],eventStages:[],serviceDomains:['home'],serviceRoles:[role],serviceAgentId:agent,warehouses:['raw']}});
async function op(mode,b={},status=200,user){const key=['caseId','orderId','shipmentId','claimId','tariffId'].find(k=>b[k])||(mode==='agent'&&b.agentId?'agentId':'');const body={id:crypto.randomUUID(),mode,domain:'home',...(key?{revision:entity(b[key]).revision}:{}),...b};const go=()=>api.POST(request('/api/after-sales','POST',body)),r=user?await context.run(user,go):await go(),d=await r.json();assert.equal(r.status,status,mode+': '+JSON.stringify(d));return {...d,body};}
async function get(query='',user,status=200){const go=()=>api.GET(request('/api/after-sales?domain=home'+query)),r=user?await context.run(user,go):await go(),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
function seedEntity(id,type,data){const now=new Date().toISOString();sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);}
async function evidence(cid,user,id=crypto.randomUUID(),contents=new Uint8Array([137,80,78,71,13,10,26,10,1]),status=201){const form=new FormData();form.set('file',new Blob([contents]),'serial.png');const r=await context.run(user,()=>fileApi.POST(new Request(base+'/api/after-sales/files?case='+cid+'&purpose=before&requestId='+id,{method:'POST',headers:{origin:base},body:form})));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return {id,d};}
(async()=>{
 identity=owner;await auth.session();const today=load('lib/duties.ts').dayAt(),now=new Date().toISOString();
 for(const role of ['support','intake','technician','coordinator','inventory','logistics','finance']){const a=actor(role);sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'خدمات','active',?,?,1,?,?)").run(a.userId,a.email,a.name,a.userId,JSON.stringify(a.permissions),now,now);}
 seedEntity('material:01','material',{code:'01',name:'Compressor',unit:'عدد'});
 const raw='batch:TEST';sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'batch',?,?)").run(raw,JSON.stringify({code:'B01',partCode:'01',part:'Compressor',unit:'عدد',status:'تأیید',supplier:'private supplier',quantity:'20'}),now);sql.prepare('INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,?,?)').run(raw+'@raw',raw,'raw',20000);
 const a=(await op('agent',{name:'Agent A',code:'A',city:'A',phone:'0912',address:'A',active:true})).id,b=(await op('agent',{name:'Agent B',code:'B',city:'B',phone:'0913',address:'B',active:true})).id,agent=actor('agent',a),other=actor('agent',b);
 const part=(await op('tariff',{kind:'part',name:'Compressor',partCode:'01',priceRial:'100',costRial:'70',validFrom:today,active:true})).id,labor=(await op('tariff',{kind:'labor',name:'Replacement',priceRial:'50',costRial:'0',validFrom:today,active:true})).id;
 await op('order',{agentId:b,lines:[{tariffId:part,quantity:'1'}]},403,agent);
 const order=(await op('order',{agentId:a,lines:[{tariffId:part,quantity:'3'}],notes:'stock'},200,agent)).id;assert.equal((await service.ledger(a))[0].debit,'300');assert.equal(entity(order).data.due,service.monthsAfter(today,1));
 await op('approve_order',{orderId:order,approved:true,notes:'ok'},403,agent);await op('approve_order',{orderId:order,approved:true,notes:'ok'},200,actor('coordinator'));
 const line=entity(order).data.lines[0].id;const prepared=await op('prepare',{orderId:order,allocations:[{lineId:line,batchId:raw,quantity:'2',location:''}],notes:'partial'},200,actor('inventory'));const shipment=prepared.body.id;
 assert.equal(entities('as_shipment').length,1);await op('receive',{shipmentId:shipment,confirmedReceived:true,notes:'not shipped'},400,agent);
 await op('ship',{shipmentId:shipment,carrier:'Carrier',tracking:'REF',eta:today,notes:'sent'},200,actor('logistics'));
 await op('receive',{shipmentId:shipment,confirmedReceived:true,notes:'received'},404,other);await op('receive',{shipmentId:shipment,confirmedReceived:true,notes:'received'},200,agent);
 assert.equal(entity(order).data.state,'approved');const lot=sql.prepare('SELECT * FROM service_lots WHERE owner=?').get(a);assert.equal(lot.quantity,2000);
 const own=await get('',agent);assert.equal(own.agents.length,1);assert.equal(own.lots[0].batch.supplier,undefined);assert.equal(own.raw.length,0);await get('&agent='+b,agent,403);assert.equal((await get('',other)).orders.length,0);
 await op('activation_import',{source:'legacy',rows:[{serial:'S1',day:today,months:12}]});assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_activations').get().n,1);
 const prev=await op('activation_preview',{source:'legacy',rows:[{serial:'S1',day:'2025-01-01',months:12}]});assert.equal(prev.preview[0].status,'conflict');await op('activation_import',{source:'legacy',rows:[{serial:'S1',day:'2025-01-01',months:12}]},400);
 const cid=(await op('create',{serial:'S1',customer:'Customer',phone:'0912',day:today,model:'NF5',complaint:'stopped'},200,agent)).id;
 await get('&case='+cid,other,404);await op('intake',{caseId:cid,day:today,hours:'100',deliverer:'Customer',accessories:'Cable',appearance:'Good'},200,agent);
 const quote={caseId:cid,lines:[{partCode:'01',quantity:'1',customerUnitRial:'0',coverage:'warranty',oldBatchId:'',unknownReason:'legacy serial',fault:'does not start',cause:'unknown',coverageReason:'no visible misuse'}],laborLines:[{tariffId:labor,covered:true,customerRial:'0'}],notes:'diagnosis'};
 await op('diagnose',quote,200,agent);await op('repair',{caseId:cid,notes:'skip authorization'},400,agent);await op('authorize',{caseId:cid,approved:true,notes:'review'},400,actor('coordinator'));
 await evidence(cid,other,crypto.randomUUID(),undefined,404);await evidence(cid,agent,crypto.randomUUID(),new Uint8Array([1,2]),400);const ev=await evidence(cid,agent);await evidence(cid,agent,ev.id,undefined,200);
 const foreignDownload=await context.run(other,()=>fileApi.GET(request('/api/after-sales/files?case='+cid+'&id='+ev.id)));assert.equal(foreignDownload.status,404);
 await op('authorize',{caseId:cid,approved:true,notes:'serial and fault reviewed'},200,actor('coordinator'));await evidence(cid,agent,crypto.randomUUID(),undefined,400);
 const repairLine=entity(cid).data.lines[0].id;
 await op('reserve',{caseId:cid,allocations:[{lineId:repairLine,lotId:lot.id,quantity:'3'}]},409,agent);
 await op('reserve',{caseId:cid,allocations:[{lineId:repairLine,lotId:lot.id,quantity:'1'}]},200,agent);
 const repair=await op('repair',{caseId:cid,notes:'replaced'},200,agent);await op('repair',repair.body,200,agent);assert.equal(sql.prepare('SELECT quantity FROM service_lots WHERE id=?').get(lot.id).quantity,1000);assert.equal(entities('as_claim').length,1);
 await op('deliver',{caseId:cid,day:today,person:'Customer',reference:'signed'},400,agent);
 await op('test',{caseId:cid,tests:[{name:'purity',value:'80',min:'90',max:'96',passed:true}],notes:'incorrect'},400,agent);
 await op('test',{caseId:cid,tests:[{name:'purity',value:'93',min:'90',max:'96',unit:'%',passed:true}],notes:'pass'},200,agent);
 await op('deliver',{caseId:cid,day:today,person:'Customer',reference:'signed'},200,agent);assert.equal(entity(cid).data.partWarrantyEnd,service.monthsAfter(today,6));
 await op('labor',{caseId:cid,notes:'not confirmed'},400,actor('coordinator'));await op('confirm',{caseId:cid,result:'confirmed',person:'Customer',rating:5,paidRial:'0',notes:'works'},403,agent);
 await op('confirm',{caseId:cid,result:'confirmed',person:'Customer',rating:5,paidRial:'0',notes:'works'},200,actor('support'));
 await op('labor',{caseId:cid,notes:'approved'},200,actor('coordinator'));assert.equal((await service.ledger(a)).find(r=>r.kind==='labor_credit').credit,'50');assert.equal(entities('as_claim')[0].data.state,'awaiting_return');
 await op('labor',{caseId:cid,notes:'repeat'},400,actor('coordinator'));
 // Receive/pay in full before faulty part is credited: the later credit remains available.
 const payment=await op('payment',{agentId:a,direction:'received',amountRial:'300',day:today,reference:'bank ref',notes:'received'},200,actor('finance'));let led=await service.ledger(a);const inv=led.find(r=>r.kind==='invoice'),pay=led.find(r=>r.source_id===payment.body.id);
 await op('offset',{agentId:a,debitId:inv.id,creditId:pay.id,amountRial:'300',notes:'allocated'},200,actor('finance'));
 const claim=entities('as_claim')[0].id;await op('return_receive',{claimId:claim,day:today,location:'RETURN-A',notes:'received'},200,actor('inventory'));await op('return_review',{claimId:claim,approved:true,notes:'matches evidence'},200,actor('coordinator'));await op('credit',{claimId:claim,notes:'credit'},200,actor('finance'));
 led=await service.ledger(a);assert.equal(led.find(r=>r.kind==='return_credit').remaining,'100');assert.equal(led.find(r=>r.kind==='invoice').remaining,'0');await op('credit',{claimId:claim,notes:'again'},400,actor('finance'));
 // Prior replacement warranty is traceable and date based, not inferred from main warranty.
 const next=(await op('create',{serial:'S1',customer:'Customer',phone:'0912',day:today,complaint:'again'},200,agent)).id;await op('intake',{caseId:next,day:today,hours:'101',deliverer:'Customer',accessories:'Cable',appearance:'Good'},200,agent);
 await op('diagnose',{...quote,caseId:next,lines:[{...quote.lines[0],coverage:'part_warranty',oldBatchId:raw,unknownReason:''}]},200,agent);
 // Paid repair requires consent even after company authorization.
 const paid=(await op('create',{serial:'PAID',customer:'Paid Customer',phone:'0914',day:today,complaint:'fault'},200,agent)).id;await op('intake',{caseId:paid,day:today,hours:'0',deliverer:'Customer',accessories:'none',appearance:'normal'},200,agent);
 const paidQuote={...quote,caseId:paid,lines:[{...quote.lines[0],coverage:'paid',customerUnitRial:'100'}],laborLines:[]};await op('diagnose',paidQuote,200,agent);await op('authorize',{caseId:paid,approved:true,notes:'review'},200,actor('coordinator'));assert.equal(entity(paid).data.state,'diagnosed');await op('reserve',{caseId:paid,allocations:[]},400,agent);
 await op('consent',{caseId:paid,approved:true,person:'Customer',method:'phone',notes:'approved 100 IRR'},200,agent);assert.equal(entity(paid).data.state,'approved');
 await op('diagnose',paidQuote,200,agent);assert.equal(entity(paid).data.consent,null);assert.equal(entity(paid).data.estimates.length,1);
 // Two different approved cases cannot reserve the last unit concurrently.
 await op('authorize',{caseId:paid,approved:true,notes:'paid review'},200,actor('coordinator'));await op('consent',{caseId:paid,approved:true,person:'Customer',method:'phone',notes:'approved'},200,agent);
 await evidence(next,agent);await op('authorize',{caseId:next,approved:true,notes:'part warranty checked'},200,actor('coordinator'));
 const makeReserve=id=>({mode:'reserve',domain:'home',id:crypto.randomUUID(),caseId:id,revision:entity(id).revision,allocations:[{lineId:entity(id).data.lines[0].id,lotId:lot.id,quantity:'1'}]});
 const race=await Promise.all([paid,next].map(id=>context.run(agent,()=>api.POST(request('/api/after-sales','POST',makeReserve(id))))));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(sql.prepare('SELECT SUM(quantity) n FROM service_reservations WHERE lot_id=?').get(lot.id).n,1000);
 // Hospital account cannot inspect household workspace.
 const hospital={...actor('technician'),permissions:{...actor('technician').permissions,serviceDomains:['hospital']}};await get('',hospital,403);
 const nativeId='device:NATIVE';sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'device',?,?)").run(nativeId,JSON.stringify({code:'NATIVE',model:'NF5',warrantyMonths:'12'}),now);sql.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),'fixture','warranty:'+nativeId,'issue_warranty_code','{}',now);
 const native=await op('activation_preview',{source:'legacy',rows:[{serial:'NATIVE',day:'2025-01-01',months:12}]});assert.equal(native.preview[0].status,'conflict');
 // A partly-paid request rejected before shipping cannot over-allocate the invoice.
 const cancelOrder=(await op('order',{agentId:a,lines:[{tariffId:part,quantity:'2'}],notes:'pending'})).id;
 const cancelPayment=await op('payment',{agentId:a,direction:'received',amountRial:'75',day:today,reference:'payment',notes:'partial'});
 let cancelLedger=await service.ledger(a),cancelInvoice=cancelLedger.find(r=>r.source_id===cancelOrder),cancelPay=cancelLedger.find(r=>r.source_id===cancelPayment.body.id);await op('offset',{agentId:a,debitId:cancelInvoice.id,creditId:cancelPay.id,amountRial:'75',notes:'partial payment'});
 await op('approve_order',{orderId:cancelOrder,approved:false,notes:'rejected'});cancelLedger=await service.ledger(a);assert.equal(cancelLedger.find(r=>r.id===cancelInvoice.id).remaining,'0');assert.equal(cancelLedger.find(r=>r.kind==='order_cancel').remaining,'75');
 const repReport=await get('&report=1&from='+today+'&to='+today,agent);assert.equal(repReport.cases,3);assert.equal(repReport.people.length,1);assert.equal(repReport.agents.length,1);
 // A workflow task cannot be marked completed instead of doing the business action.
 const task=sql.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'after-sales:%' AND state='open' LIMIT 1").get();const tr=await load('app/api/tasks/route.ts').POST(request('/api/tasks','POST',{id:crypto.randomUUID(),mode:'cancel',taskId:task.id,revision:task.revision,note:'bypass'}));assert.equal(tr.status,400);
 const outsider={...actor('none'),permissions:{read:[],write:[],eventStages:[]}};await get('',outsider,403);
 // Exact calendar month clamping and scoped printed documents.
 const print=await context.run(agent,()=>printApi.GET(request('/api/after-sales/print?case='+cid+'&kind=warranty')));assert.equal(print.status,200);assert.match(await print.text(),/S1/);
 const solar=load('lib/device-analytics.ts');assert.equal(solar.solarParts(service.monthsAfter(solar.solarToIso(1405,6,31),6)).day,29);
 token=(await mint('read')).token;assert.ok(!(await call('get_after_sales',{domain:'home',case:cid})).error);const args={id:crypto.randomUUID(),domain:'home',mode:'followup',revision:entity(paid).revision,data:{caseId:paid,nextDue:today,notes:'MCP'},confirmed:true};assert.ok((await call('after_sales_apply',args)).error);
 token=(await mint('read_write')).token;assert.ok((await call('after_sales_apply',{...args,confirmed:false})).error);assert.ok(!(await call('after_sales_apply',args)).error);
 assert.ok(sql.prepare("SELECT 1 FROM duty_runs WHERE template_id LIKE 'after-sales:%'").get());
 console.log('After-sales passed: isolated agents/domains, partial supply, invoice deadline, proof gate, consent invalidation, inventory/repair idempotency, QA/delivery, six-month part warranty, labor independent of returns, payment allocation, credit after payment, scoped files/print and MCP confirmation.');
})().catch(e=>{console.error(e);process.exit(1)});
