import {AccessError} from './authorization';
import {taskRequired as required,memberId} from './duties';
import {hasSupply,needSupply,supplyEntities,reconcileReceiptHolds,allocatePurchaseReceipt} from './sourcing';

export const procurementDecisionModes=['request_exception','decide_exception','complete_exception','review_urgent_finance','resolve_purchase_receipt','accept_receipt_concession'] as const;
import {exceptionKinds} from './procurement-decision-labels';
export function blockingException(plan:any,partCode:string){return (plan.data.exceptions||[]).find((x:any)=>x.kind==='unforeseen'&&x.partCode===partCode&&['pending','assigned','development'].includes(x.state));}
export function purchaseException(plan:any,q:any){return (plan.data.exceptions||[]).find((x:any)=>x.state==='approved'&&!x.usedBy&&['urgent','sole_source','contract'].includes(x.kind)&&x.quoteId===q.id&&x.quoteRevision===q.revision);}
export function validQuoteCount(quotes:any[],line:any,today:string){return new Set(quotes.filter(q=>!q.data.unavailable&&q.data.round===line.round&&q.data.partCode===line.partCode&&q.data.quantity>0&&q.data.quantity<=line.shortage&&(q.data.commercialVersion!==3||q.data.costsComplete)&&q.data.technical==='pass'&&q.data.validUntil>=today&&!q.data.supplierBlock&&q.data.supplierId).map(q=>q.data.supplierId)).size;}

/** Decisions never execute arbitrary text or bypass technical, stock or payment guards. */
export async function applyProcurementDecision(c:any){
 const {b,u,plan,now,get,put,enforceOwner,statements,db,guard}=c,d=plan.data;
 const fail=(s:string,status=400):never=>{throw new AccessError(s,status)};
 if(b.confirmed!==true)fail('تأیید صریح اقدام لازم است.');
 const notes=required(b.notes,4000),stamp={actor:u.userId,name:u.name,at:now,notes};
 if(b.mode==='resolve_purchase_receipt'||b.mode==='accept_receipt_concession'){
  const r=await get(required(b.receiptId,200),'receipt'),oldOrder=await get(r.data.purchaseOrderId||r.data.purchaseHold?.orderId,'purchase_order');
  if(oldOrder.data.planId!==plan.id||r.revision!==b.receiptRevision||!['pending_qc','awaiting_qc_template','awaiting_warehouse','awaiting_relabel','rejected'].includes(r.data.state))fail('رسید جاری و هنوز مصرف‌نشده همین پرونده لازم است.',409);
  if(b.mode==='accept_receipt_concession'){
   needSupply(u,'engineering');await enforceOwner('engineering');
   const amount=Number(b.quantity)*1000;
   if(!r.data.qc||!Number.isSafeInteger(amount)||amount<=0||amount>r.data.rejected||(r.data.supplierReturns||[]).length)fail('مقدار پذیرش باید در محدوده مردودیِ هنوز مرجوع‌نشده باشد.');
   if((await supplyEntities('receipt')).some(x=>x.data.replacementFor===r.id))fail('برای این مردودی دریافت جایگزین ثبت شده؛ ابتدا تعیین تکلیف شود.',409);
   const accepted=r.data.accepted+amount,rejected=r.data.rejected-amount;
   const batch:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='batch'").bind(r.data.batchId).first();if(!batch)fail('بچ رسید پیدا نشد.',409);
   guard('EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?)',r.data.batchId,batch.payload);
   statements.push(db.prepare('UPDATE records SET payload=? WHERE id=?').bind(JSON.stringify({...JSON.parse(batch.payload),status:'تأیید',concession:stamp}),r.data.batchId));
   if(!r.data.purchaseHold)statements.push(...await reconcileReceiptHolds(r.data.batchId,accepted,r.data.purchaseOrderId));
   put(r.id,'receipt',{...r.data,accepted,rejected,state:r.data.relabelRequired?'awaiting_relabel':'awaiting_warehouse',concessions:[...(r.data.concessions||[]),{...stamp,quantity:amount,originalQC:r.data.qc}]},r);
  }else{
   needSupply(u,oldOrder.data.route);await enforceOwner(oldOrder.data.route);
   if(!r.data.purchaseHold)fail('این رسید توقف خرید ندارد.',409);
   const o=await get(required(b.orderId),'purchase_order');
   if(o.revision!==b.orderRevision||!['issued','paid','preparing','shipped'].includes(o.data.state)||o.data.materialId!==r.data.materialId||o.data.supplierId!==oldOrder.data.supplierId||o.data.route!==oldOrder.data.route||o.data.pendingSupplierCredit||o.data.urgentFinance?.state==='pending'||o.data.urgentFinance?.state==='fail')fail('سفارش صادرشده منطبق با کالای واقعی و کنترل مالی تکمیل‌شده لازم است.',409);
   const received=(await supplyEntities('receipt')).filter(x=>x.id!==r.id&&x.data.purchaseOrderId===o.id).reduce((n,x)=>n+x.data.quantity,0);
   if(received+r.data.quantity>o.data.quantity)fail('مقدار رسید از مانده سفارش مصوب بیشتر است؛ ابتدا خرید اضافه و کنترل مالی آن تکمیل شود.',409);
   statements.push(...await reconcileReceiptHolds(r.data.batchId,0,r.data.purchaseOrderId),...await allocatePurchaseReceipt(o.id,r.data.batchId,r.data.qc?r.data.accepted:r.data.quantity));
   put(r.id,'receipt',{...r.data,purchaseHold:null,purchaseOrderId:o.id,purchaseResolution:{...stamp,originalOrderId:oldOrder.id,approvedOrderId:o.id,orderRevision:o.revision}},r);
  }
  return;
 }
 if(b.mode==='review_urgent_finance'){
  needSupply(u,'finance');await enforceOwner('finance');const o=await get(required(b.orderId),'purchase_order');
  if(o.data.planId!==plan.id||o.revision!==b.orderRevision||o.data.urgentFinance?.state!=='pending')fail('بررسی مالی باز و نسخه جاری سفارش لازم است.',409);
  if(!['pass','fail'].includes(b.result))fail('نتیجه بررسی را انتخاب کنید.');
  put(o.id,'purchase_order',{...o.data,urgentFinance:{state:b.result,...stamp},history:[...(o.data.history||[]),{stage:b.mode,result:b.result,...stamp}]},o);
  if(b.result==='fail'){
   d.exceptions=[...(d.exceptions||[]),{id:b.id,kind:'unforeseen',partCode:o.data.partCode,orderId:o.id,title:'مغایرت مالی خرید فوری',notes,state:'pending',created:stamp,history:[stamp]}];
  }
  return;
 }
 d.exceptions||=[];
 if(b.mode==='request_exception'){
  if(!['domestic','foreign','commerce_manager','finance','inventory','engineering','ceo'].some(r=>hasSupply(u,r)))fail('دسترسی ثبت مسئله تأمین ندارید.',403);
  if(d.exceptions.length>=100)fail('ظرفیت پیگیری این پرونده تکمیل شده است.');
  if(!Object.hasOwn(exceptionKinds,b.kind))fail('نوع درخواست معتبر نیست.');
  const line=d.lines?.find((l:any)=>l.partCode===b.partCode);if(!line)fail('ردیف مرتبط را انتخاب کنید.');
  let quote:any=null;if(b.kind!=='unforeseen'){
   quote=await get(required(b.quoteId),'sourcing_quote');
   if(quote.data.planId!==plan.id||quote.data.partCode!==line.partCode||quote.data.round!==line.round||quote.revision!==b.quoteRevision||quote.data.unavailable)fail('پیشنهاد جاری همین ردیف لازم است.',409);
   if(!hasSupply(u,'commerce_manager')&&!hasSupply(u,quote.data.route))fail('دسترسی این مسیر تأمین را ندارید.',403);
  }
  if(d.exceptions.some((x:any)=>x.partCode===line.partCode&&x.kind===b.kind&&['pending','assigned','development'].includes(x.state)))fail('برای همین ردیف و موضوع، درخواست باز وجود دارد.',409);
  d.exceptions.push({id:b.id,kind:b.kind,partCode:line.partCode,title:required(b.title,180),notes,evidence:required(b.evidence,3000),state:'pending',...(quote?{quoteId:quote.id,quoteRevision:quote.revision,quoteSnapshot:quote.data}:{}),created:stamp,history:[stamp]});return;
 }
 const x=d.exceptions.find((x:any)=>x.id===b.exceptionId);if(!x)fail('درخواست تصمیم پیدا نشد.',404);
 if(b.mode==='complete_exception'){
  if(x.state!=='assigned')fail('ابتدا تصمیم و مسئول اجرای آن مشخص شود.',409);
  needSupply(u,x.ownerRole);await enforceOwner(x.ownerRole);
  if(x.orderId){const o=await get(x.orderId,'purchase_order');if(o.data.urgentFinance?.state==='fail')put(o.id,'purchase_order',{...o.data,urgentFinance:{state:'pending',previousReview:o.data.urgentFinance,resolution:stamp}},o);}
  x.state='completed';x.result=stamp;x.history.push(stamp);return;
 }
 needSupply(u,'ceo');await enforceOwner('ceo');
 if(!['pending','development'].includes(x.state))fail('درخواست منتظر تصمیم نیست.',409);
 if(b.decision==='development'){
  if(x.kind!=='unforeseen'||x.developmentId)fail('درخواست توسعه برای این مورد قابل ثبت نیست.',409);
  const developmentId=b.id;
  put(developmentId,'development_request',{owner:await memberId(u)||u.userId,requester:u.name,unit:'مدیریت',source:'direct',kind:'improvement',state:'new',adminAttention:true,requesterAttention:false,title:x.title,section:'تأمین',problem:x.notes,desired:notes,impact:'رفع توقف ردیف '+x.partCode,example:'پرونده تأمین: '+plan.id+'؛ تصمیم: '+x.id+'؛ مدارک: '+x.evidence,sourcePlanId:plan.id,sourceExceptionId:x.id,history:[]});
  x.developmentId=developmentId;x.state='development';
 }else if(b.decision==='reject'){x.state='rejected';}
 else if(b.decision==='approve'&&x.kind!=='unforeseen'){
  const q=await get(x.quoteId,'sourcing_quote');if(q.revision!==x.quoteRevision)fail('استعلام تغییر کرده؛ درخواست مجوز جدید لازم است.',409);x.state='approved';
 }else if(b.decision==='assign'&&x.kind==='unforeseen'){
  if(!['domestic','foreign','commerce_manager','finance','inventory','engineering'].includes(b.ownerRole))fail('نقش مسئول اجرا را انتخاب کنید.');
  x.ownerRole=b.ownerRole;x.state='assigned';
 }else fail('تصمیم برای این نوع درخواست معتبر نیست.');
 x.decision=stamp;x.history.push({...stamp,decision:b.decision,state:x.state});
}
