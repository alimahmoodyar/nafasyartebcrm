const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{for(const s of stmts)await s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');console.error('DB rollback',e.message);throw e;}}};
let user={userId:'owner',name:'Owner',isAdmin:true,permissions:{finance:'write'}};
class AccessError extends Error{constructor(m,s){super(m);this.status=s;}}
const auth={AccessError,requireAccess:async()=>user,checkOrigin:r=>{if(r.headers.get('origin')!=='https://test.local')throw new AccessError('origin',403);},accessResponse:e=>e instanceof AccessError?Response.json({error:e.message},{status:e.status}):null};
const objects=new Map();const bucket={async put(k,v){objects.set(k,new Uint8Array(v));},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}:null;},async delete(k){objects.delete(k);}};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==='cloudflare:workers')return {env:{DB:db,BUCKET:bucket}};const p=n.startsWith('@/')?path.resolve(root,n.slice(2)+'.ts'):n.startsWith('.')?path.resolve(path.dirname(file),n+'.ts'):'';if(p.replace(/\\/g,'/').endsWith('/lib/storage.ts'))return {storage:()=>db};if(p.replace(/\\/g,'/').endsWith('/lib/authorization.ts'))return auth;if(p.replace(/\\/g,'/').endsWith('/lib/firmware-storage.ts'))return {firmwareBucket:()=>bucket,boundedBody:async(r,max)=>{const v=new Uint8Array(await r.arrayBuffer());if(v.length>max)throw new AccessError('large',413);return v;}};if(p.replace(/\\/g,'/').endsWith('/lib/sourcing.ts'))return {hasSupply:(u,r)=>u.isAdmin||u.permissions.supplyRoles?.includes(r),day:v=>{assert.match(v,/^\d{4}-\d{2}-\d{2}$/);return v;}};if(p.replace(/\\/g,'/').endsWith('/lib/firmware.ts'))return {sha256:async v=>require('node:crypto').createHash('sha256').update(new Uint8Array(v)).digest('hex')};if(p)return load(p);return require(n)},Response,Request,URL,Error,Date,Intl,Map,Set,TextEncoder,TextDecoder,Uint8Array,crypto:globalThis.crypto,structuredClone,console},{filename:file});return exports;}

const api=load('app/api/purchase-payables/route.ts'),filesApi=load('app/api/purchase-payables/files/route.ts');
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-10-01','2026-10-01');
const body=(mode,extra={})=>({mode,id:crypto.randomUUID(),confirmed:true,notes:'Actual evidence reviewed',revision:0,...extra});
async function post(b,status=200){const r=await api.POST(new Request('https://test.local/api/purchase-payables',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(b)}));const d=await r.json();assert.equal(r.status,status,b.mode+': '+JSON.stringify(d));return d;}
async function get(){const r=await api.GET();assert.equal(r.status,200);return r.json();}
let cid;async function current(){return (await get()).cases.find(c=>c.id===cid);}async function action(mode,extra={},status=200){const c=await current();return post(body(mode,{caseId:cid,revision:c.revision,...extra}),status);}
const buyer={userId:'buyer',name:'Buyer',isAdmin:false,permissions:{supplyRoles:['domestic'],finance:'none'}},finance={userId:'finance',name:'Finance',isAdmin:false,permissions:{supplyRoles:['finance'],finance:'write'}};
(async()=>{
entity('s','supplier',{name:'Supplier'});entity('s2','supplier',{name:'Other'});
entity('o1','purchase_order',{supplierId:'s',supplier:'Supplier',route:'domestic',partCode:'CMP',unit:'عدد',quantity:10000,state:'shipped'});
entity('o2','purchase_order',{supplierId:'s2',supplier:'Other',route:'domestic',partCode:'CMP',unit:'عدد',quantity:10000,state:'shipped'});
for(const m of [buyer,finance])sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,?, 'active',?,?,?)").run(m.userId,m.userId+'@test',m.name,'team',JSON.stringify(m.permissions),'2026-10-01','2026-10-01');
user=buyer;const create=body('create',{supplierId:'s',route:'domestic',title:'Compressors'});cid=(await post(create)).id;await post(create);await post({...create,title:'changed'},409);
await action('payment',{amount:'100',reference:'PAY1',day:'2026-10-01',purpose:'advance',evidence:'bank'},403);
user=finance;const advance=(await action('advance',{amount:'100',due:'2026-10-01',condition:'contract advance',evidence:'CON1',orderId:'o1'}));let c=await current(),aid=c.data.advances[0].id;
await action('release_advance',{itemId:aid});c=await current();assert.equal(c.view.advances[0].released,true);
await action('payment',{amount:'100',reference:'PAY1',day:'2026-10-01',purpose:'advance',evidence:'bank',advanceId:aid,orderId:'o1'});c=await current();const pid=c.data.payments[0].id;assert.equal(c.view.unallocated,'100');assert.equal(c.view.advances[0].remaining,'0');
await action('payment',{amount:'100',reference:'PAY1',day:'2026-10-01',purpose:'duplicate',evidence:'bank'},409);
user=buyer;const invoice={invoiceType:'informal',amount:'150',reference:'INV1',day:'2026-10-02',purpose:'خرید کمپرسور برای تولید',evidence:'invoice.pdf',terms:'30 days after delivery',lines:[{orderId:'o1',quantity:'10',amount:'150',receiptIds:[]}]};await action('invoice',invoice);c=await current();const iid=c.data.invoices[0].id;
await action('invoice',invoice,409);await action('invoice',{...invoice,reference:'BAD',lines:[{orderId:'o2',quantity:'10',amount:'150',receiptIds:[]}]},400);
await action('recognize',{itemId:iid,account:'2101',basis:'invoice'},403);
user=finance;await action('recognize',{itemId:iid,account:'2101 Supplier',basis:'documented title transferred per contract'});
await action('schedule',{itemId:iid,schedule:[{amount:'100',due:'2026-10-02',condition:'advance'},{amount:'50',due:'2026-11-01',condition:'delivery + 30 days'}]});
await action('allocate',{invoiceId:iid,paymentId:pid,amount:'100'});c=await current();assert.equal(c.view.liability,'50');assert.equal(c.view.unallocated,'0');assert.equal(c.view.invoices[0].queue[1].remaining,'50');
await action('allocate',{invoiceId:iid,paymentId:pid,amount:'1'},400);await action('release',{itemId:iid},400);
entity('r1','receipt',{purchaseOrderId:'o1',quantity:10000,accepted:10000,rejected:0,state:'stored'});
user=buyer;await action('match',{itemId:iid,lines:[{orderId:'o1',receiptIds:['r1']}]});
await action('issue',{title:'missing transport invoice',ownerId:'buyer',due:'2026-10-10'});c=await current();const issueId=c.data.issues[0].id;assert.equal(sql.prepare("SELECT COUNT(*) n FROM duty_runs WHERE assignee='buyer' AND state='open' AND template_id LIKE 'purchase-payable:%'").get().n,1);
const fileId=crypto.randomUUID(),url='https://test.local/api/purchase-payables/files?id='+fileId+'&caseId='+cid+'&filename=invoice.pdf';let r=await filesApi.POST(new Request(url,{method:'POST',headers:{origin:'https://test.local'},body:'%PDF fixture'}));assert.equal(r.status,200,await r.text());assert.equal((await filesApi.GET(new Request('https://test.local/api/purchase-payables/files?id='+fileId))).status,200);
user=finance;await action('release',{itemId:iid},400);await action('resolve_issue',{itemId:issueId,evidence:'received transport invoice'});await action('release',{itemId:iid});c=await current();assert.equal(c.view.invoices[0].released,true);assert.equal(sql.prepare("SELECT state FROM duty_runs WHERE id=?").get('ap-task:'+issueId).state,'completed');
const releasedRev=c.revision;await post(body('hold',{caseId:cid,revision:releasedRev-1,itemId:iid}),409);
sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='r1'").run();c=await current();assert.equal(c.view.invoices[0].released,false);await action('release',{itemId:iid});
// Recorded rejection holds the disputed amount without reducing liability.
sql.prepare("UPDATE flow_entities SET data=?,revision=revision+1 WHERE id='r1'").run(JSON.stringify({purchaseOrderId:'o1',quantity:9000,accepted:8000,rejected:1000,state:'stored'}));
await action('release',{itemId:iid},400);await action('dispute',{itemId:iid,amount:'20',evidence:'supplier claim pending'});await action('release',{itemId:iid});c=await current();assert.equal(c.view.liability,'50');assert.equal(c.view.invoices[0].disputed,'20');assert.equal(c.view.invoices[0].queue[1].remaining,'30');assert.equal(c.view.invoices[0].queue[1].held,'20');assert.equal(c.view.invoices[0].released,true);
await action('clear_dispute',{itemId:iid},400);await action('invoice',{...invoice,itemId:iid},400);
await action('payment',{amount:'30',reference:'PAY2',day:'2026-10-03',purpose:'partial settlement',evidence:'bank2',orderId:'o1'});c=await current();await action('allocate',{invoiceId:iid,paymentId:c.data.payments[1].id,amount:'30'});c=await current();assert.equal(c.view.liability,'20');assert.equal(c.view.invoices[0].queue[1].remaining,'0');
await action('void',{kind:'payments',itemId:pid},400);await action('unrecognize',{itemId:iid},400);
const alloc=c.data.allocations[0];await action('void',{kind:'allocations',itemId:alloc.id});c=await current();assert.equal(c.view.unallocated,'100');assert.equal(c.view.liability,'120');
// Permissions and route isolation.
user={userId:'other',permissions:{supplyRoles:['foreign']}};assert.equal((await get()).cases.length,0);assert.equal((await filesApi.GET(new Request('https://test.local/api/purchase-payables/files?id='+fileId))).status,404);
await post(body('hold',{caseId:cid,revision:c.revision,itemId:iid}),404);
user={userId:'rep',permissions:{finance:'write',salesAgentId:'r'}};assert.equal((await api.GET()).status,403);
user={userId:'read',permissions:{finance:'read'}};assert.equal((await api.GET()).status,200);await action('hold',{itemId:iid},403);
user=finance;
// Idempotent atomic transaction and freeze / reset rollback.
const a=body('hold',{caseId:cid,revision:(await current()).revision,itemId:iid});await post(a);await post(a);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations WHERE id=?').get(a.id).n,1);
const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){sql.exec('BEGIN');for(const t of Object.keys(reset.resetTables))sql.exec('DELETE FROM '+t+' WHERE '+reset.resetWhere(t,scope));assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type IN ('purchase_payable','payable_file')").get().n,0);sql.exec('ROLLBACK');}
sql.exec("UPDATE reset_control SET phase='maintenance'");await action('hold',{itemId:iid},409);sql.exec("UPDATE reset_control SET phase='testing'");
assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='cost_price'").get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n,0);
console.log('PASS payables: payment-first and invoice-first, debt vs permission, late receipts, duplicate invoice/payment, allocation ceilings, installments, dispute hold, live invalidation, buyer/finance/read/representative isolation, evidence access, tasks, revisions, retry, freeze and FK-safe reset rollback; no stock/cash/cost posting');
})().catch(e=>{console.error(e);process.exit(1)});
