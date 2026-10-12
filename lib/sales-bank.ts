import {storedAccessPermissions} from './permissions';
import type {Session} from './permissions';
import {storage} from './storage';
import {trainingContext} from './training-context';
import {firmwareBucket} from './firmware-storage';
import {sha256} from './firmware';
import {salesRows,salesLock,salesFail as fail,sreq,stxt,sday} from './sales';
import {salesRep,salesManager,salesFinance} from './sales-access';
import {financialWorkflowRole} from './financial-workflow-roles';
import {leadMembers,leadMemberGuard} from './sales-leads';
import {dayAt} from './duties';
import {allocationPlan} from './sales-network-contract';
import {salesBankModes,MAX_SALES_BANK_BYTES,bankCode,normalizeBankRows,bankRowIdentity,bankMatch} from './sales-bank-contract';
import {parseSalesBankRows} from './sales-bank-import';

export async function salesBankRoles(actor:Session){
 if(trainingContext.getStore())fail('تطبیق بانکی فقط در اطلاعات شرکت اجرا می‌شود.',403);
 const members=await leadMembers();let u=actor;
 if(!u.isAdmin){const m=members.find(m=>m.status==='active'&&(m.subject===u.userId||'local:'+m.id===u.userId));if(!m)fail('دسترسی فعال لازم است.',403);u={...u,permissions:storedAccessPermissions(m.permissions)};}
 if(salesRep(u)||u.permissions.serviceAgentId||u.permissions.hospitalCenterId)fail('دسترسی مالی داخلی شرکت لازم است.',403);
 const manage=salesManager(u)||salesFinance(u),bank=u.isAdmin||salesFinance(u)||financialWorkflowRole(u.permissions,'',[],'treasury');
 if(!manage&&!bank)fail('مجوز اتصال پوز یا تطبیق بانکی ندارید.',403);
 return {u,members,manage,bank};
}
async function bankEntities(){return [...await salesRows(),...(await storage().prepare("SELECT * FROM flow_entities WHERE type='treasury_account' ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}))];}
const accountPublic=(a:any,bank:boolean)=>({id:a.id,revision:a.revision,data:{title:a.data.title,...(bank?{number:a.data.number}:{}),currency:a.data.currency,kind:a.data.kind,state:a.data.state}});
const approvedAccount=(a:any)=>a.type==='treasury_account'&&a.data.state==='active'&&a.data.kind==='bank'&&a.data.currency==='IRR';
const minimalAgent=(a:any)=>({id:a.id,data:{name:a.data.name,active:a.data.active,kind:a.data.kind||'representative'}});
const statementPublic=(s:any)=>{const {objectKey,...data}=s.data;return {...s,data};};
export async function readSalesBank(actor:Session){
 const roles=await salesBankRoles(actor),all=await bankEntities();
 return {today:dayAt(),roles:{manage:roles.manage,bank:roles.bank},agents:all.filter(a=>a.type==='sales_agent'&&a.data.kind!=='referrer').map(minimalAgent),accounts:all.filter(approvedAccount).map(a=>accountPublic(a,roles.bank)),terminals:all.filter(r=>r.type==='sales_bank_terminal'),...(roles.bank?{statements:all.filter(r=>r.type==='sales_bank_statement').map(statementPublic),rows:all.filter(r=>r.type==='sales_bank_row').map(r=>({...r,assessment:bankMatch(r,all)})),payments:all.filter(r=>r.type==='sales_payment'&&r.data.method==='bank'&&r.data.state==='pending').map(r=>({id:r.id,revision:r.revision,data:{agentId:r.data.agentId,day:r.data.day,amount:r.data.amount,reference:r.data.reference,receivingAccountId:r.data.receivingAccountId||'',state:r.data.state}}))}: {})};
}
function originalBytes(b:any){
 const filename=sreq(b.filename,180);if(!/\.xlsx$/i.test(filename)||/[\x00-\x1f\x7f/\\]/.test(filename))fail('فایل اصلی اکسل با پسوند XLSX انتخاب کنید.');
 if(typeof b.contentBase64!=='string'||!b.contentBase64.length||b.contentBase64.length>Math.ceil(MAX_SALES_BANK_BYTES/3)*4||! /^[A-Za-z0-9+/]*={0,2}$/.test(b.contentBase64))fail('فایل اصلی اکسل باید غیرخالی و حداکثر ۱۰ مگابایت باشد.');
 let binary:string;try{binary=atob(b.contentBase64);}catch{return fail('فایل اکسل قابل خواندن نیست.');}
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(!bytes.length||bytes.length>MAX_SALES_BANK_BYTES||bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)fail('فایل اصلی XLSX معتبر لازم است.');
 return {filename,bytes};
}
export async function applySalesBank(actor:Session,b:any){
 const roles=await salesBankRoles(actor),{u,members}=roles,db=storage(),now=new Date().toISOString(),today=dayAt();
 if(!b||b.confirmed!==true||!salesBankModes.includes(b.mode)||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id))fail('تأیید و شناسه معتبر عملیات لازم است.');
 if(b.mode==='terminal'?!roles.manage:!roles.bank)fail('مجوز این مرحله را ندارید.',403);
 const signature='sha256:'+await sha256(new TextEncoder().encode(JSON.stringify(b))),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه قبلاً برای عملیات دیگری استفاده شده است.',409);const remaining=['import','reconcile'].includes(b.mode)?await bankEntities():[];return {saved:true,id:b.terminalId||b.rowId||b.id,repeated:true,...(['import','reconcile'].includes(b.mode)?{reconciled:0,matched:0,pendingReady:remaining.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&bankMatch(r,remaining).status==='ready').length}: {})};}
 const checks=await salesLock(db,b.id),all=await bankEntities(),writes=new Map<string,{id:string;type:string;data:any;old:any}>();checks.push(leadMemberGuard(db,b.id,members));
 const guard=(query:string,...values:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+query+' THEN guard ELSE 0 END WHERE id=?').bind(...values,b.id));
 const put=(id:string,type:string,data:any,old?:any)=>{
  const previous=writes.get(id),base=previous?previous.old:old||null;
  const next={...data,history:[...(data.history||old?.data.history||[]),{actor:u.userId,name:u.name,mode:b.mode,at:now}]};
  if(next.history.length>500)fail('سقف سابقه این پرونده پر شده است.');writes.set(id,{id,type,data:next,old:base});
  const index=all.findIndex(r=>r.id===id),r={id,type,data:next,revision:base?base.revision+1:1,created:base?.created||now,updated:now};if(index<0)all.push(r);else all[index]=r;return r;
 };
 const account=(id:string)=>{const a=all.find(r=>r.id===id&&approvedAccount(r));if(!a)fail('حساب بانکی ریالی تأییدشده لازم است.');guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',a.id,a.revision);return a;};
 let target=b.id,objectKey='',imported=0,skipped=0,matched=0,ignored=0,unresolved=0;const importedIds:string[]=[];
 if(b.mode==='terminal'){
  const old=b.terminalId?all.find(r=>r.id===b.terminalId&&r.type==='sales_bank_terminal'):null;if(b.terminalId&&!old)fail('اتصال ترمینال پیدا نشد.',404);
  if(b.revision!==(old?.revision||0))fail('نسخه اتصال پوز تغییر کرده؛ تازه‌سازی کنید.',409);
  const terminalCode=sreq(b.terminalCode,200),provider=sreq(b.provider,200),a=account(sreq(b.accountId)),agentId=sreq(b.agentId),agent=all.find(r=>r.id===agentId&&r.type==='sales_agent'&&r.data.kind!=='referrer');if(!agent)fail('خریدار معتبر لازم است.');
  const validFrom=sday(b.validFrom),validTo=b.validTo?sday(b.validTo):'';if(validTo&&validTo<validFrom||typeof b.active!=='boolean')fail('بازه و وضعیت اتصال پوز معتبر نیست.');
  const sameIdentity=old&&old.data.terminalCode===terminalCode&&old.data.provider===provider&&old.data.accountId===a.id&&old.data.agentId===agentId&&old.data.validFrom===validFrom;
  const closing=sameIdentity&&(!b.active||old.data.active&&validTo&&(!old.data.validTo||validTo<=old.data.validTo));
  if(!agent.data.active&&!closing)fail('اتصال جدید یا تغییر مالک به خریدار فعال نیاز دارد؛ اتصال قبلی خریدار غیرفعال فقط قابل پایان دادن است.');
  if(old&&all.some(r=>r.type==='sales_bank_row'&&r.data.terminalId===old.id)&&[old.data.terminalCode!==terminalCode,old.data.provider!==provider,old.data.accountId!==a.id,old.data.agentId!==agentId,old.data.validFrom!==validFrom].some(Boolean))fail('مالک و شناسه اتصال دارای وصول قابل بازنویسی نیست؛ بازه قبلی را پایان دهید و اتصال جدید بسازید.');
  if(validTo&&old&&all.some(r=>r.type==='sales_bank_row'&&r.data.terminalId===old.id&&r.data.day>validTo))fail('پایان بازه قبل از وصول ثبت‌شده نباشد.');
  if(b.active&&all.some(r=>r.type==='sales_bank_terminal'&&r.id!==old?.id&&r.data.active&&r.data.accountId===a.id&&bankCode(r.data.terminalCode)===bankCode(terminalCode)&&bankCode(r.data.provider)===bankCode(provider)&&r.data.validFrom<=(validTo||'9999-12-31')&&(!r.data.validTo||r.data.validTo>=validFrom)))fail('این ترمینال در بازه انتخاب‌شده اتصال فعال دیگری دارد.',409);
  target=old?.id||b.id;put(target,'sales_bank_terminal',{terminalCode,provider,accountId:a.id,agentId,validFrom,validTo,active:b.active,notes:stxt(b.notes??'',2000)},old);
 }else if(b.mode==='import'){
  const a=account(sreq(b.accountId)),file=originalBytes(b);let parsed:any[];
  try{const {readSheet}=await import('read-excel-file/universal');const grid=await readSheet(file.bytes.buffer,b.sheet||1,{parseNumber:value=>({excelNumber:value})});parsed=parseSalesBankRows(grid,b.mapping).rows;}catch(e){fail('خواندن ردیف‌های فایل اصلی اکسل انجام نشد: '+stxt(e instanceof Error?e.message:'قالب فایل معتبر نیست.',500));}
  const entries=normalizeBankRows(parsed!),preview=normalizeBankRows(b.rows);
  if(JSON.stringify(entries)!==JSON.stringify(preview))fail('پیش‌نمایش با ردیف‌های فایل اصلی یکسان نیست؛ فایل را دوباره بخوانید و تأیید کنید.',409);
  const hash=await sha256(file.bytes),ids=new Set(all.filter(r=>r.type==='sales_bank_row'&&r.data.accountId===a.id).map(r=>r.data.bankId));
  for(const [i,d] of entries.entries()){
   if(ids.has(d.bankId)){const existing=all.find(r=>r.type==='sales_bank_row'&&r.data.accountId===a.id&&r.data.bankId===d.bankId)!;if(bankRowIdentity(existing.data)!==bankRowIdentity(d))fail('ردیف بانک با همین شناسه قبلاً با اطلاعات متفاوت وارد شده است: '+d.bankId,409);skipped++;continue;}
   const row=put(b.id+':row:'+i,'sales_bank_row',{...d,accountId:a.id,statementId:b.id,status:d.direction==='in'?'pending':'ignored'});importedIds.push(row.id);imported++;
  }
  objectKey='private/sales-bank/'+b.id+'/'+crypto.randomUUID()+'/'+hash+'.xlsx';
  put(b.id,'sales_bank_statement',{accountId:a.id,currency:'IRR',filename:file.filename,sha256:hash,byteSize:file.bytes.byteLength,objectKey,rowCount:entries.length,imported,skipped,from:entries.map(r=>r.day).sort()[0],to:entries.map(r=>r.day).sort().at(-1),actor:u.userId,mapping:b.mapping});
  await firmwareBucket().put(objectKey,file.bytes.buffer,{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},customMetadata:{sha256:hash,filename:file.filename}});
 }else if(b.mode==='reverse'){
  const row=all.find(r=>r.type==='sales_bank_row'&&r.id===b.rowId);if(!row)fail('ردیف بانک پیدا نشد.',404);if(row.revision!==b.revision)fail('نسخه ردیف تغییر کرده؛ تازه‌سازی کنید.',409);
  if(row.data.status!=='matched')fail('فقط ردیف تطبیق‌شده قابل برگشت است.');
  const payment=all.find(r=>r.type==='sales_payment'&&r.id===row.data.paymentId&&r.data.bankRowId===row.id);if(!payment||payment.data.state!=='cleared')fail('وصول متصل قبلاً تغییر کرده؛ سابقه مالی را بررسی کنید.',409);
  const reason=sreq(b.reason,4000);put(payment.id,payment.type,{...payment.data,state:'reversed',reviewedBy:u.userId,reviewedAt:now,reviewNotes:reason,financialEvents:[...(payment.data.financialEvents||[]),{id:b.id,day:today,at:now,delta:String(-BigInt(payment.data.amount)),state:'reversed',bankRowId:row.id}]},payment);
  // Allocation history stays intact; salesAccounts automatically excludes all credits whose payment is reversed.
  put(row.id,row.type,{...row.data,status:'reversed',reversedBy:u.userId,reversedAt:now,reverseReason:reason},row);target=row.id;
 }
 let pendingReady=0;
 if(b.mode==='reconcile'){
  let selected:any[]=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending');
  if(b.mode==='reconcile'&&b.rowIds!=null){if(!Array.isArray(b.rowIds)||!b.rowIds.length||b.rowIds.length>500||new Set(b.rowIds).size!==b.rowIds.length)fail('فهرست معتبر تا ۵۰۰ ردیف انتخاب کنید.');for(const id of b.rowIds)if(!all.some(r=>r.type==='sales_bank_row'&&r.id===id))fail('ردیف انتخاب‌شده پیدا نشد.',404);selected=selected.filter(r=>b.rowIds.includes(r.id));}
  for(const row of selected){
   const match=bankMatch(row,all);
   if(match.status==='ignored'){ignored++;continue;}if(match.status!=='ready'){unresolved++;continue;}if(matched>=25)continue;account(row.data.accountId);
   const d=row.data,existing=match.paymentId?all.find(r=>r.id===match.paymentId&&r.type==='sales_payment'):null,paymentId=existing?.id||row.id+':payment';
   if(existing&&existing.data.state!=='pending')fail('اعلام پرداخت هم‌زمان تغییر کرد؛ دوباره تطبیق کنید.',409);
   const data={...(existing?.data||{}),agentId:match.agentId,method:'bank',amount:d.amount,day:existing?.data.day||d.day,bank:existing?.data.bank||all.find(r=>r.id===d.accountId)!.data.title,normalizedBank:bankCode(existing?.data.bank||all.find(r=>r.id===d.accountId)!.data.title),reference:existing?.data.reference||d.reference||'BANK:'+d.bankId,normalizedReference:bankCode(existing?.data.reference||d.reference||'BANK:'+d.bankId),receivingAccountId:d.accountId,fileId:existing?.data.fileId||'',checkDue:'',state:'cleared',bankRowId:row.id,bankStatementId:d.statementId,bankSettlementDay:d.day,bankEvidence:{bankId:d.bankId,accountId:d.accountId,statementId:d.statementId,terminalCode:d.terminalCode,provider:d.provider,day:d.day},automaticBank:true,reviewedBy:u.userId,reviewedAt:now,reviewNotes:match.reason,submittedBy:existing?.data.submittedBy||u.userId,financialEvents:[...(existing?.data.financialEvents||[]),{id:b.id+':'+row.id,day:d.day,at:now,delta:d.amount,state:'cleared',bankRowId:row.id}]};
   put(paymentId,'sales_payment',data,existing);put(row.id,row.type,{...d,status:'matched',agentId:match.agentId,paymentId,terminalId:match.terminalId||'',matchedAt:now,matchedBy:u.userId},row);matched++;
   const plan=allocationPlan(all,match.agentId,paymentId,today);
   plan.allocations.forEach((l,i)=>put(b.id+':allocation:'+row.id+':'+i,'sales_allocation',{agentId:match.agentId,creditId:paymentId,...l,policy:plan.policy,by:u.userId,bankRowId:row.id}));
   plan.recoveries.forEach((r,i)=>put(b.id+':recovery:'+row.id+':'+i,'sales_check_recovery',{agentId:match.agentId,creditId:paymentId,...r,by:u.userId,bankRowId:row.id}));
  }
  const selectedIds=new Set(selected.map(r=>r.id));pendingReady=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&selectedIds.has(r.id)&&bankMatch(r,all).status==='ready').length;
 }
 const updates=[...writes.values()].filter(w=>w.old).map(w=>({id:w.id,revision:w.old.revision,data:JSON.stringify(w.data)})),inserts=[...writes.values()].filter(w=>!w.old).map(w=>({id:w.id,type:w.type,data:JSON.stringify(w.data)})),stmts:D1PreparedStatement[]=[];
 if(updates.length){const payload=JSON.stringify(updates);guard('NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE NOT EXISTS (SELECT 1 FROM flow_entities f WHERE f.id=json_extract(j.value,\'$.id\') AND f.revision=json_extract(j.value,\'$.revision\')))',payload);stmts.push(db.prepare("UPDATE flow_entities SET data=(SELECT json_extract(j.value,'$.data') FROM json_each(?) j WHERE json_extract(j.value,'$.id')=flow_entities.id),revision=revision+1,updated=? WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(payload,now,payload));}
 if(inserts.length)stmts.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.data'),1,?,? FROM json_each(?)").bind(now,now,JSON.stringify(inserts)));
 try{await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'sales_bank_'+b.mode,signature,u.userId,now),...checks,...stmts,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'sales_bank_'+b.mode,JSON.stringify({mode:b.mode,signature,imported,skipped,matched,unresolved,ignored,reason:b.mode==='reverse'?b.reason:undefined}),now)]);}catch(e){if(objectKey)try{await firmwareBucket().delete(objectKey);}catch{/* Original remains private if cleanup is unavailable. */}throw e;}
 if(b.mode==='import')pendingReady=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&bankMatch(r,all).status==='ready').length;
 return {saved:true,id:target,...(['import','reconcile'].includes(b.mode)?{imported,skipped,matched,reconciled:matched,pendingReady,unresolved,ignored}: {})};
}
