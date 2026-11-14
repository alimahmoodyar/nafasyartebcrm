const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(ss){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sql.exec('BEGIN');try{for(const s of ss)await s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}};
let user,training=false;class AccessError extends Error{constructor(m,s){super(m);this.status=s;}}
const auth={AccessError,requireAccess:async()=>user,session:async()=>user,checkOrigin:r=>{if(r.headers.get('origin')!=='https://test.local')throw new AccessError('origin',403)},accessResponse:e=>e instanceof AccessError?Response.json({error:e.message},{status:e.status}):null};
const objects=new Map(),bucket={async put(k,v){objects.set(k,new Uint8Array(v))},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}:null},async delete(k){objects.delete(k)}};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{const p=n.startsWith('@/')?path.resolve(root,n.slice(2)+'.ts'):n.startsWith('.')?path.resolve(path.dirname(file),n+'.ts'):'';if(p.replaceAll('\\','/').endsWith('/lib/storage.ts'))return {storage:()=>db};if(p.replaceAll('\\','/').endsWith('/lib/authorization.ts'))return auth;if(p.replaceAll('\\','/').endsWith('/lib/training-context.ts'))return {trainingContext:{getStore:()=>training?{}:undefined}};if(p.replaceAll('\\','/').endsWith('/lib/firmware-storage.ts'))return {firmwareBucket:()=>bucket,boundedBody:async(r,max)=>{const v=new Uint8Array(await r.arrayBuffer());if(v.length>max)throw new AccessError('large',413);return v}};if(p.replaceAll('\\','/').endsWith('/lib/firmware.ts'))return {sha256:async v=>require('node:crypto').createHash('sha256').update(new Uint8Array(v)).digest('hex')};if(p)return load(p);return require(n)},Response,Request,URL,Date,Intl,Set,Map,Error,TextDecoder,TextEncoder,Uint8Array,crypto:globalThis.crypto,structuredClone,console},{filename:file});return exports;}
const api=load('app/api/treasury/route.ts'),files=load('app/api/treasury/files/route.ts'),domain=load('lib/treasury.ts');
const person=(id,finance='write')=>({userId:id,name:id,isAdmin:false,permissions:{finance,treasuryWorkflowRoles:({manager:['manager'],treasurer:['treasury'],accountant:['accountant'],ceo:['ceo'],reader:['accountant']})[id]||[],supplyRoles:id==='clerk'?['finance']:[]}}),clerk=person('clerk'),manager=person('manager'),treasurer=person('treasurer'),accountant=person('accountant'),ceo=person('ceo'),reader=person('reader','read');
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2026-10-01','2026-10-01');
const by=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
const body=(mode,id,extra={})=>({id:crypto.randomUUID(),mode,entityId:id||undefined,revision:id?by(id).revision:0,confirmed:true,notes:'Reviewed actual source',...extra});
async function post(b,status=200){const r=await api.POST(new Request('https://test.local/api/treasury',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(b)})),d=await r.json();assert.equal(r.status,status,b.mode+': '+JSON.stringify(d));return d;}
const action=(mode,id,extra,status)=>post(body(mode,id,extra),status);
async function get(){const r=await api.GET();assert.equal(r.status,200);return r.json();}
async function proof(id){const fid=crypto.randomUUID(),r=await files.POST(new Request('https://test.local/api/treasury/files?'+new URLSearchParams({id:fid,caseId:id,filename:'receipt.pdf'}),{method:'POST',headers:{origin:'https://test.local'},body:'%PDF real proof'}));assert.equal(r.status,200,await r.text());return fid;}
async function authorize(id){const original=user;user=ceo;await action('ceo_approve',id);user=original;}
const request=(extra={})=>({title:'Approved supplier expense',party:'Party',destination:'approved-bank-account',direction:'out',category:'expense',currency:'IRR',amount:'100',due:'2026-10-01',referenceDocument:'INV evidence',...extra});
(async()=>{
for(const p of [clerk,manager,treasurer,accountant,ceo,reader])sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,?, 'active',?,?,?)").run(p.userId,p.userId+'@test',p.name,'finance',JSON.stringify(p.permissions),'2026-10-01','2026-10-01');
for(const [id,name,member] of [['tm','خزانه دار','treasurer'],['fm','مدیر مالی','manager'],['ac','مدیر حسابداری','accountant'],['ceo-position','مدیر عامل','ceo']])entity(id,'position',{name,active:true,members:[member]});
user=clerk;await action('account',null,{title:'Bank',number:'A1',kind:'bank',currency:'IRR',opening:'1000',day:'2026-10-01'},403);
user=treasurer;const aid=(await action('account',null,{title:'Bank',number:'A1',kind:'bank',currency:'IRR',opening:'1000',day:'2026-10-01'})).id;await action('approve_account',aid,{},403);user=manager;await action('approve_account',aid);
user=clerk;const rid=(await action('request',null,request())).id;await action('approve',rid,{},403);user=manager;await action('approve',rid);await authorize(rid);await action('execute',rid,{amount:'100',accountId:aid,reference:'X',day:'2026-10-01'},403);
user=treasurer;const fileId=await proof(rid);await action('execute',rid,{amount:'101',accountId:aid,reference:'PAY1',day:'2026-10-01',fileId},400);await action('execute',rid,{amount:'50',accountId:aid,reference:'PAY1',day:'2099-01-01',fileId},400);
const pay=body('execute',rid,{amount:'40',accountId:aid,reference:'PAY1',day:'2026-10-01',fileId});await post(pay);await post(pay);await post({...pay,amount:'39'},409);assert.equal(by(rid).data.state,'partial');await action('execute',rid,{amount:'40',accountId:aid,reference:'PAY1',day:'2026-10-01',fileId},409);
await action('execute',rid,{amount:'1',accountId:aid,reference:'EARLY',day:'2026-09-01',fileId},400);
await action('execute',rid,{amount:'60',accountId:aid,reference:'PAY2',day:'2026-10-01',fileId});assert.equal(by(rid).data.state,'paid');let view=await get();assert.equal(view.accounts[0].ledger,'900');const mid=view.movements.find(m=>m.data.reference==='PAY1').id;
// Balanced statement, stable bank identities, independent match and undo.
const statement={accountId:aid,from:'2026-10-01',to:'2026-10-01',opening:'1000',closing:'900',filename:'bank.xlsx',referenceDocument:'Bank original',rows:[{bankId:'B1',day:'2026-10-01',direction:'out',amount:'40',reference:'PAY1'},{bankId:'B2',day:'2026-10-01',direction:'out',amount:'60',reference:'PAY2'}]};
await action('statement',null,{...statement,closing:'901'},400);const sid=(await action('statement',null,statement)).id;await action('statement',null,statement,409);view=await get();assert.equal(view.bankRows[0].candidates.length,1);await action('match',sid,{rowId:sid+':0',movementId:mid},403);
user=accountant;await action('match',sid,{rowId:sid+':0',movementId:view.movements.find(m=>m.data.reference==='PAY2').id},400);await action('match',sid,{rowId:sid+':0',movementId:mid});await action('match',sid,{rowId:sid+':1',movementId:mid},400);await action('unmatch',sid,{rowId:sid+':0'});assert.equal((await get()).bankRows[0].candidates.length,1);
// Same person with every role still cannot self approve or self reconcile.
const previousTreasurerPermissions=treasurer.permissions;treasurer.permissions={...previousTreasurerPermissions,supplyRoles:['finance'],treasuryWorkflowRoles:['treasury','manager','accountant']};sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(treasurer.permissions),'treasurer');
sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.members',json('[\"manager\",\"treasurer\"]')) WHERE id IN ('fm','tm','ac')").run();user=treasurer;const own=(await action('request',null,request({title:'self review'}))).id;await action('approve',own,{},403);await action('match',sid,{rowId:sid+':0',movementId:mid},403);
treasurer.permissions=previousTreasurerPermissions;sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(treasurer.permissions),'treasurer');
// Outgoing checks reserve the request, do not change bank until settlement.
user=clerk;const crid=(await action('request',null,request({amount:'200'}))).id;user=manager;await action('approve',crid);await authorize(crid);user=treasurer;const cid=(await action('check',null,{number:'CK1',bank:'Bank',accountId:aid,direction:'out',amount:'150',requestId:crid,due:'2026-10-01',location:'safe'})).id,cf=await proof(cid);user=manager;await action('check_issue',cid,{fileId:cf});user=treasurer;const rf=await proof(crid);await action('execute',crid,{accountId:aid,amount:'51',day:'2026-10-01',reference:'TOO-MUCH',fileId:rf},400);assert.equal((await get()).accounts[0].ledger,'900');await action('check_settle',cid,{fileId:cf,reference:'CKPAY',day:'2026-10-01'});assert.equal(by(cid).data.state,'settled');assert.equal(by(crid).data.state,'partial');assert.equal((await get()).accounts[0].ledger,'750');
// Petty cash approvals, duplicate receipt, expense and return ceilings.
user=clerk;const advance=(await action('request',null,request({category:'advance',amount:'100'}))).id;user=manager;await action('approve',advance);await authorize(advance);user=treasurer;const af=await proof(advance);await action('execute',advance,{accountId:aid,amount:'100',day:'2026-10-01',reference:'ADV1',fileId:af});
user=clerk;const expense={requestId:advance,amount:'60',reference:'EXP1',day:'2026-10-01',title:'Travel receipt',referenceDocument:'Original receipt'},eid=(await action('expense',null,expense)).id;await action('expense',null,expense,409);const ef=await proof(eid);user=manager;await action('expense_review',eid,{accepted:true,fileId:ef});user=treasurer;await action('advance_return',advance,{accountId:aid,amount:'41',day:'2026-10-01',reference:'RETURN1',fileId:af},400);await action('advance_return',advance,{accountId:aid,amount:'40',day:'2026-10-01',reference:'RETURN1',fileId:af});assert.equal((await get()).accounts[0].ledger,'690');
// Purchase source: live allowance and atomic payment/allocation without double recording.
entity('supplier','supplier',{name:'Supplier'});entity('po','purchase_order',{supplierId:'supplier',route:'domestic',quantity:1000,state:'shipped'});entity('receipt','receipt',{purchaseOrderId:'po',quantity:1000,accepted:1000,rejected:0,state:'stored'});
const inv={id:'inv',reference:'INVOICE',amount:'100',evidence:'original invoice',recognition:{account:'2101'},lines:[{orderId:'po',receiptIds:['receipt'],quantity:1000,amount:'100'}],schedule:[{id:'installment',due:'2026-10-01',amount:'100',condition:'receipt'}]};const pd={supplierId:'supplier',supplier:'Supplier',route:'domestic',title:'Purchase',invoices:[inv],payments:[],allocations:[],advances:[],issues:[],history:[]};inv.release={basis:load('lib/purchase-payables.ts').releaseBasis(pd,inv,(await domain.treasuryRows()))};entity('ap','purchase_payable',pd);
user=manager;view=await get();const prid=view.requests.find(r=>r.data.source?.caseId==='ap').id;
user=clerk;await action('request',null,request({category:'purchase',sourceKey:'ap:inv:installment'}),409);user=manager;
await action('purchase_review',prid,{destination:'supplier-bank'});await authorize(prid);user=treasurer;const pf=await proof(prid);
sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.state','quality'),revision=revision+1 WHERE id='receipt'").run();
await action('execute',prid,{accountId:aid,amount:'100',day:'2026-10-01',reference:'APPAY',fileId:pf},409);assert.equal(by('ap').data.payments.length,0);
sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.state','stored'),revision=revision+1 WHERE id='receipt'").run();
await action('execute',prid,{accountId:aid,amount:'100',day:'2026-10-01',reference:'APPAY',fileId:pf});assert.equal(by('ap').data.payments.length,1);assert.equal(by('ap').data.allocations.length,1);assert.equal(by(prid).data.state,'paid');
// No leakage to external identities, no stale grants, readonly cannot mutate.
user=reader;assert.equal((await files.GET(new Request('https://test.local/api/treasury/files?id='+fileId))).status,200);await action('request',null,request(),403);
user={...treasurer,permissions:{finance:'write',salesAgentId:'rep'}};assert.equal((await api.GET()).status,403);assert.equal((await files.GET(new Request('https://test.local/api/treasury/files?id='+fileId))).status,403);
user=treasurer;training=true;assert.equal((await api.GET()).status,403);training=false;
sql.prepare("UPDATE app_members SET permissions='{}' WHERE id='treasurer'").run();assert.equal((await api.GET()).status,403);sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(treasurer.permissions),'treasurer');
const stale=body('cancel',crid);user=manager;await action('cancel',crid);await post(stale,409);
// CEO final gate: new and legacy requests, checks, independent actors and invalidated basis.
user=clerk;const gated=(await action('request',null,request())).id;user=manager;await action('approve',gated);
assert.equal(by(gated).data.state,'ceo_review');assert.equal((await get()).requests.find(r=>r.id===gated).authorizationPending,true);
assert.ok(sql.prepare("SELECT id FROM duty_runs WHERE id=? AND state='open'").get('treasury:'+gated+':ceo:ceo'));
assert.equal(sql.prepare("SELECT COUNT(*) n FROM duty_runs WHERE id LIKE ? AND state='open'").get('treasury:'+gated+':execute:%').n,0);
await action('ceo_approve',gated,{},403);user=clerk;const gf=await proof(gated);user=treasurer;
await action('execute',gated,{accountId:aid,amount:'1',day:'2026-10-01',reference:'NO-CEO',fileId:gf},409);
await action('check',null,{number:'NO-CEO-CK',bank:'Bank',accountId:aid,direction:'out',amount:'10',requestId:gated,due:'2026-10-01',location:'safe'},403);
// Even an administrator may not combine finance and CEO approval.
user={...manager,isAdmin:true};await action('ceo_approve',gated,{},403);
user=ceo;sql.prepare("UPDATE app_members SET permissions='{}' WHERE id='ceo'").run();await action('ceo_approve',gated,{},403);
sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(ceo.permissions),'ceo');
const permit=body('ceo_approve',gated);await post(permit);await post(permit);assert.equal(by(gated).data.ceoApproval.actor,'ceo');
assert.equal(sql.prepare("SELECT COUNT(*) n FROM access_audit WHERE target=? AND action='treasury_ceo_approve'").get(gated).n,1);
user={...ceo,isAdmin:true};await action('execute',gated,{accountId:aid,amount:'1',day:'2026-10-01',reference:'SELF-CEO',fileId:gf},403);
// Changed beneficiary or amount invalidates the recorded permit without mutating actual past payments.
sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.destination','changed'),revision=revision+1 WHERE id=?").run(gated);
user=treasurer;await action('execute',gated,{accountId:aid,amount:'1',day:'2026-10-01',reference:'CHANGED',fileId:gf},403);await authorize(gated);
await action('execute',gated,{accountId:aid,amount:'10',day:'2026-10-01',reference:'GATED-PART',fileId:gf});
sql.prepare("UPDATE flow_entities SET data=json_remove(data,'$.ceoApproval'),revision=revision+1 WHERE id=?").run(gated);
await action('execute',gated,{accountId:aid,amount:'1',day:'2026-10-01',reference:'LEGACY',fileId:gf},403);
await load('lib/treasury-tasks.ts').syncTreasuryTasks();assert.equal((await get()).requests.find(r=>r.id===gated).authorizationPending,true);
await authorize(gated);assert.equal(by(gated).data.state,'partial');assert.equal(domain.tPaid(gated,await domain.treasuryRows()).toString(),'10000000');
// Refused final permission never reaches execution.
user=clerk;const refused=(await action('request',null,request())).id;user=manager;await action('approve',refused);user=ceo;await action('ceo_reject',refused);assert.equal(by(refused).data.state,'rejected');
// Incoming receipts still only need finance approval.
user=clerk;const incoming=(await action('request',null,request({direction:'in'}))).id;user=manager;await action('approve',incoming);assert.equal(by(incoming).data.state,'approved');user=treasurer;const inf=await proof(incoming);await action('execute',incoming,{accountId:aid,amount:'100',day:'2026-10-01',reference:'INCOME',fileId:inf});
// Issued legacy outgoing check cannot settle until request gets a final permit.
user=clerk;const legacy=(await action('request',null,request())).id;user=manager;await action('approve',legacy);await authorize(legacy);user=treasurer;
const lc=(await action('check',null,{number:'LEGACY-CK',bank:'Bank',accountId:aid,direction:'out',amount:'100',requestId:legacy,due:'2026-10-01',location:'safe'})).id,lf=await proof(lc);
user=manager;await action('check_issue',lc,{fileId:lf});sql.prepare("UPDATE flow_entities SET data=json_remove(data,'$.ceoApproval'),revision=revision+1 WHERE id=?").run(legacy);
user=treasurer;const before=sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='treasury_movement'").get().n;
await action('check_settle',lc,{fileId:lf,reference:'LEGACY-CKPAY',day:'2026-10-01'},403);assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='treasury_movement'").get().n,before);
await authorize(legacy);await action('check_settle',lc,{fileId:lf,reference:'LEGACY-CKPAY',day:'2026-10-01'});

// Membership changed between permission check and commit rolls back the whole approval.
user=clerk;const race=(await action('request',null,request())).id;user=manager;await action('approve',race);user=ceo;
beforeBatch=()=>sql.prepare("UPDATE app_members SET permissions='{}' WHERE id='ceo'").run();await action('ceo_approve',race,{},409);
assert.equal(by(race).data.state,'ceo_review');assert.equal(by(race).data.ceoApproval,undefined);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM access_audit WHERE target=? AND action='treasury_ceo_approve'").get(race).n,0);
sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(ceo.permissions),'ceo');
user=ceo;sql.exec("UPDATE reset_control SET phase='maintenance'");await action('ceo_approve',race,{},409);assert.equal(by(race).data.ceoApproval,undefined);sql.exec("UPDATE reset_control SET phase='testing'");await action('ceo_approve',race);
// Live guide uses the same authenticated source and cannot approve or mutate anything.
const guideApi=load('app/api/tasks/guide/route.ts');user=treasurer;const guideId='treasury:'+gated+':execute:treasurer';
const auditBefore=sql.prepare('SELECT COUNT(*) n FROM access_audit').get().n,opsBefore=sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;
let response=await guideApi.GET(new Request('https://test.local/api/tasks/guide?taskId='+guideId));assert.equal(response.status,200);let guide=await response.json();assert.equal(guide.kind,'treasury');assert.equal(guide.checks.find(c=>c.key==='ceo').status,'passed');assert.ok(guide.submitChecks.every(c=>c.status==='on_submit'));assert.ok(!JSON.stringify(guide).includes('approved-bank-account'));assert.equal(sql.prepare('SELECT COUNT(*) n FROM access_audit').get().n,auditBefore);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,opsBefore);
sql.prepare("UPDATE flow_entities SET data=json_remove(data,'$.ceoApproval'),revision=revision+1 WHERE id=?").run(gated);
response=await guideApi.GET(new Request('https://test.local/api/tasks/guide?taskId='+guideId));guide=await response.json();assert.equal(guide.checks.find(c=>c.key==='ceo').status,'attention');await authorize(gated);
user=clerk;assert.equal((await guideApi.GET(new Request('https://test.local/api/tasks/guide?taskId='+guideId))).status,404);
assert.equal((await guideApi.GET(new Request('https://test.local/api/tasks/guide?taskId=x&threadId=y'))).status,400);
assert.equal((await guideApi.GET(new Request('https://test.local/api/tasks/guide'))).status,400);
user=manager;
// Both resets remove all treasury operational data, preserve roles, roll back safely.
const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){sql.exec('BEGIN');for(const t of Object.keys(reset.resetTables))sql.exec('DELETE FROM '+t+' WHERE '+reset.resetWhere(t,scope));assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type LIKE 'treasury_%'").get().n,0);assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='position'").get().n,4);sql.exec('ROLLBACK');}assert.ok(by(aid));
user=clerk;sql.exec("UPDATE reset_control SET phase='maintenance'");await action('request',null,request(),409);sql.exec("UPDATE reset_control SET phase='testing'");
assert.ok(sql.prepare("SELECT COUNT(*) n FROM access_audit WHERE action LIKE 'treasury_%'").get().n>10);
assert.equal(sql.prepare('SELECT state FROM duty_runs WHERE id LIKE ?').get('treasury:'+rid+':execute:%').state,'completed');
assert.ok(sql.prepare('SELECT COUNT(*) n FROM duty_notices WHERE task_id LIKE ?').get('treasury:'+rid+':%').n>0);
const policy=load('lib/assistant-policy.ts');
assert.ok(policy.assistantReadNames.has('get_treasury')&&policy.assistantReadNames.has('get_treasury_guide'));
assert.ok(policy.assistantWriteNames.has('treasury_apply'));assert.equal(policy.actionSection('treasury_apply',{}),'treasury');assert.equal(policy.actionSection('get_treasury',{}),'treasury');assert.equal(policy.canOpenSection(reader,'treasury'),true);assert.equal(policy.canOpenSection({permissions:{finance:'write',salesAgentId:'rep'}},'treasury'),false);
// Explicit new workflow grants work without a second position assignment.
const policyRoles=load('lib/permissions.ts');
for(const [job,role] of [['treasurer','treasury'],['finance_director','manager'],['accounting_head','accountant'],['ceo_payment','ceo']]){
 const p=policyRoles.validatePermissions({roleAssignment:{roles:[job]}}),id='assigned-'+job;
 assert.equal(p.finance,'read');
 sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,?, 'active',?,?,?)").run(id,id+'@test',id,'finance',JSON.stringify(p),'2026-10-01','2026-10-01');
 const session={userId:id,isAdmin:false,permissions:p};
 const granted=await domain.treasuryRoles(session,await domain.treasuryRows());
 assert.equal(granted[role],true);assert.equal(granted.write,false);
 for(const other of ['treasury','manager','accountant','ceo'].filter(x=>x!==role))assert.equal(granted[other],false);
 if(role==='manager'){
  entity('assigned-role-review','treasury_request',{...request(),state:'review'});
  await load('lib/treasury-tasks.ts').syncTreasuryTasks();
  assert.equal(sql.prepare('SELECT assignee FROM duty_runs WHERE id=?').get('treasury:assigned-role-review:review:'+id).assignee,id);
 }
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify({finance:'read'}),id);
 await assert.rejects(()=>domain.treasuryRoles(session,[]),e=>e.status===403,'DB revocation beats stale session');
 if(role==='manager'){await load('lib/treasury-tasks.ts').syncTreasuryTasks();assert.equal(sql.prepare('SELECT state FROM duty_runs WHERE id=?').get('treasury:assigned-role-review:review:'+id).state,'cancelled');}
}
assert.equal(policyRoles.validatePermissions({roleAssignment:{roles:['ceo']}}).treasuryWorkflowRoles.length,0,'existing CEO assignment is not expanded');
assert.throws(()=>policyRoles.validatePermissions({roleAssignment:{roles:['production_store_assistant'],warehouses:['raw']}}));

// New approved order -> automatic payable and obligations, no duplicated entry or source payments.
entity('auto-order','purchase_order',{supplierId:'supplier',supplier:'Supplier',route:'domestic',quantity:1000,state:'issued',paymentWorkflowRequired:true,selectedBy:'buyer',partCode:'PART',deliveryStart:'advance_payment',requiredAdvanceRial:'40',deliveryDays:3,pendingPurchaseAgreement:{agreedAt:'2026-10-01T08:00:00+03:30',actor:'buyer',reference:'AGREEMENT',respondent:'Supplier'},quoteSnapshot:{financial:'pass',paymentStages:[{percent:'100',days:0,condition:'contract advance',amountRial:'120'}]}});
user=manager;view=await get();let auto=view.requests.find(r=>r.data.source?.caseId==='order-payable:auto-order');assert.ok(auto);
assert.equal(auto.data.amount,'120');assert.equal(auto.data.state,'review');assert.ok(auto.purchaseBlockers.length);
await get();assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='treasury_request' AND json_extract(data,'$.source.caseId')='order-payable:auto-order'").get().n,1);
await action('purchase_review',auto.id,{destination:'supplier-account',due:'2026-10-01'});await authorize(auto.id);
user=treasurer;const autoProof=await proof(auto.id);const actual=body('execute',auto.id,{amount:'40',accountId:aid,reference:'AUTO-PAY',day:'2026-10-01',fileId:autoProof});
await post(actual);await post(actual);assert.equal(by('order-payable:auto-order').data.payments.length,1);assert.equal(by(auto.id).data.state,'partial');
assert.equal(by('auto-order').data.purchaseConfirmedBy,'buyer');assert.equal(by('auto-order').data.deliveryStartedOn,'2026-10-01');assert.equal(by('auto-order').data.eta,'2026-10-04');
const originalOrder=by('auto-order').data;
sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.quoteSnapshot.paymentStages[0].amountRial','130'),revision=revision+1 WHERE id='auto-order'").run();
await action('execute',auto.id,{amount:'1',accountId:aid,reference:'STALE-PURCHASE',day:'2026-10-01',fileId:autoProof},409);
sql.prepare("UPDATE flow_entities SET data=?,revision=revision+1 WHERE id='auto-order'").run(JSON.stringify(originalOrder));
// Unique bank statement matches purchase automatically and ambiguous rows do not.
const asid=(await action('statement',null,{accountId:aid,from:'2026-10-01',to:'2026-10-01',opening:'1000',closing:'960',filename:'purchase-bank.xlsx',referenceDocument:'bank',rows:[{bankId:'AUTO-BANK',day:'2026-10-01',direction:'out',amount:'40',reference:'AUTO-PAY'}]})).id;
assert.equal(by(asid).data.rows[0].match.automatic,true);assert.equal(by(asid).data.rows[0].match.actor,'system:bank');
// Concurrent source mutation rolls back BOTH the bank movement and payable write.
user=treasurer;const countBefore=by('order-payable:auto-order').data.payments.length;
beforeBatch=()=>sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='auto-order'").run();
await action('execute',auto.id,{amount:'1',accountId:aid,reference:'CONCURRENT-SOURCE',day:'2026-10-01',fileId:autoProof},409);
assert.equal(by('order-payable:auto-order').data.payments.length,countBefore);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='treasury_movement' AND json_extract(data,'$.reference')='CONCURRENT-SOURCE'").get().n,0);
// Invoice replaces contract obligations; same advance is allocated exactly once.
entity('auto-receipt','receipt',{purchaseOrderId:'auto-order',quantity:1000,accepted:1000,rejected:0,state:'stored'});
const acase=by('order-payable:auto-order').data;acase.invoices.push({id:'auto-invoice',reference:'AUTO-INVOICE',invoiceType:'informal',amount:'120',terms:'contract',recognition:{account:'2101'},schedule:[],lines:[{orderId:'auto-order',quantity:1000,amount:'120',receiptIds:['auto-receipt']}]});
sql.prepare("UPDATE flow_entities SET data=?,revision=revision+1 WHERE id='order-payable:auto-order'").run(JSON.stringify(acase));
user=manager;view=await get();const renewed=by('order-payable:auto-order').data;
assert.ok(renewed.advances[0].closed);assert.equal(renewed.invoices[0].schedule[0].due,'2026-10-01');assert.equal(renewed.allocations.length,1);assert.equal(renewed.allocations[0].amount,'40');
await get();assert.equal(by('order-payable:auto-order').data.allocations.length,1);
const invoiceRequest=view.requests.find(r=>r.data.source?.itemId==='auto-invoice');assert.equal(invoiceRequest.data.amount,'80');
await action('purchase_review',invoiceRequest.id,{destination:'supplier-account'});await authorize(invoiceRequest.id);user=treasurer;
await action('execute',auto.id,{amount:'1',accountId:aid,reference:'OLD-STAGE',day:'2026-10-01',fileId:autoProof},409);
const invoiceProof=await proof(invoiceRequest.id);await action('execute',invoiceRequest.id,{amount:'80',accountId:aid,reference:'INVOICE-BALANCE',day:'2026-10-01',fileId:invoiceProof});
assert.equal(load('lib/purchase-payables.ts').apView(by('order-payable:auto-order').data,await domain.treasuryRows()).liability,'0');
// Purchase handlers cannot post payments, including via the shared MCP handler.
const purchasing=load('app/api/purchase-payables/route.ts');user={...clerk,isAdmin:true};
for(const mode of ['payment','execute_payment_request']){const res=await purchasing.POST(new Request('https://test.local/api/purchase-payables',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify({id:crypto.randomUUID(),confirmed:true,mode,caseId:'order-payable:auto-order',revision:by('order-payable:auto-order').revision,notes:'No bypass'})}));assert.equal(res.status,409);}
// Foreign currency shares treasury execution and posts the same shipment history.
entity('fx-shipment','purchase_shipment',{route:'foreign',supplierId:'supplier',supplierName:'Supplier',currency:'USD',initial:{lines:[{unitPrice:'10',quantity:'5'}]},foreign:{order:{day:'2026-10-01',reference:'ORDER'},physical:'ordered',prepayments:[]}});
user=manager;view=await get();const fx=view.requests.find(r=>r.data.source?.caseId==='fx-shipment');assert.equal(fx.data.currency,'USD');assert.equal(fx.data.amount,'50');
await action('purchase_review',fx.id,{destination:'FX-SUPPLIER',due:'2026-10-01'});await authorize(fx.id);
user=treasurer;const fxAccount=(await action('account',null,{title:'USD bank',number:'USD-1',kind:'bank',currency:'USD',opening:'100',day:'2026-10-01'})).id;user=manager;await action('approve_account',fxAccount);user=treasurer;const fxProof=await proof(fx.id);
await action('execute',fx.id,{amount:'10',accountId:aid,reference:'FX-WRONG',day:'2026-10-01',fileId:fxProof},400);
await action('execute',fx.id,{amount:'10',accountId:fxAccount,reference:'FX-PAID',day:'2026-10-01',fileId:fxProof});assert.equal(by('fx-shipment').data.foreign.prepayments.length,1);assert.equal(by('fx-shipment').data.foreign.physical,'preparing');
console.log('PASS treasury: position+grant access, independent approval and reconciliation, partial payments, duplicate/reference/retry, balanced statement and suggestions, check reservation/settlement, petty cash ceilings, live purchase allowance and atomic integration, private evidence, stale permission, maintenance freeze and FK-safe reset rollback.');
})().catch(e=>{console.error(e);process.exit(1)});
