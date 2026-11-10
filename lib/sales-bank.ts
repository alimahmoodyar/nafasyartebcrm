import {storedAccessPermissions} from './permissions';
import type {Session} from './permissions';
import {storage} from './storage';
import {trainingContext} from './training-context';
import {firmwareBucket} from './firmware-storage';
import {sha256} from './firmware';
import {salesRows,salesLock,salesFail as fail,sreq,stxt,sday} from './sales';
import {usesAssignedSalesAccounts} from './sales-contract';
import {salesRep,salesManager,salesFinance} from './sales-access';
import {financialWorkflowRole} from './financial-workflow-roles';
import {leadMembers,leadMemberGuard} from './sales-leads';
import {addDay,dayAt} from './duties';
import {allocationPlan} from './sales-network-contract';
import {salesBankModes,MAX_SALES_BANK_BYTES,bankCode,normalizeBankRows,bankRowIdentity,bankMatch,transferPaymentFits,isApprovedReceivingAccount as approvedAccount} from './sales-bank-contract';
import {bankCellText,parseSalesBankRows} from './sales-bank-import';
import {bankWorkbookFormat,readBankWorkbook,detectBankReport,extractBankReport} from './sales-bank-workbook';
import {bankCoverage,coveredBankPeriods,uncoveredBankPeriods} from './sales-bank-coverage';

export async function salesBankRoles(actor:Session){
 const test=trainingContext.getStore();
 if(test){
  if(!test.salesBankTest||test.actor!==actor.userId||test.role!==actor.profileReview?.id||!['sales-finance','treasurer'].includes(test.role))fail('پروفایل تطبیق بانکی مجاز نیست.',403);
  return {u:actor,members:await leadMembers(),manage:test.role==='sales-finance',bank:true,salesFinance:test.role==='sales-finance',canImport:test.role==='treasurer'};
 }
 const members=await leadMembers();let u=actor;
 if(!u.isAdmin&&!u.profileReview){const m=members.find(m=>m.status==='active'&&(m.subject===u.userId||'local:'+m.id===u.userId));if(!m)fail('دسترسی فعال لازم است.',403);u={...u,permissions:storedAccessPermissions(m.permissions)};}
 if(salesRep(u)||u.permissions.serviceAgentId||u.permissions.hospitalCenterId)fail('دسترسی مالی داخلی شرکت لازم است.',403);
 const manage=salesFinance(u),canImport=u.isAdmin||financialWorkflowRole(u.permissions,'',[],'treasury'),bank=salesFinance(u)||canImport;
 if(!manage&&!bank&&!salesManager(u))fail('مجوز اتصال پوز یا تطبیق بانکی ندارید.',403);
 return {u,members,manage,bank,salesFinance:salesFinance(u),canImport};
}
export async function bankEntities(salesRowsSnapshot?:any[]){
 const sales=salesRowsSnapshot||await salesRows();
 if(trainingContext.getStore()?.salesBankTest)return sales;
 return [...sales,...(await storage().prepare("SELECT * FROM flow_entities WHERE type='treasury_account' ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}))];
}
const accountPublic=(a:any,bank:boolean)=>({id:a.id,revision:a.revision,data:{title:a.data.title,...(bank?{number:a.data.number,iban:a.data.iban,cardNumber:a.data.cardNumber}:{}),currency:a.data.currency,kind:a.data.kind,state:a.data.state}});
const minimalAgent=(a:any)=>({id:a.id,revision:a.revision,data:{name:a.data.name,active:a.data.active,kind:a.data.kind||'representative',receivingAccountIds:a.data.receivingAccountIds||[]}});
const statementPublic=(s:any)=>{const {objectKey,...data}=s.data;return {...s,data};};
export async function readSalesBank(actor:Session){
 const roles=await salesBankRoles(actor),all=await bankEntities();
 const today=dayAt();
 return {today,roles:{manage:roles.manage,bank:roles.bank},canImport:roles.canImport,canAssign:roles.salesFinance,canResolve:roles.salesFinance,agents:all.filter(a=>a.type==='sales_agent'&&a.data.kind!=='referrer').map(minimalAgent),accounts:all.filter(approvedAccount).map(a=>accountPublic(a,roles.bank)),terminals:all.filter(r=>r.type==='sales_bank_terminal'),...(roles.bank?{coverage:bankCoverage(all,today),statements:all.filter(r=>r.type==='sales_bank_statement').map(statementPublic),rows:all.filter(r=>r.type==='sales_bank_row').map(r=>({...r,assessment:bankMatch(r,all)})),payments:all.filter(r=>r.type==='sales_payment'&&r.data.method==='bank'&&r.data.state==='pending').map(r=>({id:r.id,revision:r.revision,data:{agentId:r.data.agentId,day:r.data.day,amount:r.data.amount,reference:r.data.reference,receivingAccountId:r.data.receivingAccountId||'',state:r.data.state}}))}: {})};
}
export async function downloadSalesBankStatement(actor:Session,id:string){
 if(!(await salesBankRoles(actor)).bank)fail('دسترسی به بایگانی بانک لازم است.',403);
 const statement=(await bankEntities()).find(row=>row.id===id&&row.type==='sales_bank_statement');
 if(!statement?.data.objectKey)fail('اصل صورتحساب پیدا نشد.',404);
 const object=await firmwareBucket().get(statement.data.objectKey);
 if(!object)fail('فایل بایگانی‌شده پیدا نشد.',404);
 const filename=statement.data.filename;
 return new Response(object!.body??await object!.arrayBuffer(),{headers:{'Content-Type':/\.xls$/i.test(filename)?'application/vnd.ms-excel':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
function declaredCoverage(b:any,today=dayAt()){
 if(b.coverageFrom==null&&b.coverageTo==null&&b.emptyStatement!==true)return null;
 const from=sday(b.coverageFrom),to=sday(b.coverageTo);
 if(from>to||to>today||to>addDay(from,365))fail('بازهٔ صورتحساب باید معتبر، حداکثر ۳۶۶ روز و تا امروز باشد.');
 return {from,to};
}
function checkCoveredRows(b:any,rows:any[]){
 const coverage=declaredCoverage(b);
 if(coverage&&rows.some(row=>row.day<coverage.from||row.day>coverage.to))fail('تاریخ ردیف‌های فایل باید داخل بازهٔ اعلام‌شدهٔ صورتحساب باشد.');
 return coverage;
}
function originalBytes(b:any){
 const filename=sreq(b.filename,180);
 if(typeof b.contentBase64!=='string'||!b.contentBase64.length||b.contentBase64.length>Math.ceil(MAX_SALES_BANK_BYTES/3)*4||! /^[A-Za-z0-9+/]*={0,2}$/.test(b.contentBase64))fail('فایل اصلی اکسل باید غیرخالی و حداکثر ۱۰ مگابایت باشد.');
 let binary:string;try{binary=atob(b.contentBase64);}catch{return fail('فایل اکسل قابل خواندن نیست.');}
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));let format:'xls'|'xlsx';try{format=bankWorkbookFormat(filename,bytes);}catch(e){return fail((e as Error).message);}
 return {filename,bytes,format};
}
async function parseOriginal(b:any){
 const file=originalBytes(b);
 try{
  const sheets=await readBankWorkbook(file.filename,file.bytes),sheet=b.sheet==null?sheets[0]:typeof b.sheet==='number'?sheets[b.sheet-1]:sheets.find(s=>s.sheet===b.sheet);
  if(!sheet)throw Error('برگه انتخاب‌شده در فایل وجود ندارد.');
  const detection=detectBankReport(sheet.data);
  if(b.profile!=null&&!['auto','manual'].includes(b.profile))throw Error('روش خواندن فایل معتبر نیست.');
  if(b.emptyStatement===true){
   const header=detection.headerRow||1;
   if(!sheet.data[header-1]?.some(cell=>bankCellText(cell))||sheet.data.slice(header).some(row=>row.some(cell=>bankCellText(cell))))throw Error('ثبت بدون تراکنش به فایل دارای عنوان و بدون ردیف تراکنش نیاز دارد.');
   if(detection.kind==='pos')return {file,sheet:sheet.sheet,report:{kind:'pos' as const,headerRow:header,rows:[],excluded:[],warnings:[],summary:{total:0,eligible:0,excluded:0,accounts:[],groups:[],terminals:[],paid:'0',fee:'0',net:'0'}}};
   return {file,sheet:sheet.sheet,report:{kind:'statement' as const,headerRow:header,rows:[],excluded:[],warnings:[],summary:{total:0,incoming:0,outgoing:0}}};
  }
  const report=detection.kind==='pos'||b.profile==='auto'?await extractBankReport(sheet.data,b.unit,detection,b.range):{kind:'statement' as const,...parseSalesBankRows(sheet.data,b.mapping),excluded:[],summary:null,headerRow:0};
  if(report.kind==='pos'&&report.rows.some(r=>r.day>dayAt()||r.financialDay>dayAt()))throw Error('تاریخ تراکنش یا تسویه پوز در آینده نباشد.');
  return {file,sheet:sheet.sheet,report};
 }catch(e){fail('خواندن ردیف‌های فایل اصلی اکسل انجام نشد: '+stxt(e instanceof Error?e.message:'قالب فایل معتبر نیست.',500));}
}
/** Preview never saves files, clears claims, allocates debt or changes permissions. */
export async function previewSalesBank(actor:Session,b:any){
 const roles=await salesBankRoles(actor);if(!roles.canImport)fail('خواندن اکسل گردش بانک با خزانه‌دار است.',403);
 const parsed=await parseOriginal(b);
 if(parsed!.report.kind==='statement')parsed!.report.rows=normalizeBankRows(parsed!.report.rows,b.emptyStatement===true);
 checkCoveredRows(b,parsed!.report.rows);
 return {...parsed!.report,filename:parsed!.file.filename,sheet:parsed!.sheet,sha256:await sha256(parsed!.file.bytes)};
}
export function recordSalesBankMatch({row,match,all,put,actorId,operationId,now,today,manual=false}:{
 row:any;match:{agentId:string;paymentId?:string;terminalId?:string;reason:string};all:any[];
 put:(id:string,type:string,data:any,old?:any)=>unknown;actorId:string;operationId:string;now:string;today:string;manual?:boolean;
}){
 const d=row.data,existing=match.paymentId?all.find(r=>r.id===match.paymentId&&r.type==='sales_payment'):null,paymentId=existing?.id||row.id+':payment';
 if(existing&&existing.data.state!=='pending')fail('اعلام پرداخت هم‌زمان تغییر کرد؛ دوباره تطبیق کنید.',409);
 const data={...(existing?.data||{}),agentId:match.agentId,method:'bank',amount:d.amount,day:existing?.data.day||d.day,bank:existing?.data.bank||all.find(r=>r.id===d.accountId)!.data.title,normalizedBank:bankCode(existing?.data.bank||all.find(r=>r.id===d.accountId)!.data.title),reference:existing?.data.reference||d.reference||'BANK:'+d.bankId,normalizedReference:bankCode(existing?.data.reference||d.reference||'BANK:'+d.bankId),receivingAccountId:d.accountId,fileId:existing?.data.fileId||'',checkDue:'',state:'cleared',bankRowId:row.id,bankStatementId:d.statementId,bankSettlementDay:d.day,bankEvidence:{bankId:d.bankId,accountId:d.accountId,statementId:d.statementId,terminalCode:d.terminalCode,provider:d.provider,day:d.day},automaticBank:!manual,reviewedBy:actorId,reviewedAt:now,reviewNotes:match.reason,submittedBy:existing?.data.submittedBy||actorId,financialEvents:[...(existing?.data.financialEvents||[]),{id:operationId+':'+row.id,day:d.day,at:now,delta:d.amount,state:'cleared',bankRowId:row.id}]};
 put(paymentId,'sales_payment',data,existing);put(row.id,row.type,{...d,status:'matched',agentId:match.agentId,paymentId,terminalId:match.terminalId||'',matchedAt:now,matchedBy:actorId,...(manual?{resolutionReason:match.reason}:{})},row);
 const payment=all.find(entry=>entry.id===paymentId);
 const allocationRows=payment?.data.state==='cleared'?all:[...all.filter(entry=>entry.id!==paymentId),{id:paymentId,type:'sales_payment',data,created:existing?.created||now}];
 const plan=allocationPlan(allocationRows,match.agentId,paymentId,today);
 plan.allocations.forEach((l,i)=>put(operationId+':allocation:'+row.id+':'+i,'sales_allocation',{agentId:match.agentId,creditId:paymentId,...l,policy:plan.policy,by:actorId,bankRowId:row.id}));
 plan.recoveries.forEach((r,i)=>put(operationId+':recovery:'+row.id+':'+i,'sales_check_recovery',{agentId:match.agentId,creditId:paymentId,...r,by:actorId,bankRowId:row.id}));
}

export async function applySalesBank(actor:Session,b:any){
 const roles=await salesBankRoles(actor),{u,members}=roles,db=storage(),now=new Date().toISOString(),today=dayAt();
 if(!b||b.confirmed!==true||!salesBankModes.includes(b.mode)||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id))fail('تأیید و شناسه معتبر عملیات لازم است.');
 if(trainingContext.getStore()?.salesBankTest&&!(actor.profileReview?.id==='sales-finance'?['receiving_accounts','resolve_transfer','terminal'].includes(b.mode):['import','archive_pos','reconcile'].includes(b.mode)))fail('این عملیات در نقش آزمایشی مجاز نیست.',403);
 if(b.mode==='terminal'?!roles.manage:['import','archive_pos'].includes(b.mode)?!roles.canImport:['receiving_accounts','resolve_transfer'].includes(b.mode)?!roles.salesFinance:!roles.bank)fail('مجوز این مرحله را ندارید.',403);
 const signature='sha256:'+await sha256(new TextEncoder().encode(JSON.stringify(b))),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه قبلاً برای عملیات دیگری استفاده شده است.',409);const remaining=['import','reconcile'].includes(b.mode)?await bankEntities():[];return {saved:true,id:b.mode==='receiving_accounts'?b.agentId:b.terminalId||b.rowId||b.id,repeated:true,...(['import','reconcile'].includes(b.mode)?{reconciled:0,matched:0,pendingReady:remaining.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&bankMatch(r,remaining).status==='ready').length}: {})};}
 const checks=await salesLock(db,b.id),all=await bankEntities(),writes=new Map<string,{id:string;type:string;data:any;old:any}>();checks.push(leadMemberGuard(db,b.id,members));
 const guard=(query:string,...values:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+query+' THEN guard ELSE 0 END WHERE id=?').bind(...values,b.id));
 const put=(id:string,type:string,data:any,old?:any)=>{
  const previous=writes.get(id),base=previous?previous.old:old||null;
  const next={...data,history:[...(data.history||old?.data.history||[]),{actor:u.userId,name:u.name,mode:b.mode,at:now}]};
  if(next.history.length>500)fail('سقف سابقه این پرونده پر شده است.');writes.set(id,{id,type,data:next,old:base});
  const index=all.findIndex(r=>r.id===id),r={id,type,data:next,revision:base?base.revision+1:1,created:base?.created||now,updated:now};if(index<0)all.push(r);else all[index]=r;return r;
 };
 const account=(id:string)=>{const a=all.find(r=>r.id===id&&approvedAccount(r));if(!a)fail('حساب بانکی ریالی تأییدشده لازم است.');guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',a.id,a.revision);return a;};
 let target=b.id,objectKey='',imported=0,skipped=0,matched=0,ignored=0,unresolved=0,archived=false;
 if(b.mode==='receiving_accounts'){
  const agent=all.find(r=>r.type==='sales_agent'&&r.id===b.agentId&&r.data.active&&usesAssignedSalesAccounts(r.data.kind));
  if(!agent)fail('نماینده یا عامل فروش فعال را انتخاب کنید.');
  if(agent.revision!==b.revision)fail('پرونده خریدار تغییر کرده است. فهرست را تازه کنید.',409);
  if(!Array.isArray(b.receivingAccountIds)||b.receivingAccountIds.length>2||new Set(b.receivingAccountIds).size!==b.receivingAccountIds.length)fail('حداکثر دو حساب متفاوت انتخاب کنید.');
  const receivingAccountIds=b.receivingAccountIds.map((id:unknown)=>account(sreq(id)).id);
  target=agent.id;
  put(target,'sales_agent',{...agent.data,receivingAccountIds},agent);
 }else if(b.mode==='terminal'){
  const old=b.terminalId?all.find(r=>r.id===b.terminalId&&r.type==='sales_bank_terminal'):null;if(b.terminalId&&!old)fail('اتصال ترمینال پیدا نشد.',404);
  if(b.revision!==(old?.revision||0))fail('نسخه اتصال پوز تغییر کرده؛ تازه‌سازی کنید.',409);
  const terminalCode=sreq(b.terminalCode,200),provider=sreq(b.provider,200),a=account(sreq(b.accountId)),agentId=sreq(b.agentId),agent=all.find(r=>r.id===agentId&&r.type==='sales_agent'&&r.data.kind!=='referrer');if(!agent)fail('خریدار معتبر لازم است.');
  const validFrom=sday(b.validFrom),validTo=b.validTo?sday(b.validTo):'';if(validTo&&validTo<validFrom||typeof b.active!=='boolean')fail('بازه و وضعیت اتصال پوز معتبر نیست.');
  const serial=b.serial==null?old?.data.serial||'':sreq(b.serial,200);
  if(!old&&!serial)fail('شماره سریال دستگاه پوز لازم است.');
  const handedDay=b.handedDay?sday(b.handedDay):old?.data.handedDay||(!old?today:'');
  if(handedDay&&(handedDay>today||old?.data.handedDay&&handedDay!==old.data.handedDay))fail('تاریخ واقعی تحویل نامعتبر است؛ تحویل ثبت‌شده قابل بازنویسی نیست.');
  if(old?.data.returnedDay)fail('این پوز برگشت خورده است. برای تحویل دوباره، اتصال جدید ثبت کنید.',409);
  if(!old&&agent.data.custodyRecall?.state==='open')fail('پرونده در حال جمع‌آوری امانت‌هاست.',409);
  if(serial&&all.some(r=>(r.type==='sales_custody_item'||r.type==='sales_bank_terminal'&&(r.data.active||r.data.handedDay))&&r.id!==old?.id&&!r.data.returnedDay&&bankCode(r.data.serial||'')===bankCode(serial)))fail('دستگاه با همین سریال هنوز در امانت است.',409);
  const sameIdentity=old&&old.data.terminalCode===terminalCode&&old.data.provider===provider&&old.data.accountId===a.id&&old.data.agentId===agentId&&old.data.validFrom===validFrom;
  const closing=sameIdentity&&(!b.active||old.data.active&&validTo&&(!old.data.validTo||validTo<=old.data.validTo));
  if(old?.data.handedDay&&!sameIdentity)fail('برای تغییر نماینده، حساب یا پایانه، اول امانت قبلی را برگشت بزنید و بعد ثبت تازه انجام دهید.',409);
  if(!agent.data.active&&!closing)fail('اتصال جدید یا تغییر مالک به خریدار فعال نیاز دارد؛ اتصال قبلی خریدار غیرفعال فقط قابل پایان دادن است.');
  if(old&&all.some(r=>r.type==='sales_bank_row'&&r.data.terminalId===old.id)&&[old.data.terminalCode!==terminalCode,old.data.provider!==provider,old.data.accountId!==a.id,old.data.agentId!==agentId,old.data.validFrom!==validFrom].some(Boolean))fail('مالک و شناسه اتصال دارای وصول قابل بازنویسی نیست؛ بازه قبلی را پایان دهید و اتصال جدید بسازید.');
  if(validTo&&old&&all.some(r=>r.type==='sales_bank_row'&&r.data.terminalId===old.id&&r.data.day>validTo))fail('پایان بازه قبل از وصول ثبت‌شده نباشد.');
  if(b.active&&all.some(r=>r.type==='sales_bank_terminal'&&r.id!==old?.id&&(r.data.active||r.data.validTo)&&r.data.accountId===a.id&&bankCode(r.data.terminalCode)===bankCode(terminalCode)&&bankCode(r.data.provider)===bankCode(provider)&&r.data.validFrom<=(validTo||'9999-12-31')&&(!r.data.validTo||r.data.validTo>=validFrom)))fail('این ترمینال در بازه انتخاب‌شده اتصال فعال دیگری دارد.',409);
  target=old?.id||b.id;put(target,'sales_bank_terminal',{...old?.data,terminalCode,serial,provider,bankName:a.data.title,accountId:a.id,agentId,handedDay,validFrom,validTo,active:b.active,notes:stxt(b.notes??'',2000)},old);
 }else if(b.mode==='import'||b.mode==='archive_pos'){
  const a=account(sreq(b.accountId)),parsed=await parseOriginal(b),file=parsed!.file;
  const source=b.mode==='archive_pos'?'pos':'bank',pos=source==='pos',report=parsed!.report;
  if(report.kind!==(pos?'pos':'statement'))fail('نوع فایل با گردش حساب بانک یا گزارش پوز انتخاب‌شده یکسان نیست.');
  const entries=pos?report.rows:normalizeBankRows(report.rows,b.emptyStatement===true),preview=pos?b.rows:normalizeBankRows(b.rows,b.emptyStatement===true);
  const coverage=checkCoveredRows(b,entries),covered=coveredBankPeriods(all,source).get(a.id)||[];
  if(JSON.stringify(entries)!==JSON.stringify(preview))fail('پیش‌نمایش با ردیف‌های فایل اصلی یکسان نیست؛ فایل را دوباره بخوانید و تأیید کنید.',409);
  if(pos){
   if(!coverage)fail('بازهٔ واقعی گزارش پوز لازم است.');
   const period=coverage!;
   const linked=all.filter(r=>r.type==='sales_bank_terminal'&&r.data.accountId===a.id&&(r.data.active||r.data.validTo)&&r.data.validFrom<=period.to&&(!r.data.validTo||r.data.validTo>=period.from));
   const iban=bankCode(a.data.iban||'');
   if(!linked.length)fail('برای حساب و بازهٔ انتخاب‌شده پایانهٔ پوز ثبت نشده است.');
   if(entries.some(row=>(iban&&iban!==bankCode(row.iban))||!linked.some(r=>bankCode(r.data.terminalCode)===bankCode(row.terminalCode)&&r.data.validFrom<=row.day&&(!r.data.validTo||r.data.validTo>=row.day))))fail('شبا یا پایانهٔ بعضی ردیف‌ها با حساب مقصد و تاریخ تراکنش منطبق نیست.');
  }
  const rowType=pos?'sales_bank_pos_row':'sales_bank_row';
  const identity=(d:any)=>pos?JSON.stringify([bankCode(d.providerCode),bankCode(d.terminalCode),bankCode(d.reference)]):d.bankId;
  const contents=(d:any)=>pos?JSON.stringify(['day','financialDay','iban','tracking','serial','time','gross','paid','fee','net','paymentId'].map(key=>d[key])):bankRowIdentity(d);
  const hash=await sha256(file.bytes),existingRows=new Map(all.filter(r=>r.type===rowType&&r.data.accountId===a.id).map(r=>[identity(r.data),r]));
  for(const [i,d] of entries.entries()){
   const key=identity(d),existing=existingRows.get(key);
   if(existing){if(contents(existing.data)!==contents(d))fail('این تراکنش قبلاً با اطلاعات متفاوت وارد شده است.',409);skipped++;continue;}
   existingRows.set(key,{data:d});
   put(b.id+':row:'+i,rowType,{...d,accountId:a.id,statementId:b.id,...(pos?{}:{status:d.direction==='in'?'pending':'ignored'})});imported++;
  }
  const newCoverage=coverage?uncoveredBankPeriods(coverage.from,coverage.to,covered):[];
  if(imported||newCoverage.length){
   archived=true;
   const previous=all.find(r=>r.type==='sales_bank_statement'&&r.data.accountId===a.id&&(r.data.source||'bank')===source&&r.data.sha256===hash&&r.data.objectKey);
   if(!previous)objectKey='private/sales-bank/'+b.id+'/'+crypto.randomUUID()+'/'+hash+'.'+file.format;
   const days=entries.map(r=>r.day).sort();
   put(b.id,'sales_bank_statement',{source,accountId:a.id,currency:'IRR',filename:file.filename,sha256:hash,byteSize:file.bytes.byteLength,objectKey:previous?.data.objectKey||objectKey,rowCount:entries.length,imported,skipped,from:coverage?.from||days[0],to:coverage?.to||days.at(-1),...(coverage?{coverageFrom:coverage.from,coverageTo:coverage.to,newCoverage}:{}),actor:u.userId,mapping:b.mapping,profile:b.profile||'manual',unit:b.unit||b.mapping?.unit,range:b.range});
   if(objectKey)await firmwareBucket().put(objectKey,file.bytes.buffer,{httpMetadata:{contentType:file.format==='xls'?'application/vnd.ms-excel':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},customMetadata:{sha256:hash,filename:file.filename}});
  }
 }else if(b.mode==='reverse'){
  const row=all.find(r=>r.type==='sales_bank_row'&&r.id===b.rowId);if(!row)fail('ردیف بانک پیدا نشد.',404);if(row.revision!==b.revision)fail('نسخه ردیف تغییر کرده؛ تازه‌سازی کنید.',409);
  if(row.data.status!=='matched')fail('فقط ردیف تطبیق‌شده قابل برگشت است.');
  const payment=all.find(r=>r.type==='sales_payment'&&r.id===row.data.paymentId&&r.data.bankRowId===row.id);if(!payment||payment.data.state!=='cleared')fail('وصول متصل قبلاً تغییر کرده؛ سابقه مالی را بررسی کنید.',409);
  const reason=sreq(b.reason,4000);put(payment.id,payment.type,{...payment.data,state:'reversed',reviewedBy:u.userId,reviewedAt:now,reviewNotes:reason,financialEvents:[...(payment.data.financialEvents||[]),{id:b.id,day:today,at:now,delta:String(-BigInt(payment.data.amount)),state:'reversed',bankRowId:row.id}]},payment);
  // Allocation history stays intact; salesAccounts automatically excludes all credits whose payment is reversed.
  put(row.id,row.type,{...row.data,status:'reversed',reversedBy:u.userId,reversedAt:now,reverseReason:reason},row);target=row.id;
 }
 let pendingReady=0;
 if(b.mode==='reconcile'||b.mode==='resolve_transfer'){
  let selected:any[]=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending');
  let resolution:{rowId:string;agentId:string;paymentId:string;reason:string}|undefined;
  if(b.mode==='resolve_transfer'){
   const row=selected.find(r=>r.id===b.rowId&&r.data.direction==='in'&&r.data.kind==='transfer');
   const payment=all.find(p=>p.type==='sales_payment'&&p.id===b.paymentId&&p.data.state==='pending'&&!p.data.bankRowId);
   if(!row||!payment||row.revision!==b.revision||payment.revision!==b.paymentRevision)fail('ردیف بانک یا اعلام پرداخت تغییر کرده است؛ فهرست را تازه کنید.',409);
   if(bankMatch(row,all).status!=='ambiguous'||!transferPaymentFits(row,payment)||!all.some(a=>a.type==='sales_agent'&&a.id===payment.data.agentId&&a.data.active&&a.data.kind!=='referrer'))fail('اعلام انتخاب‌شده با ردیف بانکی قابل تطبیق نیست.',409);
   const code=bankCode(row.data.reference||'');
   if(code&&all.some(r=>r.id!==row.id&&r.data.receivingAccountId===row.data.accountId&&r.type==='sales_payment'&&r.data.state==='cleared'&&bankCode(r.data.reference||'')===code))fail('این شماره پیگیری قبلاً به وصول قطعی رسیده است.',409);
   resolution={rowId:row.id,agentId:payment.data.agentId,paymentId:payment.id,reason:sreq(b.reason,4000)};
   selected=[row];target=row.id;
  }
  if(b.mode==='reconcile'&&b.rowIds!=null){if(!Array.isArray(b.rowIds)||!b.rowIds.length||b.rowIds.length>500||new Set(b.rowIds).size!==b.rowIds.length)fail('فهرست معتبر تا ۵۰۰ ردیف انتخاب کنید.');for(const id of b.rowIds)if(!all.some(r=>r.type==='sales_bank_row'&&r.id===id))fail('ردیف انتخاب‌شده پیدا نشد.',404);selected=selected.filter(r=>b.rowIds.includes(r.id));}
  for(const row of selected){
   const match=resolution?{status:'ready',agentId:resolution.agentId,paymentId:resolution.paymentId,terminalId:undefined,reason:resolution.reason}:bankMatch(row,all);
   if(match.status==='ignored'){ignored++;continue;}if(match.status!=='ready'||!match.agentId){unresolved++;continue;}if(matched>=25)continue;account(row.data.accountId);
   recordSalesBankMatch({row,match:{...match,agentId:match.agentId},all,put,actorId:u.userId,operationId:b.id,now,today,manual:!!resolution});
   matched++;
  }
  const selectedIds=new Set(selected.map(r=>r.id));pendingReady=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&selectedIds.has(r.id)&&bankMatch(r,all).status==='ready').length;
 }
 const updates=[...writes.values()].filter(w=>w.old).map(w=>({id:w.id,revision:w.old.revision,data:JSON.stringify(w.data)})),inserts=[...writes.values()].filter(w=>!w.old).map(w=>({id:w.id,type:w.type,data:JSON.stringify(w.data)})),stmts:D1PreparedStatement[]=[];
 if(updates.length){const payload=JSON.stringify(updates);guard('NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE NOT EXISTS (SELECT 1 FROM flow_entities f WHERE f.id=json_extract(j.value,\'$.id\') AND f.revision=json_extract(j.value,\'$.revision\')))',payload);stmts.push(db.prepare("UPDATE flow_entities SET data=(SELECT json_extract(j.value,'$.data') FROM json_each(?) j WHERE json_extract(j.value,'$.id')=flow_entities.id),revision=revision+1,updated=? WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(payload,now,payload));}
 if(inserts.length)stmts.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.data'),1,?,? FROM json_each(?)").bind(now,now,JSON.stringify(inserts)));
 try{await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'sales_bank_'+b.mode,signature,u.userId,now),...checks,...stmts,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'sales_bank_'+b.mode,JSON.stringify({mode:b.mode,signature,imported,skipped,matched,unresolved,ignored,reason:b.mode==='reverse'?b.reason:undefined}),now)]);}catch(e){if(objectKey)try{await firmwareBucket().delete(objectKey);}catch{/* Original remains private if cleanup is unavailable. */}throw e;}
 if(b.mode==='import')pendingReady=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&bankMatch(r,all).status==='ready').length;
 return {saved:true,id:target,...(['import','archive_pos'].includes(b.mode)?{archived}:{}),...(['import','archive_pos','reconcile','resolve_transfer'].includes(b.mode)?{imported,skipped,matched,reconciled:matched,pendingReady,unresolved,ignored}: {})};
}
