import {isUnassignedServiceProfile} from './service-profile-scope';
import type {Session} from './permissions';
import {storage} from './storage';
import {AccessError} from './authorization';
import {entity,fail} from './after-sales';
import {salesFinance,salesLock,sreq,sday,money} from './sales';
import {bankEntities,recordSalesBankMatch} from './sales-bank';
import {bankCode,bankMatch,isApprovedReceivingAccount,readyBankRowForPayment} from './sales-bank-contract';
import {bankPaymentReviewDue,coveredBankPeriods} from './sales-bank-coverage';
import {serviceBankLedgerStatements} from './service-bank-ledger';
import {dayAt,addDay} from './duties';
import {latinDigits} from './persian-date';
import {sha256} from './firmware';
export const servicePaymentFinance=(u:Session)=>u.isAdmin||!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.hospitalCenterId&&!u.permissions.salesRoles?.includes('agent')&&(salesFinance(u)||u.permissions.serviceDomains?.includes('home')&&u.permissions.serviceRoles?.includes('finance'));
export async function servicePaymentAgent(u:Session,id:string){
 const own=u.permissions.serviceAgentId;if(own?own!==id:!servicePaymentFinance(u))fail('دسترسی پرداخت خدمات ندارید.',403);
 if(own&&(!u.permissions.serviceDomains?.includes('home')||!u.permissions.serviceRoles?.includes('agent')))fail('دسترسی نماینده خدمات خانگی لازم است.',403);
 const agent=await entity(id,'as_agent');if(agent.data.domain!=='home')fail('نماینده خدمات خانگی پیدا نشد.',404);return agent;
}
export type ServicePaymentFilters={q?:string;status?:string;from?:string;to?:string;min?:string;max?:string;account?:string};
export async function readServicePayments(u:Session,id:string,page=1,input:ServicePaymentFilters={}){
 const filters={q:latinDigits(input.q||'').trim(),status:input.status||'all',from:input.from?sday(input.from):'',to:input.to?sday(input.to):'',min:input.min?money(latinDigits(input.min)):'',max:input.max?money(latinDigits(input.max)):'',account:input.account||''};
 if(filters.q.length>300||filters.account.length>300||!['all','waiting','review','cleared','rejected','reversed'].includes(filters.status)||filters.from&&filters.to&&filters.from>filters.to||filters.min&&filters.max&&BigInt(filters.min)>BigInt(filters.max))fail('فیلترهای جست‌وجو معتبر نیست.');
 if(!Number.isSafeInteger(page)||page<1)fail('صفحه معتبر نیست.');
 if(isUnassignedServiceProfile(u)&&id===u.permissions.serviceAgentId)return {unassignedProfile:true,agentId:id,agentName:'',canSubmit:false,canReview:false,today:dayAt(),page:1,pages:1,total:0,filters,receivingAccounts:[],payments:[]};
 const agent=await servicePaymentAgent(u,id),db=storage(),all=await bankEntities(),periods=coveredBankPeriods(all),today=dayAt(),size=10;
 const where=["p.type='sales_payment'","json_extract(p.data,'$.serviceDomain')='home'","json_extract(p.data,'$.agentId')=?"],args:any[]=[id];
 if(filters.q){const term='%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%';where.push("(p.id LIKE ? ESCAPE '\\' OR json_extract(p.data,'$.reference') LIKE ? ESCAPE '\\')");args.push(term,term)}
 for(const [key,op,value] of [['day','>=',filters.from],['day','<=',filters.to],['amount','>=',filters.min],['amount','<=',filters.max],['receivingAccountId','=',filters.account]])if(value){where.push(key==='amount'?`CAST(json_extract(p.data,'$.amount') AS INTEGER) ${op} CAST(? AS INTEGER)`:`json_extract(p.data,'$.${key}') ${op} ?`);args.push(value)}
 if(['waiting','review'].includes(filters.status)){
  // Reuse bank evidence already required by this read. Lists/counts remain SQL-filtered and paginated.
  const candidates=new Map<string,number>();for(const row of all)if(row.type==='sales_bank_row'&&row.data.status==='pending'&&row.data.direction==='in'){const match=bankMatch(row,all);if(match.status==='ready'&&match.paymentId&&match.agentId===id)candidates.set(match.paymentId,(candidates.get(match.paymentId)||0)+1)}
  const ready=[...candidates].filter(([,count])=>count===1).map(([paymentId])=>paymentId),ranges=[...periods].flatMap(([account,ranges])=>ranges.map(range=>({account,...range})));
  const due="((coalesce(json_extract(p.data,'$.receivingAccountId'),'')='' OR (json_extract(p.data,'$.day')<=? AND EXISTS(SELECT 1 FROM json_each(?) c WHERE json_extract(c.value,'$.account')=json_extract(p.data,'$.receivingAccountId') AND json_extract(c.value,'$.from')<=json_extract(p.data,'$.day') AND json_extract(c.value,'$.to')>=json_extract(p.data,'$.day')))) AND p.id NOT IN (SELECT value FROM json_each(?)))";
  where.push("json_extract(p.data,'$.state')='pending'",filters.status==='review'?due:`NOT ${due}`);args.push(addDay(today,-2),JSON.stringify(ranges),JSON.stringify(ready));
 }else if(filters.status!=='all'){where.push("json_extract(p.data,'$.state')=?");args.push(filters.status)}
 const clause=where.join(' AND '),count:any=await db.prepare('SELECT COUNT(*) n FROM flow_entities p WHERE '+clause).bind(...args).first(),pages=Math.max(1,Math.ceil(count.n/size)),current=Math.min(page,pages);
 const rows=(await db.prepare('SELECT p.* FROM flow_entities p WHERE '+clause+' ORDER BY p.created DESC,p.id LIMIT ? OFFSET ?').bind(...args,size,(current-1)*size).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 return {agentId:id,agentName:agent.data.name,canSubmit:!!u.permissions.serviceAgentId||u.isAdmin,canReview:!!servicePaymentFinance(u),today,page:current,pages,total:count.n,filters,receivingAccounts:all.filter(a=>isApprovedReceivingAccount(a)&&agent.data.receivingAccountIds?.includes(a.id)).map(a=>({id:a.id,title:a.data.title,number:a.data.number||'',iban:a.data.iban||''})),payments:rows.map(p=>({...p,reviewDue:p.data.state==='pending'&&bankPaymentReviewDue(p,periods,today)&&!readyBankRowForPayment(p,all)}))};
}
export async function applyServicePayment(u:Session,b:any){
 const db=storage(),today=dayAt(),now=new Date().toISOString();if(!b||b.confirmed!==true||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id))fail('شناسه و تأیید معتبر لازم است.');
 if(!['submit','reject','delete'].includes(b.mode))fail('مرحله پرداخت معتبر نیست.');const agentId=u.permissions.serviceAgentId||sreq(b.agentId);if(u.permissions.serviceAgentId&&b.agentId&&b.agentId!==agentId)fail('نماینده قابل تغییر نیست.',403);const agent=await servicePaymentAgent(u,agentId);
 if(['submit','delete'].includes(b.mode)&&!u.permissions.serviceAgentId&&!u.isAdmin)fail('اعلام واریزی با خود نماینده است.',403);if(b.mode==='reject'&&!servicePaymentFinance(u))fail('بررسی با حسابدار مالی است.',403);
 const signature='sha256:'+await sha256(new TextEncoder().encode(JSON.stringify(b))),previous:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();if(previous){if(previous.actor!==u.userId||previous.payload!==signature)fail('شناسه برای عملیات دیگری مصرف شده است.',409);return {saved:true,repeated:true,id:b.paymentId||b.id};}
 const checks=await salesLock(db,b.id),all=await bankEntities(),writes=new Map<string,any>();
 const old=b.paymentId?all.find(p=>p.id===b.paymentId&&p.type==='sales_payment'&&p.data.serviceDomain==='home'&&p.data.agentId===agentId):null;
 if(b.paymentId&&!old)fail('اعلام واریزی پیدا نشد.',404);if(old&&old.revision!==b.revision)fail('اعلام واریزی تغییر کرده است.',409);
 const put=(id:string,type:string,data:any,prior?:any)=>{const first=writes.has(id)?writes.get(id).old:prior||null;writes.set(id,{id,type,data,old:first});const i=all.findIndex(r=>r.id===id),value={id,type,data,revision:first?first.revision+1:1,created:first?.created||now};if(i<0)all.push(value);else all[i]=value;return value;};
 let target=old?.id||b.id;
 if(b.mode==='delete'){
  if(!old||old.data.state!=='rejected'||old.data.bankRowId||old.data.financialEvents?.length||all.some(p=>p.type==='sales_bank_row'&&p.data.paymentId===old.id))fail('فقط واریزی ردشده بدون اثر مالی قابل حذف است.',409);
  const ledger:any=await db.prepare('SELECT COUNT(*) n FROM service_ledger WHERE source_id=?').bind(old.id).first();if(ledger.n)fail('واریزی دارای سابقه مالی قابل حذف نیست.',409);
  checks.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND json_extract(data,'$.state')='rejected') AND NOT EXISTS(SELECT 1 FROM service_ledger WHERE source_id=?) AND NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='sales_bank_row' AND json_extract(data,'$.paymentId')=?) THEN guard ELSE 0 END WHERE id=?").bind(old.id,old.revision,old.id,old.id,b.id));
 }else if(b.mode==='reject'){
  if(!old||old.data.state!=='pending'||!bankPaymentReviewDue(old,coveredBankPeriods(all),today)||readyBankRowForPayment(old,all))fail('فقط واریزی نامنطبقِ رسیده به مرحله بررسی قابل رد است.',409);
  put(old.id,'sales_payment',{...old.data,state:'rejected',reviewNotes:sreq(b.notes,4000),reviewedBy:u.userId,reviewedAt:now},old);
 }else{
  if(!agent.data.active)fail('نمایندگی غیرفعال است.',403);if(old&&!['pending','rejected'].includes(old.data.state))fail('واریزی تأییدشده قابل ویرایش نیست.',409);
  const amount=money(b.amount,true),day=sday(b.day),reference=sreq(b.reference,300),receivingAccountId=sreq(b.receivingAccountId),account=all.find(a=>a.id===receivingAccountId&&isApprovedReceivingAccount(a));if(day>today)fail('تاریخ واریز در آینده نیست.');if(!bankCode(reference))fail('کد رهگیری لازم است.');
  if(!account||!agent.data.receivingAccountIds?.includes(account.id))fail('حساب مقصد مصوبِ همین نماینده را انتخاب کنید.',403);
  if(all.some(p=>p.type==='sales_payment'&&p.id!==old?.id&&p.data.receivingAccountId===account.id&&bankCode(p.data.reference||'')===bankCode(reference)))fail('این کد رهگیری در حساب مقصد قبلاً ثبت شده است.',409);
  let fileId='';if(b.fileId){const f=await entity(sreq(b.fileId),'sales_file');if(f.data.serviceDomain!=='home'||f.data.agentId!==agentId)fail('رسید متعلق به این نماینده نیست.',403);fileId=f.id;}
  const data={serviceDomain:'home',serviceAgentId:agentId,agentId,method:'bank',state:'pending',amount,day,reference,receivingAccountId,fileId,bank:account.data.title,submittedBy:u.userId,submittedAt:now,notes:typeof b.notes==='string'?b.notes.slice(0,4000):'',previousVersions:old?[...(old.data.previousVersions||[]),{...old.data,previousVersions:undefined,revision:old.revision}]:[]};
  put(target,'sales_payment',data,old);checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(agent.id,agent.revision,account.id,account.revision,b.id));
  const ready=readyBankRowForPayment(all.find(p=>p.id===target),all);if(ready)recordSalesBankMatch({row:ready.row,match:{...ready.match,agentId},all,put,actorId:u.userId,operationId:b.id,now,today});
 }
 const statements:D1PreparedStatement[]=[];if(b.mode==='delete')statements.push(db.prepare('DELETE FROM flow_entities WHERE id=? AND revision=?').bind(old.id,old.revision));
 for(const w of writes.values()){if(w.old){checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(w.id,w.old.revision,b.id));statements.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(w.data),now,w.id,w.old.revision));}else statements.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(w.id,w.type,JSON.stringify(w.data),now,now));}
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'service_bank_payment',?,?,?,1)").bind(b.id,signature,u.userId,now),...checks,...statements,...serviceBankLedgerStatements([...writes.values()],u.userId,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'service_bank_payment',JSON.stringify({mode:b.mode,signature,agentId,...(b.mode==='delete'?{deletedRecord:old}:{})}),now)]);
 return {saved:true,deleted:b.mode==='delete',id:target,state:all.find(p=>p.id===target)?.data.state};
}
