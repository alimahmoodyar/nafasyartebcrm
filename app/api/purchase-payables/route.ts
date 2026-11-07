import {currentRemainderResolution,orderFinancialSummary} from '@/lib/sourcing-workflow';
import {storedAccessPermissions} from '@/lib/permissions';
import {purchaseCompletion} from '@/lib/purchase-fulfillment';
import {invoiceTypes,invoiceTaxStates} from '@/lib/purchase-invoice-contract';
import {invoiceDocument,invoiceDocumentMissing,invoiceFollowups,formalInvoiceReport} from '@/lib/purchase-invoice';
import {dayAt} from '@/lib/duties';
import {hasSupply} from '@/lib/sourcing';
import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {moneyMicro,moneyText} from '@/lib/costing';
import {normalizeExpense,suggestExpense} from '@/lib/expense-register';
import {apRead,apVisible,apBuyer,apFinance,apHelp,active,applied,apView,invoiceMatch,releaseBasis} from '@/lib/purchase-payables';
const types="'payable_file','purchase_payable','purchase_order','receipt','purchase_settlement','supplier','expense_register','expense_rule','material','purchase_service','cost_price','build_project','qms_record'";
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
const txt=(v:any,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('متن الزامی یا نامعتبر است.');return v.trim();};
const day=(v:any)=>{const s=txt(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail('تاریخ معتبر لازم است.');return s;};
const amount=(v:any)=>{try{if(moneyMicro(v)<=BigInt(0))fail('مبلغ مثبت لازم است.');return moneyText(moneyMicro(v));}catch{ return fail('مبلغ ریالی مثبت و معتبر لازم است.');}};
const arr=(v:any,max=100)=>{if(!Array.isArray(v)||v.length>max)fail('فهرست معتبر لازم است.');return v;};
const json=(v:any)=>Response.json(v,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function rows(){return (await storage().prepare('SELECT * FROM flow_entities WHERE type IN ('+types+') ORDER BY id').all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export async function GET(request?:Request){try{const u=await requireAccess();if(!apRead(u))fail('دسترسی خرید یا مالی لازم است.',403);const all=await rows(),cases=all.filter(r=>r.type==='purchase_payable'&&apVisible(u,r)),orders=all.filter(r=>r.type==='purchase_order'&&apVisible(u,r));const members=(await storage().prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results as any[];
 for(const r of [...cases,...orders])if(all.some(s=>s.type==='supplier'&&s.id===r.data.supplierId&&s.data.deletedAt))r.data.supplier+=' · حذف‌شده';
 const q=new URL(request?.url||'https://local/api/purchase-payables').searchParams;
 if(q.get('view')==='formal'){for(const k of ['from','to'])if(q.get(k))day(q.get(k));if(q.get('from')&&q.get('to')&&q.get('from')!>q.get('to')!)fail('بازه تاریخ معتبر نیست.');if(q.get('state')&&!Object.hasOwn(invoiceTaxStates,q.get('state')!))fail('وضعیت معتبر نیست.');const offset=Number(q.get('offset')||0);if(!Number.isInteger(offset)||offset<0)fail('صفحه معتبر نیست.');return json({...formalInvoiceReport(cases,all,q),asOf:new Date().toISOString(),manualTaxTracking:true});}
 return json({services:all.filter(r=>r.type==='purchase_service'&&cases.some(c=>c.id===r.data.caseId)).map(r=>({id:r.id,caseId:r.data.caseId,title:r.data.title,amount:r.data.amount})),followups:cases.flatMap(c=>invoiceFollowups(c,all,dayAt())),finance:apFinance(u),ceo:hasSupply(u,'ceo'),buyerRoutes:['domestic','foreign'].filter(route=>apBuyer(u,route)),routes:['domestic','foreign'].filter(r=>apFinance(u)||apBuyer(u,r)),cases:cases.map(c=>({...c,view:apView(c.data,all),completion:purchaseCompletion(c,all),files:all.filter(f=>f.type==='payable_file'&&!f.data.serviceId&&f.data.caseId===c.id).map(f=>({id:f.id,filename:f.data.filename,sha256:f.data.sha256,byteSize:f.data.byteSize}))})),orders,receipts:all.filter(r=>r.type==='receipt'&&orders.some(o=>o.id===r.data.purchaseOrderId)),settlements:all.filter(r=>r.type==='purchase_settlement'&&apVisible(u,r)),suppliers:all.filter(r=>r.type==='supplier').map(r=>({id:r.id,name:r.data.name+(r.data.deletedAt?' · حذف‌شده':''),deleted:!!r.data.deletedAt})),members:members.filter(m=>apRead({isAdmin:false,permissions:storedAccessPermissions(m.permissions)})).map(m=>({id:m.id,name:m.name})),help:apHelp});
 }catch(e){return accessResponse(e)||Response.json({error:'خواندن پرونده‌های خرید ممکن نشد.'},{status:503});}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess();if(!apRead(u))fail('دسترسی خرید یا مالی لازم است.',403);const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,120000)));
 if(b.confirmed!==true||typeof b.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id))fail('تأیید و UUID تازه لازم است.');
 const db=storage(),signature=JSON.stringify(b),prior:any=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(b.id).first();if(prior){if(prior.payload!==signature||prior.actor!==u.userId)fail('شناسه تکراری نامعتبر است.',409);return json({saved:true,repeated:true});}
 const all=await rows(),old=all.find(r=>r.id===b.caseId&&r.type==='purchase_payable');if(b.caseId&&(!old||!apVisible(u,old)))fail('پرونده در دسترس نیست.',404);if(b.revision!==(old?.revision||0))fail('پرونده تغییر کرده؛ تازه‌سازی کنید.',409);
 const notes=txt(b.notes,4000),now=new Date().toISOString(),target=old?.id||b.id;let d:any=old?structuredClone(old.data):null;const stmts:any[]=[];
 const finance=()=>{if(!apFinance(u))fail('این مرحله با دسترسی نوشتن مالی است.',403);};
 const buyer=()=>{if(!apFinance(u)&&!apBuyer(u,d.route))fail('دسترسی بازرگانی این مسیر لازم است.',403);};
 const find=(kind:string)=>{const item=d[kind].find((x:any)=>x.id===b.itemId&&!x.voided);if(!item)fail('ردیف فعال یافت نشد.');return item;};
 const stamp={at:now,actor:u.userId,notes};
 const validOrder=(id:string)=>{const o=all.find(r=>r.id===id&&r.type==='purchase_order');if(!o||o.data.state==='cancelled'||o.data.route!==d.route||o.data.supplierId!==d.supplierId)fail('سفارش باید به همین تأمین‌کننده و مسیر متصل باشد؛ خرید قدیمی با نام متنی نیازمند اصلاح هویت است.');return o;};
 if(b.mode==='create'){
 if(old)fail('پرونده قبلاً ساخته شده است.');const supplier=all.find(r=>r.type==='supplier'&&r.id===b.supplierId);if(supplier?.data.deletedAt)fail('تأمین‌کننده حذف شده است.',409);if(!supplier)fail('تأمین‌کننده را از پرونده‌های موجود انتخاب کنید.');if(!['domestic','foreign'].includes(b.route)||!apFinance(u)&&!apBuyer(u,b.route))fail('مسیر خرید مجاز لازم است.',403);
 d={supplierId:supplier.id,supplier:supplier.data.name,route:b.route,title:txt(b.title,200),invoices:[],payments:[],allocations:[],advances:[],issues:[],history:[]};
 }else{
 if(!old)fail('ابتدا پرونده خرید بسازید.');
 if(d.completion&&!['reopen_case','refund_supplier_credit','offset_supplier_credit'].includes(b.mode))fail('پرونده بسته است؛ ابتدا بازگشایی مالی انجام دهید.');
 const requests:any[]=d.paymentRequests??=[];
 const paymentRequest=()=>find('paymentRequests');
 const requestInstrument=(r:any)=>{
  const kind=r.kind==='advance'?'advances':'invoices';
  const instrument=d[kind].find((i:any)=>i.id===r.instrumentId&&!i.voided);
  if(!instrument||instrument.closed)fail('برنامه پرداخت فعال یافت نشد.',409);
  return instrument;
 };
 const requestBasis=(r:any,i:any)=>r.kind==='advance'
  ?JSON.stringify({amount:i.amount,due:i.due,condition:i.condition,order:i.orderId,revision:validOrder(i.orderId).revision,issues:active(d.issues).filter((x:any)=>x.state!=='resolved')})
  :releaseBasis(d,i,all);
 const remainingRequest=(r:any)=>moneyMicro(r.amount)-(d.creditOffsets||[]).filter((x:any)=>x.paymentRequestId===r.id).reduce((n:bigint,x:any)=>n+moneyMicro(x.amount),BigInt(0))-active(d.payments).filter((p:any)=>p.paymentRequestId===r.id).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0));
 const verifyPaymentRequest=(r:any,i:any)=>{
  if(active(d.issues).some((x:any)=>x.state!=='resolved'))fail('ابتدا نقص‌های باز را تعیین تکلیف کنید.',409);
  if(r.kind==='invoice'){
   const view=apView(d,all).invoices.find((x:any)=>x.id===i.id);
   if(!i.recognition||!i.schedule?.length||view.blockers.length)fail('تطبیق دریافت و کیفیت، بدهی و برنامه اقساط باید تکمیل شوند.',409);
   if(remainingRequest(r)>moneyMicro(i.amount)-applied(d,'invoiceId',i.id)-moneyMicro(i.dispute?.amount||'0'))fail('درخواست از مانده فاکتور بیشتر است.',409);
  }else{
   const used=active(d.payments).filter((p:any)=>p.advanceId===i.id).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0));
   if(remainingRequest(r)>moneyMicro(i.amount)-used)fail('درخواست از مانده پیش‌پرداخت بیشتر است.',409);
  }
 };
 if(b.mode==='register_supplier_credit'){
  finance();const order=validOrder(txt(b.orderId,200));
  if(!order.data.pendingSupplierCredit||!currentRemainderResolution(order,all))fail('تصمیم معتبر مدیرعامل برای مانده سفارش لازم است.',409);
  const payableCases=all.filter(x=>x.type==='purchase_payable'&&x.data.supplierId===d.supplierId);
  const financial=orderFinancialSummary(order,payableCases);
  const invoiced=moneyMicro(financial.invoicedRial),paid=moneyMicro(financial.paidRial);
  const acceptedLines=payableCases.flatMap(c=>active(c.data.invoices).filter(i=>i.recognition&&!invoiceMatch(c.data,i,all).blockers.length).flatMap(i=>i.lines.filter((l:any)=>l.orderId===order.id)));
  const recognized=acceptedLines.reduce((sum,l)=>sum+moneyMicro(l.amount),BigInt(0));
  const acceptedQuantity=acceptedLines.reduce((sum,l)=>sum+l.quantity,0);
  if(recognized!==invoiced||acceptedQuantity!==order.data.remainderResolution.accepted||paid<invoiced)fail('ابتدا مبلغ کالای پذیرفته‌شده و مانده پرداخت را در مالی تعیین تکلیف کنید.',409);
  const credit=paid-invoiced;
  if(credit>BigInt(0))d.supplierCredits=[...(d.supplierCredits||[]),{id:b.id,orderId:order.id,amount:moneyText(credit),movements:[],...stamp}];
  const updated={...order.data,pendingSupplierCredit:false,state:'closed',closedAt:now,supplierCreditId:credit>BigInt(0)?b.id:null,history:[...(order.data.history||[]),{stage:b.mode,credit:moneyText(credit),...stamp}]};
  stmts.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(updated),now,order.id,order.revision));
 }else if(b.mode==='refund_supplier_credit'||b.mode==='offset_supplier_credit'){
  finance();
  const credit=(d.supplierCredits||[]).find((x:any)=>x.id===b.itemId);
  if(!credit)fail('طلب فعال یافت نشد.',404);
  const total=amount(b.amount),balance=moneyMicro(credit.amount)-credit.movements.reduce((sum:bigint,x:any)=>sum+moneyMicro(x.amount),BigInt(0));
  if(moneyMicro(total)>balance)fail('مبلغ از مانده طلب بیشتر است.',409);
  if(b.mode==='refund_supplier_credit'){
   const reference=txt(b.reference,200),date=day(b.day);
   if(date>dayAt()||!invoiceDocument({documentId:b.documentId},target,all))fail('تاریخ و سند واقعی برگشت وجه لازم است.');
   if(all.filter(x=>x.type==='purchase_payable').some(x=>(x.data.supplierCredits||[]).some((c:any)=>c.movements.some((m:any)=>m.kind==='refund'&&normalizeExpense(m.reference)===normalizeExpense(reference)))))fail('مرجع برگشت وجه قبلاً ثبت شده است.',409);
   credit.movements.push({id:b.id,kind:'refund',amount:total,reference,day:date,documentId:b.documentId,...stamp});
  }else{
   const destination=all.find(x=>x.type==='purchase_payable'&&x.id===b.destinationCaseId&&x.data.supplierId===d.supplierId);
   if(!destination||destination.data.completion)fail('پرونده باز همین تأمین‌کننده را انتخاب کنید.',409);
   const next=destination.id===target?d:structuredClone(destination.data);
   const invoice=active(next.invoices).find((i:any)=>i.id===b.invoiceId);
   const view=apView(next,all).invoices.find((i:any)=>i.id===b.invoiceId);
   const approved=(next.paymentRequests||[]).find((r:any)=>r.kind==='invoice'&&r.instrumentId===b.invoiceId&&r.state==='approved'&&r.basis===releaseBasis(next,invoice,all));
   if(!invoice?.recognition||invoice.lines.some((l:any)=>!l.orderId||l.orderId===credit.orderId)||view.blockers.length||(!view.released&&!approved))fail('فاکتور خرید بعدی باید آماده و مجاز به پرداخت باشد.',409);
   const payable=view.queue.filter((q:any)=>q.due<=dayAt()).reduce((sum:bigint,q:any)=>sum+moneyMicro(q.remaining),BigInt(0));
   if(moneyMicro(total)>payable)fail('مبلغ کسر از مانده سررسیدشده بیشتر است.',409);
   const movement={id:b.id,kind:'offset',amount:total,caseId:destination.id,invoiceId:invoice.id,...stamp};
   credit.movements.push(movement);
   next.creditOffsets=[...(next.creditOffsets||[]),{...movement,originCaseId:target,creditId:credit.id,paymentRequestId:approved?.id}];
   if(approved){
    const settled=active(next.payments).filter((x:any)=>x.paymentRequestId===approved.id).reduce((sum:bigint,x:any)=>sum+moneyMicro(x.amount),BigInt(0))+next.creditOffsets.filter((x:any)=>x.paymentRequestId===approved.id).reduce((sum:bigint,x:any)=>sum+moneyMicro(x.amount),BigInt(0));
    if(settled>moneyMicro(approved.amount))fail('کسر از مانده درخواست مصوب بیشتر است.',409);
    if(settled===moneyMicro(approved.amount))approved.state='paid';
   }
   if(destination.id!==target)stmts.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(next),now,destination.id,destination.revision));
  }
 }else if(b.mode==='request_payment'){
  if(!apBuyer(u,d.route))fail('درخواست را تأمین همین مسیر ارسال می‌کند.',403);
  if(!['advance','invoice'].includes(b.kind))fail('نوع درخواست معتبر نیست.');
  const previous=b.itemId?paymentRequest():null;
  if(previous&&!['returned','finance'].includes(previous.state))fail('درخواست در این مرحله قابل اصلاح نیست.',409);
  if(previous?.state==='returned'&&!previous.returnTo.includes('buyer'))fail('درخواست به تأمین ارجاع نشده است.',403);
  const r={...previous,id:previous?.id||b.id,kind:b.kind,instrumentId:txt(b.instrumentId,200),amount:amount(b.amount),account:txt(b.account,200),documentId:txt(b.documentId,200),state:'finance',returnTo:[],answers:{},basis:null,financeReview:null,request:stamp};
  if(!invoiceDocument({documentId:r.documentId},target,all))fail('مدرک درخواست باید به همین پرونده پیوست شده باشد.');
  if(requests.some(x=>x.id!==r.id&&x.instrumentId===r.instrumentId&&x.state!=='paid'))fail('این برنامه درخواست پرداخت باز دارد.',409);
  const i=requestInstrument(r);verifyPaymentRequest(r,i);
  d.paymentRequests=[...requests.filter(x=>x.id!==r.id),r];
 }else if(b.mode==='review_payment_request'||b.mode==='decide_payment_request'||b.mode==='answer_payment_request'){
  const r=paymentRequest(),i=requestInstrument(r);
  if(b.mode==='review_payment_request'){
   finance();
   if(r.state!=='finance'||!['pass','fail'].includes(b.result))fail('درخواست در صف بررسی مالی نیست.',409);
   if(b.result==='pass'){verifyPaymentRequest(r,i);r.state='ceo';r.basis=requestBasis(r,i);r.financeReview=stamp;}
   else{r.state='returned';r.returnTo=['buyer'];r.answers={};r.returnReason=stamp;r.returnedBy='finance';}
  }else if(b.mode==='answer_payment_request'){
   if(!['finance','buyer'].includes(b.role)||(b.role==='finance'?!apFinance(u):!apBuyer(u,d.route)))fail('دسترسی پاسخ این واحد لازم است.',403);
   if(r.state!=='returned'||!r.returnTo.includes(b.role)||r.answers[b.role])fail('ارجاع برای این واحد باز نیست.',409);
   r.answers[b.role]=stamp;
   if(r.returnedBy==='finance')r.state='finance';
  }else{
   if(!hasSupply(u,'ceo'))fail('تصمیم با مدیرعامل است.',403);
   if(!(r.state==='ceo'||r.state==='returned'&&r.returnedBy==='ceo'&&Object.keys(r.answers).length)||!['pass','fail'].includes(b.result))fail('درخواست آماده تصمیم نیست.',409);
   if(b.result==='pass'){
    if(r.basis!==requestBasis(r,i))fail('مبنای پرداخت تغییر کرده؛ بررسی مالی تازه لازم است.',409);
    verifyPaymentRequest(r,i);r.state='approved';r.ceoApproval=stamp;
   }else{
    if(!['finance','buyer','both'].includes(b.destination))fail('مقصد ارجاع را انتخاب کنید.');
    r.state='returned';r.returnedBy='ceo';r.returnTo=b.destination==='both'?['finance','buyer']:[b.destination];r.answers={};r.returnReason=stamp;
   }
  }
 }else if(b.mode==='revise_approved_payment'){
  finance();const r=paymentRequest(),i=requestInstrument(r);
  if(r.state!=='approved'||r.basis!==requestBasis(r,i))fail('درخواست مصوب جاری لازم است.',409);
  const changed={...r,amount:amount(b.amount),account:txt(b.account,200)};
  if(remainingRequest(changed)<=BigInt(0))fail('مبلغ باید بیشتر از پرداخت ثبت‌شده باشد.');
  verifyPaymentRequest(changed,i);Object.assign(r,changed,{financeAdjustment:{...stamp,previousAmount:r.amount,previousAccount:r.account}});
 }else if(b.mode==='execute_payment_request'){
  finance();const r=paymentRequest(),i=requestInstrument(r);
  if(r.state!=='approved'||r.basis!==requestBasis(r,i))fail('درخواست مصوب و منطبق با نسخه جاری لازم است.',409);
  verifyPaymentRequest(r,i);
  const total=amount(b.amount),reference=txt(b.reference,200),date=day(b.day);
  if(date>dayAt()||moneyMicro(total)>remainingRequest(r))fail('تاریخ یا مبلغ خارج از حدود درخواست است.');
  if(r.kind==='advance'&&date<i.due)fail('موعد پیش‌پرداخت نرسیده است.');
  if(r.kind==='invoice'){
   const dueAmount=i.schedule.filter((x:any)=>x.due<=date).reduce((sum:bigint,x:any)=>sum+moneyMicro(x.amount),BigInt(0));
   if(moneyMicro(total)+applied(d,'invoiceId',i.id)>dueAmount)fail('مبلغ از اقساط سررسیدشده بیشتر است.');
  }
  if(!invoiceDocument({documentId:b.documentId},target,all)||b.documentId===r.documentId)fail('فایل جداگانه رسید بانکی متعلق به همین پرونده لازم است.');
  if(active(d.payments).some((payment:any)=>payment.documentId===b.documentId))fail('این رسید بانکی قبلاً ثبت شده است.',409);
  if(all.filter(x=>x.type==='purchase_payable').some(x=>active(x.data.payments).some((p:any)=>normalizeExpense(p.reference)===normalizeExpense(reference))))fail('مرجع بانکی قبلاً ثبت شده است.',409);
  d.payments.push({id:b.id,reference,day:date,amount:total,evidence:b.documentId,documentId:b.documentId,purpose:'پرداخت درخواست مصوب',orderId:r.kind==='advance'?i.orderId:'',advanceId:r.kind==='advance'?i.id:'',paymentRequestId:r.id,account:r.account,...stamp});
  if(r.kind==='invoice')d.allocations.push({id:b.id,invoiceId:i.id,paymentId:b.id,amount:total,...stamp});
  if(remainingRequest(r)===BigInt(0))r.state='paid';
  r.latestPaymentId=b.id;
 }else if(b.mode==='acknowledge_payment'){
  if(!apBuyer(u,d.route))fail('تأیید دریافت رسید با تأمین است.',403);
  const r=paymentRequest();
  if(!r.latestPaymentId||r.paymentAcknowledgement?.paymentId===r.latestPaymentId)fail('رسید جدیدی برای بررسی وجود ندارد.',409);
  r.paymentAcknowledgement={...stamp,paymentId:r.latestPaymentId};
 }else if(b.mode==='close_case'){finance();const completion=purchaseCompletion({id:target,data:d},all);if(!completion.ready)fail(completion.blockers.join(' / '));d.completion=stamp;
 }else if(b.mode==='reopen_case'){finance();if(!d.completion)fail('پرونده بسته نیست.');d.completion=null;
 }else if(b.mode==='invoice'){
 buyer();const item=b.itemId?find('invoices'):null;if(!Object.hasOwn(invoiceTypes,b.invoiceType))fail('رسمی یا غیررسمی بودن فاکتور را انتخاب کنید.');if(item?.tax?.state&&item.tax.state!=='awaiting_seller'&&item.invoiceType!==b.invoiceType)fail('نوع فاکتور ارسال‌شده به مؤدیان را نمی‌توان تغییر داد.');if(b.documentId&&!invoiceDocument({documentId:b.documentId},target,all))fail('فایل واقعی متعلق به همین پرونده را انتخاب کنید.');if(item?.recognition||item&&applied(d,'invoiceId',item.id)>BigInt(0))fail('فاکتور دارای بدهی یا تخصیص را نمی‌توان بازنویسی کرد.');
 const lines=arr(b.lines,60).map((l:any)=>{if(l.serviceId){if(b.lines.length!==1)fail('فاکتور خدمت را با یک تعهد خدمت ثبت کنید؛ تخصیص یک پرداخت به چند فاکتور مجاز است.');const service=all.find(r=>r.type==='purchase_service'&&r.id===l.serviceId&&r.data.caseId===target);if(!service)fail('تعهد خدمت همین پرونده لازم است.');const totalOther=active(d.invoices).filter((i:any)=>i.id!==item?.id&&i.lines.some((x:any)=>x.serviceId===service.id)).reduce((n:bigint,i:any)=>n+moneyMicro(i.amount),BigInt(0));if(totalOther+moneyMicro(l.amount)>moneyMicro(service.data.amount))fail('جمع فاکتور از مبلغ تعهد خدمت بیشتر است.');return {serviceId:service.id,orderId:'',quantity:1000,receiptIds:[],amount:amount(l.amount)};}validOrder(l.orderId);if(typeof l.quantity!=='string'||!/^\d{1,9}(\.\d{1,3})?$/.test(l.quantity))fail('مقدار فاکتور معتبر لازم است.');const quantity=Math.round(Number(l.quantity)*1000);if(quantity<=0)fail('مقدار مثبت لازم است.');const receiptIds=arr(l.receiptIds,100);if(new Set(receiptIds).size!==receiptIds.length)fail('رسید تکراری است.');for(const id of receiptIds){const r=all.find(r=>r.id===id&&r.type==='receipt');if(!r||r.data.purchaseOrderId!==l.orderId)fail('رسید با سفارش منطبق نیست.');}return {orderId:l.orderId,quantity,receiptIds,amount:amount(l.amount)};});
 if(!lines.length||new Set(lines.map((l:any)=>l.orderId)).size!==lines.length)fail('سفارش‌های یکتا برای ردیف‌های فاکتور لازم است.');const total=amount(b.amount);if(lines.reduce((n:bigint,l:any)=>n+moneyMicro(l.amount),BigInt(0))!==moneyMicro(total))fail('جمع مبلغ ردیف‌ها با فاکتور برابر نیست.');
 const reference=txt(b.reference,200),itemId=item?.id||b.id;for(const c of all.filter(r=>r.type==='purchase_payable'&&r.data.supplierId===d.supplierId)){for(const i of active(c.data.invoices)){if(c.id===target&&i.id===itemId)continue;if(normalizeExpense(i.reference)===normalizeExpense(reference))fail('این فاکتور برای تأمین‌کننده قبلاً ثبت شده است.',409);if(i.lines.some((l:any)=>l.receiptIds.some((id:string)=>lines.some((n:any)=>n.receiptIds.includes(id)))))fail('رسید در فاکتور دیگری استفاده شده است؛ از همان پرونده استفاده کنید.',409);}}
 const settlementId=b.settlementId||'';if(settlementId){const s=all.find(r=>r.type==='purchase_settlement'&&r.id===settlementId);if(!s||s.data.supplierId!==d.supplierId||s.data.route!==d.route||normalizeExpense(s.data.invoiceNumber)!==normalizeExpense(reference)||s.data.lines.some((l:any)=>!lines.some((n:any)=>n.receiptIds.includes(l.receiptId))))fail('تسویه خرید باید مربوط به همین فاکتور و رسیدها باشد.');}
 const value={id:itemId,invoiceType:b.invoiceType,documentId:b.documentId||'',tax:b.invoiceType==='formal'?(item?.tax||{state:'awaiting_seller'}):null,reference,day:day(b.day),amount:total,lines,evidence:typeof b.evidence==='string'?b.evidence.slice(0,2000):'',terms:txt(b.terms),purpose:txt(b.purpose),settlementId,classification:suggestExpense(txt(b.purpose),all.filter(r=>r.type==='expense_rule')),recognition:null,schedule:[],release:null};if(item)Object.assign(item,value);else d.invoices.push(value);
 }else if(b.mode==='invoice_classify'){
 buyer();const i=find('invoices');if(i.invoiceType)fail('نوع این فاکتور قبلاً تعیین شده است.');if(!Object.hasOwn(invoiceTypes,b.invoiceType))fail('نوع فاکتور را انتخاب کنید.');i.invoiceType=b.invoiceType;i.tax=b.invoiceType==='formal'?{state:'awaiting_seller'}:null;i.release=null;
 }else if(b.mode==='invoice_document'){
 buyer();const i=find('invoices');if(!invoiceDocument({documentId:b.documentId},target,all))fail('سند بارگذاری‌شده متعلق به همین پرونده لازم است.');i.documentId=b.documentId;i.release=null;
 }else if(b.mode==='invoice_tax'){
 buyer();const i=find('invoices');if(i.invoiceType!=='formal')fail('وضعیت مؤدیان فقط برای فاکتور رسمی است.');if(!Object.hasOwn(invoiceTaxStates,b.taxState))fail('وضعیت مؤدیان معتبر نیست.');const taxDay=day(b.taxDay);if(taxDay>dayAt())fail('تاریخ اقدام نمی‌تواند در آینده باشد.');const taxId=b.taxState==='awaiting_seller'?'':txt(b.taxId,100);if(taxId&&all.some(c=>c.type==='purchase_payable'&&active(c.data.invoices).some((x:any)=>x.id!==i.id&&x.tax?.taxId===taxId)))fail('شناسه مالیاتی برای فاکتور دیگری ثبت شده است.',409);i.tax={state:b.taxState,taxId,day:taxDay,note:notes,...stamp,source:'manual'};
 }else if(b.mode==='match'){
 buyer();const i=find('invoices');if(i.lines.some((l:any)=>l.serviceId))fail('دریافت خدمت در پرونده تحویل خدمت تأیید می‌شود.');const links=arr(b.lines,60);if(links.length!==i.lines.length||new Set(links.map((l:any)=>l.orderId)).size!==links.length)fail('همه ردیف‌های فاکتور را تطبیق دهید.');
 for(const l of links){const line=i.lines.find((x:any)=>x.orderId===l.orderId);if(!line)fail('سفارش متعلق به این فاکتور نیست.');validOrder(l.orderId);const ids=arr(l.receiptIds,100);if(new Set(ids).size!==ids.length)fail('رسید تکراری است.');for(const id of ids){const r=all.find(x=>x.type==='receipt'&&x.id===id);if(!r||r.data.purchaseOrderId!==l.orderId)fail('رسید و سفارش منطبق نیستند.');if(all.filter(c=>c.type==='purchase_payable').some(c=>active(c.data.invoices).some((inv:any)=>(c.id!==target||inv.id!==i.id)&&inv.lines.some((x:any)=>x.receiptIds.includes(id)))))fail('رسید در فاکتور دیگری استفاده شده است.',409);}line.receiptIds=ids;}i.release=null;
 }else if(b.mode==='payment'){
 finance();const reference=txt(b.reference,200);if(all.filter(r=>r.type==='purchase_payable').some(c=>active(c.data.payments).some((p:any)=>normalizeExpense(p.reference)===normalizeExpense(reference))))fail('این مرجع پرداخت قبلاً ثبت شده است؛ پرداخت تکراری نسازید.',409);
 const total=amount(b.amount),advanceId=b.advanceId||'';const advanceOrderId=d.advances.find((a:any)=>a.id===advanceId)?.orderId;const linkedOrder=b.orderId||advanceOrderId;if(linkedOrder&&validOrder(linkedOrder).data.paymentWorkflowRequired)fail('پرداخت خرید از درخواست مصوب ثبت می‌شود.',409);if(requests.some(r=>r.kind==='advance'&&(r.instrumentId===advanceId||b.orderId&&d.advances.some((a:any)=>a.id===r.instrumentId&&a.orderId===b.orderId))))fail('پرداخت این پیش‌پرداخت از فرم درخواست مصوب انجام می‌شود.',409);if(advanceId){const a=d.advances.find((x:any)=>x.id===advanceId&&!x.voided);if(!a||a.closed)fail('برنامه پیش‌پرداخت فعال پیدا نشد.');const used=active(d.payments).filter((p:any)=>p.advanceId===advanceId).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0));if(used+moneyMicro(total)>moneyMicro(a.amount))fail('مبلغ از مانده برنامه پیش‌پرداخت بیشتر است.');}
 const serviceId=b.serviceId||d.advances.find((a:any)=>a.id===advanceId)?.serviceId||'';if(serviceId&&!all.some(s=>s.type==='purchase_service'&&s.id===serviceId&&s.data.caseId===target))fail('تعهد خدمت همین پرونده لازم است.');if(serviceId&&b.orderId)fail('پرداخت را به کالا یا خدمت مشخص وصل کنید.');d.payments.push({serviceId,id:b.id,reference,day:day(b.day),amount:total,evidence:txt(b.evidence),purpose:txt(b.purpose),orderId:b.orderId||'',advanceId,...stamp});
 }else if(b.mode==='recognize'){
 finance();const i=find('invoices');if(i.recognition)fail('بدهی قبلاً تأیید شده است.');if(i.invoiceType==='formal'?invoiceDocumentMissing(i,all,target):i.invoiceType!=='informal'&&!i.evidence)fail('مدرک فاکتور را تکمیل کنید.');i.recognition={...stamp,account:txt(b.account,200),basis:txt(b.basis)};
 }else if(b.mode==='unrecognize'){
 finance();const i=find('invoices');if(!i.recognition||applied(d,'invoiceId',i.id)>BigInt(0))fail('ابتدا تخصیص‌های این بدهی را مستنداً برگشت دهید.');i.recognition=null;i.release=null;i.schedule=[];
 }else if(b.mode==='allocate'){
 finance();const i=d.invoices.find((x:any)=>x.id===b.invoiceId&&!x.voided),p=d.payments.find((x:any)=>x.id===b.paymentId&&!x.voided);if(!i?.recognition||!p)fail('فاکتور دارای بدهی تأییدشده و پرداخت واقعی همین پرونده لازم است.');if((requests.some(r=>r.kind==='invoice'&&r.instrumentId===i.id)||i.lines.some((line:any)=>line.orderId&&validOrder(line.orderId).data.paymentWorkflowRequired))&&(!p.advanceId||!p.paymentRequestId))fail('پرداخت این فاکتور را از درخواست مصوب ثبت کنید.',409);const total=amount(b.amount);if(moneyMicro(total)>moneyMicro(i.amount)-applied(d,'invoiceId',i.id)||moneyMicro(total)>moneyMicro(p.amount)-applied(d,'paymentId',p.id))fail('مبلغ از مانده فاکتور یا پرداخت بیشتر است.');if(p.serviceId&&!i.lines.some((l:any)=>l.serviceId===p.serviceId))fail('پرداخت متعلق به خدمت دیگری است.');if(p.orderId&&!i.lines.some((l:any)=>l.orderId===p.orderId))fail('پرداخت برای سفارش دیگری ثبت شده است.');d.allocations.push({id:b.id,invoiceId:i.id,paymentId:p.id,amount:total,...stamp});
 }else if(b.mode==='schedule'){
 finance();const i=find('invoices');if(!i.recognition)fail('ابتدا بدهی را تأیید کنید.');const schedule=arr(b.schedule,50).map((s:any,n:number)=>({id:b.id+':'+n,due:day(s.due),amount:amount(s.amount),condition:txt(s.condition,1000)}));if(!schedule.length||schedule.reduce((n:bigint,s:any)=>n+moneyMicro(s.amount),BigInt(0))!==moneyMicro(i.amount))fail('جمع اقساط باید با کل فاکتور برابر باشد؛ پیش‌پرداخت خودکار از اولین سررسیدها کسر می‌شود.');i.schedule=schedule;i.release=null;
 }else if(b.mode==='dispute'){
 finance();const i=find('invoices');const match=invoiceMatch(d,i,all);if(!i.recognition||match.blockers.some((x:string)=>!['مغایرت تعداد فاکتور و دریافت','کالای مردود نیازمند تعیین تکلیف'].includes(x)))fail('بدهی و نتایج کامل دریافت/کیفیت برای تعیین مبلغ اختلاف لازم است.');const held=amount(b.amount);if(moneyMicro(held)>moneyMicro(i.amount))fail('مبلغ اختلاف از کل فاکتور بیشتر است.');if(match.lines.every((l:any)=>l.accepted===0)&&moneyMicro(held)!==moneyMicro(i.amount))fail('در رد کامل کل مبلغ باید در اختلاف بماند.');i.dispute={...stamp,amount:held,evidence:txt(b.evidence),match:JSON.stringify(match)};i.release=null;
 }else if(b.mode==='clear_dispute'){
 finance();const i=find('invoices');if(!i.dispute)fail('اختلافی ثبت نشده است.');if(invoiceMatch(d,i,all).blockers.length)fail('ابتدا دریافت یا فاکتور و علت اختلاف را اصلاح کنید.');i.dispute=null;i.release=null;
 }else if(b.mode==='release'){
 finance();const i=find('invoices');if(requests.some(r=>r.kind==='invoice'&&r.instrumentId===i.id)||i.lines.some((line:any)=>line.orderId&&validOrder(line.orderId).data.paymentWorkflowRequired))fail('اجازه پرداخت از مسیر درخواست مصوب ثبت می‌شود.',409);const v=apView(d,all).invoices.find((x:any)=>x.id===i.id);if(v.blockers.length||!i.schedule.length)fail([...v.blockers,...(!i.schedule.length?['برنامه سررسید را ثبت کنید']:[])].join(' / '));i.release={...stamp,basis:releaseBasis(d,i,all)};
 }else if(b.mode==='hold'){
 finance();find('invoices').release=null;
 }else if(b.mode==='advance'){
 finance();if(b.orderId)validOrder(b.orderId);if(b.serviceId&&(!all.some(s=>s.type==='purchase_service'&&s.id===b.serviceId&&s.data.caseId===target)||b.orderId))fail('تعهد خدمت همین پرونده و بدون سفارش کالا لازم است.');d.advances.push({serviceId:b.serviceId||'',id:b.id,orderId:b.orderId||'',amount:amount(b.amount),due:day(b.due),condition:txt(b.condition),evidence:txt(b.evidence),release:null,...stamp});
 }else if(b.mode==='close_advance'){
 finance();find('advances').closed=stamp;
 }else if(b.mode==='release_advance'){
 finance();if(active(d.issues).some((x:any)=>x.state!=='resolved'))fail('پیگیری باز باید تعیین تکلیف شود.');const a=find('advances');if(requests.some(r=>r.kind==='advance'&&r.instrumentId===a.id)||a.orderId&&validOrder(a.orderId).data.paymentWorkflowRequired)fail('اجازه پیش‌پرداخت از مسیر درخواست مصوب ثبت می‌شود.',409);if(a.closed)fail('برنامه بسته شده است.');const order=a.orderId?validOrder(a.orderId):null;a.release={...stamp,orderRevision:order?.revision||0};
 }else if(b.mode==='issue'){
 buyer();const ownerId=txt(b.ownerId,200),member:any=await db.prepare("SELECT id,permissions FROM app_members WHERE id=? AND status='active'").bind(ownerId).first();if(!member||!apVisible({isAdmin:false,permissions:storedAccessPermissions(member.permissions)},{data:d}))fail('مسئول باید کاربر فعال دارای دسترسی این پرونده باشد.');const due=day(b.due),title=txt(b.title,200);d.issues.push({id:b.id,title,ownerId,due,state:'open',...stamp});for(const i of d.invoices)i.release=null;for(const a of d.advances)a.release=null;
 stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,NULL,?,'open',?,1,?,?)").bind('ap-task:'+b.id,'purchase-payable:'+target,b.id,ownerId,due+'T13:30:00.000Z',JSON.stringify({title:'تکمیل خرید · '+d.supplier+' · '+title,sourceSection:apFinance({isAdmin:false,permissions:storedAccessPermissions(member.permissions)})?'costing':'sourcing',instructions:'پرونده «'+d.title+'» در بدهی و پرداخت خرید: '+notes+'؛ مالی پس از بررسی مدرک نقص را در همان پرونده می‌بندد.',history:[],evidence:'text',payableId:target}),now,now));
 }else if(b.mode==='resolve_issue'){
 finance();const i=find('issues');if(i.state==='resolved')fail('قبلاً بسته شده است.');i.state='resolved';i.resolution={...stamp,evidence:txt(b.evidence)};stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=?").bind(now,'ap-task:'+i.id));
 }else if(b.mode==='void'){
 finance();if(!['invoices','payments','allocations','advances'].includes(b.kind))fail('نوع ابطال معتبر نیست.');const x=find(b.kind);if(b.kind==='payments'&&applied(d,'paymentId',x.id)>BigInt(0)||b.kind==='invoices'&&(x.recognition||applied(d,'invoiceId',x.id)>BigInt(0))||b.kind==='advances'&&active(d.payments).some((p:any)=>p.advanceId===x.id))fail('ابتدا ارتباط‌ها یا بدهی را برگشت دهید.');x.voided=stamp;
 }else fail('عملیات معتبر نیست.');
 }
 // Project pending work to the existing internal inbox; no external messages.
 const work:{key:string;role:string;title:string}[]=[],view=apView(d,all);
 for(const i of view.invoices){if(i.invoiceType!=='informal'&&(i.invoiceType==='formal'?invoiceDocumentMissing(i,all,target):!i.evidence))work.push({key:'evidence:'+i.id,role:'buyer',title:'تکمیل مدرک فاکتور '+i.reference});else if(!i.recognition)work.push({key:'debt:'+i.id,role:'finance',title:'بررسی و شناسایی بدهی فاکتور '+i.reference});if(i.match.blockers.length)work.push({key:'receipt:'+i.id,role:'buyer',title:'پیگیری دریافت / تطبیق فاکتور '+i.reference});if(i.recognition&&(!i.schedule.length||!i.released)&&Number(i.remaining)>0)work.push({key:'release:'+i.id,role:'finance',title:'بررسی سررسید و اجازه پرداخت '+i.reference});}
 for(const p of view.payments.filter((p:any)=>Number(p.available)>0))work.push({key:'payment:'+p.id,role:view.invoices.some((i:any)=>i.recognition&&Number(i.remaining)>0)?'finance':'buyer',title:'تکمیل فاکتور و تخصیص پرداخت '+p.reference});
 for(const r of d.paymentRequests||[]){
  if(['finance','approved'].includes(r.state))work.push({key:'request:'+r.id,role:'finance',title:r.state==='approved'?'اجرای پرداخت مصوب':'بررسی درخواست پرداخت'});
  if(r.state==='ceo'||r.state==='returned'&&r.returnedBy==='ceo'&&Object.keys(r.answers).length)work.push({key:'decision:'+r.id,role:'ceo',title:'تصمیم درباره درخواست پرداخت'});
  if(r.state==='returned')for(const role of r.returnTo)if(!r.answers[role])work.push({key:'answer:'+r.id+':'+role,role,title:'پاسخ به برگشت درخواست پرداخت'});
  if(r.latestPaymentId&&r.paymentAcknowledgement?.paymentId!==r.latestPaymentId)work.push({key:'receipt:'+r.latestPaymentId,role:'buyer',title:'پیگیری رسید پرداخت خرید'});
 }
 const members=(await db.prepare("SELECT id,permissions FROM app_members WHERE status='active'").all()).results as any[];
 const recipients=(role:string)=>members.filter(m=>{const member={isAdmin:false,permissions:storedAccessPermissions(m.permissions)};return role==='finance'?apFinance(member):role==='ceo'?hasSupply(member as any,'ceo'):apBuyer(member,d.route);});
 d.unassignedWork=work.filter(w=>!recipients(w.role).length).map(w=>w.title);
 stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE template_id=? AND state NOT IN ('completed','cancelled')").bind(now,'ap-auto:'+target));
 for(const w of work)for(const m of recipients(w.role))stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,NULL,?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',data=excluded.data,revision=duty_runs.revision+1,updated=excluded.updated").bind('ap-auto:'+target+':'+w.key+':'+m.id,'ap-auto:'+target,w.key,m.id,new Date(Date.parse(now)+48*3600000).toISOString(),JSON.stringify({title:w.title+' · '+d.supplier,sourceSection:w.key.startsWith('request:')||w.key.startsWith('decision:')||w.key.startsWith('answer:')||w.key.startsWith('receipt:')?'sourcing':w.role==='finance'?'costing':'sourcing',sourceId:'purchase-payable:'+target,instructions:'پرونده «'+d.title+'» در بدهی و پرداخت خرید را باز کنید. پاسخ متنی جای ثبت مدرک، تطبیق یا تأیید مالی نیست.',history:[],evidence:'text',payableId:target}),now,now));
 d.history.push({mode:b.mode,...stamp,itemId:b.itemId||b.id});
 const lock=db.prepare('UPDATE inventory_operations SET guard=CASE WHEN (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type IN ('+types+'))=? AND COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=? THEN guard ELSE 0 END WHERE id=?').bind(all.reduce((n,r)=>n+r.revision,0),target,old?.revision||0,b.id);
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'purchase_payable_'+b.mode,signature,u.userId,now),lock,old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify(d),now,target):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'purchase_payable',?,1,?,?)").bind(target,JSON.stringify(d),now,now),...stmts,db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'purchase_payable_'+b.mode,old?JSON.stringify(old.data):null,JSON.stringify(d),now)]);return json({saved:true,id:target});
 }catch(e){return accessResponse(e)||Response.json({error:'ثبت انجام نشد؛ داده و نسخه پرونده را بررسی کنید.'},{status:409});}}
