const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const context=load('lib/mcp/context.ts').mcpActor,permissions=load('lib/permissions.ts'),sales=load('app/api/sales/route.ts'),quoteApi=load('app/api/sales/quote/route.ts'),files=load('app/api/sales/files/route.ts'),accounts=load('app/api/sales/accounts/route.ts'),fulfillment=load('app/api/fulfillment/route.ts'),transport=load('app/api/transport/route.ts'),catalog=load('lib/mcp/tools.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next;};
const base='https://test.local',today=load('lib/duties.ts').dayAt(),past=load('lib/duties.ts').addDay(today,-20),future=load('lib/duties.ts').addDay(today,20),now=new Date().toISOString();
const request=(path,body,origin=base)=>new Request(base+path,{method:body?'POST':'GET',headers:{origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const actor=(id,roles,extra={})=>({userId:'local:'+id,email:id+'@example.com',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],salesRoles:roles,...extra}});
const admin={...actor('admin',[]),isAdmin:true,permissions:permissions.allPermissions},manager=actor('manager',['manager']),staff=actor('staff',['staff']),finance=actor('finance',['finance']),viewer=actor('viewer',['viewer']),warehouse=actor('warehouse',[],{flowRoles:['inventory'],warehouses:['quarantine','finished']}),driver=actor('driver',[],{transportRoles:['driver']}),transportManager=actor('transport',[],{transportRoles:['manager']});
const member=u=>sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'test','active',NULL,?,1,?,?)").run(u.userId.slice(6),u.email,u.name,JSON.stringify(u.permissions),now,now);
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
const entity=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null;};
const all=type=>sql.prepare('SELECT * FROM flow_entities WHERE type=?').all(type).map(r=>({...r,data:JSON.parse(r.data)}));
async function post(api,path,body,u=admin,status=200){const r=await context.run(u,()=>api.POST(request(path,body)));const d=await r.json();assert.equal(r.status,status,body.mode+': '+JSON.stringify(d));return {...d,body};}
let a,b,rep,other;
const op=(mode,extra={},u=finance,status=200)=>post(sales,'/api/sales',{id:crypto.randomUUID(),mode,agentId:a,confirmed:true,notes:'Verified source',...extra},u,status);
const get=async(u=rep,agent='',status=200)=>{const r=await context.run(u,()=>sales.GET(request('/api/sales'+(agent?'?agent='+agent:''))));assert.equal(r.status,status);return r.json();};
const balance=async()=>((await get()).accounts[0]);
const quote=(qty=3,u=rep)=>post(quoteApi,'/api/sales/quote',{agentId:a,items:[{productId:'product',quantity:qty}]},u);
const version=id=>entity(id).revision;
async function upload(u=rep,extra={},status=201){const meta={id:crypto.randomUUID(),agentId:a,confirmed:true,title:'Evidence',...extra},form=new FormData();form.set('metadata',JSON.stringify(meta));form.set('file',new File(['%PDF-test'],'receipt.pdf'));const r=await context.run(u,()=>files.POST(new Request(base+'/api/sales/files',{method:'POST',headers:{origin:base},body:form})));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return {...d,meta};}
const network=load('app/api/sales/network/route.ts'),contract=load('lib/sales-network-contract.ts');
const nw=(mode,extra={},u=manager,status=200)=>post(network,'/api/sales/network',{id:crypto.randomUUID(),mode,confirmed:true,agentId:a,notes:'Actual recorded decision',...extra},u,status);
(async()=>{
 for(const u of [manager,staff,finance,viewer])member(u);
 const second=actor('second',['staff']);member(second);
 const create={name:'Buyer',phone:'02112345678',contact:'Buyer',province:'Tehran',city:'Tehran',address:'Address',active:true,ownerId:'staff',financeId:'finance',managerId:'manager'};
 a=(await op('agent',{...create,agentId:''},manager)).id;b=(await op('agent',{...create,agentId:'',name:'PRIVATE OTHER',ownerId:'second'},manager)).id;
 rep=actor('rep',['agent'],{salesAgentId:a});member(rep);
 assert.equal((await get(staff)).agents.length,1);await get(staff,b,404);assert.equal((await get(manager)).agents.length,2);
 await nw('template',{kind:'representative',title:'Rep standard',cashBps:5000,months:1},staff,403);
 const t=await nw('template',{kind:'representative',title:'Rep standard',cashBps:5000,months:1});
 await nw('template',{kind:'reseller',title:'Reseller standard',cashBps:6000,months:2});
 await nw('partner',{revision:version(a),kind:'representative',ownerId:'staff',contactDays:10,reorderDays:30});
 await nw('contact',{channel:'visit',day:today,nextDue:future,nextAction:'Confirm repeat purchase'},staff);
 await nw('contact',{agentId:b,channel:'visit',day:today,nextDue:future,nextAction:'Leak'},staff,404);
 const c=await nw('case',{kind:'training',title:'Product training',nextDue:future,nextAction:'Schedule training'},rep);
 const caseId=c.body.id;await nw('case_update',{recordId:caseId,revision:version(caseId),state:'closed'},rep,403);await nw('case_update',{recordId:caseId,revision:version(caseId),state:'closed'},staff);assert.equal(entity(caseId).data.state,'closed');
 const ref=(await op('agent',{...create,agentId:'',name:'Referrer'},manager)).id;
 await nw('partner',{agentId:ref,revision:version(ref),kind:'referrer',ownerId:'staff',contactDays:15,reorderDays:90});
 const referralUser=actor('ref',['agent'],{salesAgentId:ref});member(referralUser);
 const agreement=await nw('contract',{agentId:ref,reference:'CONTRACT-1',start:past,end:future,bps:1000});
 await nw('contract_review',{agentId:ref,recordId:agreement.body.id,revision:1,approved:true},finance);
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('product','product',?,?)").run(JSON.stringify({name:'Device',model:'N1',code:'P1',status:'فعال'}),now);
 await op('price',{agentId:'',productId:'product',unitPrice:'1000',active:true,reference:'PRICE'},manager);
 await op('terms',{revision:version(a),creditLimit:'100000',termDays:30});
 const items=[{productId:'product',quantity:1}],terms={cashBps:4000,months:2},source={channel:'phone',contactName:'Buyer',day:today,reference:'Actual negotiation'};
 const q=await post(quoteApi,'/api/sales/quote',{agentId:a,items,salesTerms:terms,referrerId:ref},staff);assert.equal(q.salesTerms.cashBps,4000);assert.equal(q.salesTerms.standardCashBps,5000);assert.equal(q.installments[0].amount,'400');
 const o=await op('order',{items,salesTerms:terms,referrerId:ref,quoteHash:q.quoteHash,requestSource:source},staff);
 await op('order_review',{orderId:o.id,revision:1,approved:true},staff,403);await op('order_review',{orderId:o.id,revision:1,approved:true},manager);
 await op('invoice',{orderId:o.id,revision:version(o.id),reference:'I1',installments:[{due:today,amount:'1000'}]},finance,400);
 await op('invoice',{orderId:o.id,revision:version(o.id),reference:'I1'},finance);const inv=entity(o.id).data.invoiceId;
 assert.equal(entity(inv).data.installments[0].amount,'400');assert.equal(entity(inv).data.referral.bps,1000);
 const pay=await op('payment',{method:'cash',day:today,amount:'500',reference:'P1',cashOrderId:o.id},rep);
 const review={paymentId:pay.id,revision:version(pay.id),approved:true};const races=await Promise.all([1,2].map(()=>context.run(finance,()=>sales.POST(request('/api/sales',{id:crypto.randomUUID(),mode:'payment_review',agentId:a,confirmed:true,notes:'Confirmed',...review})))));assert.equal(races.filter(r=>r.status===200).length,1);assert.equal((await balance()).debt,'500');
 let rows=await load('lib/sales.ts').salesRows();assert.equal(contract.commissionAccount(rows,ref).earned,'50');
 const cancelled=await nw('commission_settlement',{agentId:ref,amount:'10'},referralUser);await nw('commission_review',{agentId:ref,recordId:cancelled.body.id,revision:1,approved:true},finance);await nw('commission_cancel',{agentId:ref,recordId:cancelled.body.id,revision:2},staff,403);await nw('commission_cancel',{agentId:ref,recordId:cancelled.body.id,revision:2},finance);assert.equal(entity(cancelled.body.id).data.state,'cancelled');
 const settlement=await nw('commission_settlement',{agentId:ref,amount:'50'},referralUser);await nw('commission_review',{agentId:ref,recordId:settlement.body.id,revision:1,approved:true},finance);await nw('commission_pay',{agentId:ref,recordId:settlement.body.id,revision:2,reference:'CP1',day:today},finance);
 await op('payment_reverse',{paymentId:pay.id,revision:version(pay.id)},finance);rows=await load('lib/sales.ts').salesRows();assert.equal(contract.commissionAccount(rows,ref).available,'-50');await nw('commission_settlement',{agentId:ref,amount:'1'},referralUser,400);
 const view=await context.run(referralUser,()=>network.GET());const detail=await view.json();assert.equal(detail.agents.length,1);assert.ok(!JSON.stringify(detail).includes('PRIVATE OTHER'));assert.equal(detail.portfolio[0].commission.available,'-50');
 // Quoted snapshots cannot survive a change to the currently active template.
 const stale=await post(quoteApi,'/api/sales/quote',{agentId:a,items},staff);await nw('template',{kind:'representative',title:'Updated',cashBps:6000,months:1,previousId:t.body.id});await op('order',{items,quoteHash:stale.quoteHash,requestSource:source},staff,409);assert.equal(entity(inv).data.salesTerms.cashBps,4000);
 // Pure monetary invariants: oldest-first, protected new cash, matured and bounced priority without extra debt.
 const row=(id,type,data,created='2026-01-01')=>({id,type,data,created,revision:1});
 const invoice=(id,day,due,amount,extra={})=>row(id,'sales_invoice',{agentId:'A',day,amount,installments:[{id:'cash',kind:'cash',due,amount}],...extra},day);
 const payRow=row('P','sales_payment',{agentId:'A',amount:'80',state:'cleared',cashOrderId:'O'}),orderRow=row('O','sales_order',{agentId:'A',amount:'100',salesTerms:{cashBps:5000,months:1},state:'approved'});
 const fixture=[invoice('old','2026-01-01','2026-12-01','100'),invoice('new','2026-09-01','2026-10-01','50',{orderId:'O'}),payRow,orderRow];
 let plan=contract.allocationPlan(fixture,'A','P','2026-10-08');assert.deepEqual(JSON.parse(JSON.stringify(plan.allocations)),[{invoiceId:'new',installmentId:'cash',amount:'50'},{invoiceId:'old',installmentId:'cash',amount:'30'}]);
 fixture[0].data.installments[0].due='2026-10-01';plan=contract.allocationPlan(fixture,'A','P','2026-10-08');assert.equal(plan.allocations[0].invoiceId,'old');assert.equal(plan.allocations[0].amount,'80');
 fixture[0].data.installments[0].due='2026-12-01';fixture.push(row('C','sales_payment',{agentId:'A',amount:'30',state:'bounced'}),row('CA','sales_allocation',{agentId:'A',creditId:'C',invoiceId:'old',installmentId:'cash',amount:'30'}));
 plan=contract.allocationPlan(fixture,'A','P','2026-10-08');assert.equal(plan.allocations[0].amount,'30');assert.equal(plan.allocations[1].invoiceId,'new');assert.equal(plan.recoveries[0].amount,'30');
 const totalAllocated=plan.allocations.reduce((n,a)=>n+BigInt(a.amount),0n);assert.equal(totalAllocated,80n);
 fixture.pop();plan=contract.allocationPlan(fixture,'A','P','2026-10-08');assert.equal(plan.policy,'fifo-v1');assert.equal(plan.unlinkedChecks.length,1);
 assert.equal(contract.termsPlan('101',{cashBps:5000,months:1},today).reduce((n,p)=>n+BigInt(p.amount),0n),101n);
 seed('legacy-check','sales_payment',{agentId:a,method:'check',state:'bounced',amount:'30',day:today,reference:'LEGACY-CHECK'});await nw('check_link',{recordId:'legacy-check',revision:1,invoiceId:inv},staff,403);await nw('check_link',{recordId:'legacy-check',revision:1,invoiceId:inv},finance);assert.equal(entity('legacy-check').data.checkInvoiceId,inv);
 // Browser/MCP parity and read-scope write denial.
 const mcp=await catalog.executeTool('get_sales_network',{},base,{user:staff,scope:'read',tokenId:null});assert.ok(!JSON.stringify(mcp).includes('PRIVATE OTHER'));
 await assert.rejects(()=>catalog.executeTool('sales_network_apply',{id:crypto.randomUUID(),mode:'contact',confirmed:true,data:{agentId:a,channel:'call',day:today,nextDue:future,nextAction:'Follow up',notes:'Actual call'}},base,{user:staff,scope:'read',tokenId:null}),/read-only/);
 sql.prepare("UPDATE app_members SET status='inactive' WHERE id='staff'").run();const denied=await context.run(staff,()=>network.GET());assert.equal(denied.status,403);
 // Generic reset predicates include every new record, preserve identity, and rollback FK-safe deletes.
 const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){const predicate=reset.resetWhere('flow_entities',scope);for(const type of ['sales_template','sales_contact','sales_case','sales_contract','sales_commission_settlement'])assert.ok(sql.prepare('SELECT count(*) n FROM flow_entities WHERE '+predicate+' AND type=?').get(type).n>0);assert.equal(sql.prepare('SELECT count(*) n FROM flow_entities WHERE '+predicate+" AND type='sales_agent'").get().n,0);}
 const before=sql.prepare('SELECT count(*) n FROM flow_entities').get().n;sql.exec('BEGIN');for(const table of Object.keys(reset.resetTables))sql.exec('DELETE FROM '+table+' WHERE '+reset.resetWhere(table,'operations'));assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);sql.exec('ROLLBACK');assert.equal(sql.prepare('SELECT count(*) n FROM flow_entities').get().n,before);
 sql.prepare("UPDATE reset_control SET phase='maintenance',internal=0 WHERE id=1").run();const frozen=await nw('template',{kind:'representative',previousId:all('sales_template').filter(r=>r.data.kind==='representative').sort((a,b)=>b.data.version-a.data.version)[0].id,title:'Frozen',cashBps:5000,months:1},manager,423);assert.equal(all('sales_template').length,3);
 console.log('PASS sales network: templates, negotiated approval, immutable invoice, automatic allocation, commissions/reversals, ownership, MCP, concurrency and reset rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
