import {apView,active,applied} from './purchase-payables';
import {moneyMicro,moneyText} from './costing';
import {storage} from './storage';
import {trainingContext} from './training-context';

// A projection of existing obligations, never another payable or another payment.
export function purchaseObligations(rows:any[]){
 const result:any[]=[];
 for(const c of rows.filter(r=>r.type==='purchase_shipment'&&r.data.route==='foreign'&&r.data.foreign?.order)){
  const f=c.data.foreign;const total:bigint=c.data.initial.lines.reduce((n:bigint,l:any)=>n+moneyMicro(l.unitPrice)*moneyMicro(l.quantity)/BigInt(1000000),BigInt(0)),paid:bigint=(f.prepayments||[]).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0));
  if(total<=paid)continue;
  const source={key:c.id+':foreign',caseId:c.id,itemId:c.id,kind:'foreign',title:c.data.supplierName+' — خرید خارجی'};
  result.push({...source,source,party:c.data.supplierName,currency:c.data.currency,amount:moneyText(total-paid),due:'',needsDue:true,condition:'پرداخت طبق سفارش خارجی',destination:'',referenceDocument:f.order.reference,createdBy:c.data.createdBy||'system:purchase',basis:JSON.stringify({supplierId:c.data.supplierId,currency:c.data.currency,initial:c.data.initial,order:f.order}),blockers:[]});
 }
 for(const c of rows.filter(r=>r.type==='purchase_payable'&&!r.data.completion)){
  const v=apView(c.data,rows);
  for(const a of c.data.adjustments||[]){const paid=(a.movements||[]).reduce((n:bigint,m:any)=>n+moneyMicro(m.amount),BigInt(0)),remaining=moneyMicro(a.amount)-paid;if(remaining<=BigInt(0)||!a.approved)continue;const kind=a.kind==='claim'?'refund':'adjustment',source={key:c.id+':adjustment:'+a.id,caseId:c.id,itemId:a.id,kind,title:c.data.supplier+' — '+(kind==='refund'?'برگشت وجه خرید':'مابه‌التفاوت جایگزین')};result.push({...source,source,party:c.data.supplier,currency:'IRR',direction:kind==='refund'?'in':'out',amount:moneyText(remaining),due:a.due,needsDue:!a.due,condition:'تعیین تکلیف مصوب برگشت یا تعویض',destination:c.data.destination||'',referenceDocument:a.reference,createdBy:a.approved.actor,basis:JSON.stringify({supplierId:c.data.supplierId,adjustment:{...a,movements:undefined}}),blockers:[]});}

  const add=(i:any,q:any,kind:string,blockers:string[])=>{
   if(i.paymentHold)blockers.push('مالی پرداخت این تعهد را متوقف کرده است');
   const source={key:kind==='advance'?c.id+':'+i.id:c.id+':'+i.id+':'+q.id,caseId:c.id,itemId:i.id,...(kind==='invoice'?{installmentId:q.id}:{}),kind,title:c.data.supplier+' — '+(kind==='advance'?'پیش‌پرداخت':i.reference)};
   const previous=(c.data.paymentRequests||[]).find((r:any)=>r.instrumentId===i.id&&r.state!=='paid');
   const orderIds=kind==='advance'?[i.orderId].filter(Boolean):i.lines.map((l:any)=>l.orderId).filter(Boolean);
   const orders=orderIds.map((id:string)=>rows.find(r=>r.id===id&&r.type==='purchase_order'));
   if(orders.some((o:any)=>!o||o.data.state==='cancelled'))blockers.push('سفارش نامعتبر یا لغوشده');
   if(orders.some((o:any)=>o?.data.urgentFinance?.state==='pending'))blockers.push('بررسی مالی خرید فوری هنوز باز است');
   if(orders.some((o:any)=>o?.data.termsAmendment&&o.data.termsAmendment.state!=='approved'))blockers.push('اصلاح شرایط خرید هنوز تأیید نشده است');
   const destination=previous?.account||i.destination||c.data.destination||'';
   const basis=JSON.stringify({supplierId:c.data.supplierId,kind,paymentHoldVersion:i.paymentHoldVersion,contractDays:i.contractDays,amount:i.amount,due:q.due,condition:q.condition,lines:i.lines,schedule:i.schedule,documentId:i.documentId,evidence:i.evidence,recognition:i.recognition,dispute:i.dispute,destination,orders:orders.map((o:any)=>o?{id:o.id,supplierId:o.data.supplierId,quantity:o.data.quantity,price:o.data.price,paymentTerms:o.data.paymentTerms,paymentStages:o.data.quoteSnapshot?.paymentStages||o.data.paymentStages,financial:o.data.quoteSnapshot?.financial||o.data.financial}:null)});
   result.push({...source,source,party:c.data.supplier,amount:q.remaining,due:q.due,needsDue:!!(i.needsDue||q.needsDue),condition:q.condition,destination,referenceDocument:i.documentId||i.evidence||i.reference||c.id,createdBy:previous?.request?.actor||i.actor||c.data.history?.[0]?.actor||'system:purchase',basis,blockers:[...new Set(blockers)],legacyRequestId:previous?.id||''});
  };
  for(const i of v.invoices)for(const q of i.queue)if(moneyMicro(q.remaining)>BigInt(0))add(i,q,'invoice',[...i.blockers]);
  for(const a of v.advances)if(!a.closed&&moneyMicro(a.remaining)>BigInt(0))add(a,a,'advance',v.issues.length?['مدرک یا پیگیری باز']:[]);
 }
 return result;
}

export function purchaseGate(request:any,rows:any[],today:string){
 if(!request.data.source)return {blockers:[] as string[],source:null};
 const s=purchaseObligations(rows).find(s=>s.key===request.data.source.key);
 if(!s)return {blockers:['تعهد خرید بسته، تسویه یا لغو شده است'],source:null};
 const blockers=[...s.blockers];
 if(s.needsDue&&!request.data.confirmedPurchaseDue)blockers.push('مبدأ و سررسید شرط قراردادی باید در بررسی مالی مشخص شود');
 if(request.data.confirmedPurchaseDue>today)blockers.push('سررسید پرداخت نرسیده است');
 if(s.due>today)blockers.push('سررسید پرداخت نرسیده است');
 if(request.data.purchaseBasis&&request.data.purchaseBasis!==s.basis)blockers.push('شرایط خرید تغییر کرده؛ بازبینی مالی لازم است');
 return {blockers,source:s};
}

// Bounded keyset batches; an existing source link is reused, including legacy requests.
export async function syncPurchaseTreasury(){
 if(trainingContext.getStore())return;
 await syncOrderPaymentTerms();
 await syncForeignObligations();
 const db=storage();let after='';
 for(;;){
  const page=(await db.prepare("SELECT * FROM flow_entities WHERE type='purchase_payable' AND id>? AND json_extract(data,'$.completion') IS NULL ORDER BY id LIMIT 50").bind(after).all()).results as any[];
  if(!page.length)break;
  for(const raw of page){
   const c={...raw,data:JSON.parse(raw.data)},ids=new Set<string>();
   for(const i of c.data.invoices||[])for(const l of i.lines||[]){if(l.orderId)ids.add(l.orderId);if(l.serviceId)ids.add(l.serviceId);for(const id of l.receiptIds||[])ids.add(id);}
   for(const a of c.data.advances||[]){if(a.orderId)ids.add(a.orderId);if(a.serviceId)ids.add(a.serviceId);}
   for(const i of c.data.invoices||[])if(i.documentId)ids.add(i.documentId);
   const related:any[]=[];
   for(const id of ids){const r:any=await db.prepare('SELECT * FROM flow_entities WHERE id=?').bind(id).first();if(r)related.push({...r,data:JSON.parse(r.data)});}
   const existing=(await db.prepare("SELECT * FROM flow_entities WHERE type='treasury_request' AND json_extract(data,'$.source.caseId')=? ORDER BY id").bind(c.id).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
   const writes:any[]=[],now=new Date().toISOString();
   for(const s of purchaseObligations([c,...related])){
    if(existing.some(r=>r.data.source.key===s.key))continue;
    const id=crypto.randomUUID(),data={title:s.title,party:s.party,destination:s.destination||existing.find(r=>r.data.destination)?.data.destination||'',currency:'IRR',direction:s.direction||'out',category:'purchase',amount:s.amount,due:s.due,source:s.source,referenceDocument:s.referenceDocument,state:'review',createdBy:s.createdBy,automaticPurchase:true,history:[{mode:'purchase_sync',actor:'system:purchase',at:now,notes:'تعهد از پرونده خرید؛ بدون ورود مجدد اطلاعات'}]};
    writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'treasury_request',?,1,?,?)").bind(id,JSON.stringify(data),now,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'system:purchase',id,'purchase_treasury_created',JSON.stringify(data),now));
   }
   if(writes.length){const op=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'purchase_treasury_sync',?,'system:purchase',?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND (SELECT COUNT(*) FROM flow_entities WHERE type='treasury_request' AND json_extract(data,'$.source.caseId')=?)=? THEN 1 ELSE 0 END)").bind(op,JSON.stringify({caseId:c.id}),now,c.id,c.revision,c.id,existing.length),...writes]);}
  }
  after=page[page.length-1].id;
 }
}

async function syncForeignObligations(){
 const db=storage();let after='';
 for(;;){const page=(await db.prepare("SELECT * FROM flow_entities WHERE type='purchase_shipment' AND id>? AND json_extract(data,'$.route')='foreign' ORDER BY id LIMIT 50").bind(after).all()).results as any[];if(!page.length)break;
  for(const raw of page)for(const s of purchaseObligations([{...raw,data:JSON.parse(raw.data)}])){
   const existing:any=await db.prepare("SELECT id FROM flow_entities WHERE type='treasury_request' AND json_extract(data,'$.source.key')=? LIMIT 1").bind(s.key).first();if(existing)continue;
   const id=crypto.randomUUID(),now=new Date().toISOString(),data={title:s.title,party:s.party,destination:'',currency:s.currency,direction:'out',category:'purchase',amount:s.amount,due:'',source:s.source,referenceDocument:s.referenceDocument,state:'review',createdBy:s.createdBy,automaticPurchase:true,history:[{mode:'purchase_sync',actor:'system:purchase',at:now,notes:'تعهد همان خرید خارجی بدون ثبت مجدد'}]},op=crypto.randomUUID();
   await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'purchase_treasury_sync',?,'system:purchase',?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='treasury_request' AND json_extract(data,'$.source.key')=?) THEN 1 ELSE 0 END)").bind(op,JSON.stringify({shipmentId:raw.id}),now,raw.id,raw.revision,s.key),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'treasury_request',?,1,?,?)").bind(id,JSON.stringify(data),now,now)]);
  }after=page[page.length-1].id;
 }
}

// Terms are copied once from the approved source. Free-text conditions are retained
// for finance attestation; no text classifier pretends to establish fulfilment.
async function syncOrderPaymentTerms(){
 const db=storage();let after='';
 for(;;){
  const page=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('purchase_order','subcontract_order') AND id>? ORDER BY id LIMIT 50").bind(after).all()).results as any[];if(!page.length)break;
  for(const raw of page){
   const d=JSON.parse(raw.data),sub=raw.type==='subcontract_order';
   if(sub?!d.financial||!d.caseId:!d.paymentWorkflowRequired||!['issued','paid','preparing','shipped','closed'].includes(d.state))continue;
   const q=sub?d.quotes?.find((q:any)=>q.id===d.selection?.quoteId):d.quoteSnapshot;
   if(!q)continue;
   const stages=q.paymentStages||((Number(d.requiredAdvanceRial||q.requiredAdvanceRial)>0)?[{amountRial:d.requiredAdvanceRial||q.requiredAdvanceRial,condition:'پیش‌پرداخت مصوب سفارش',days:0}]:[]);
   if(!stages.length)continue;
   const existing:any=await db.prepare("SELECT * FROM flow_entities WHERE type='purchase_payable' AND (id=? OR EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.advances')) a WHERE json_extract(a.value,'$.orderId')=?) OR EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.invoices')) i,json_each(json_extract(i.value,'$.lines')) l WHERE json_extract(l.value,'$.orderId')=?)) ORDER BY id LIMIT 1").bind(sub?d.caseId:'order-payable:'+raw.id,raw.id,raw.id).first();
   const cid=existing?.id||(sub?d.caseId:'order-payable:'+raw.id),now=new Date().toISOString();
   const c=existing?JSON.parse(existing.data):{supplierId:d.supplierId,supplier:d.supplier,route:d.route,title:'خرید '+(d.partCode||raw.id),invoices:[],payments:[],allocations:[],advances:[],issues:[],history:[]};
   if(c.completion)continue;
   const instrumentMatches=(a:any)=>sub?a.serviceId===d.serviceId:a.orderId===raw.id;
   const invoices=active(c.invoices).filter((i:any)=>i.lines.some((l:any)=>sub?l.serviceId===d.serviceId:l.orderId===raw.id));
   let changed=false;
   if(invoices.length){
    for(const i of invoices.filter((i:any)=>i.lines.length===1&&!i.schedule?.length)){
     const total=moneyMicro(i.amount),stageTotal:bigint=stages.reduce((n:bigint,s:any)=>n+moneyMicro(s.amountRial),BigInt(0));let used=BigInt(0);
     if(stageTotal>BigInt(0)){
      const known=(await db.prepare("SELECT data FROM flow_entities WHERE type='treasury_request' AND json_extract(data,'$.source.caseId')=?").bind(cid).all()).results.map((x:any)=>JSON.parse(x.data));
      i.schedule=stages.map((s:any,index:number)=>{const amount=index===stages.length-1?total-used:total*moneyMicro(s.amountRial)/stageTotal;used+=amount;const prior=known.find((t:any)=>t.source?.itemId==='contract-stage:'+raw.id+':'+index);return {id:'contract-invoice:'+i.id+':'+index,amount:moneyText(amount),condition:s.condition,due:prior?.confirmedPurchaseDue||'',needsDue:!prior?.confirmedPurchaseDue};});changed=true;
     }
    }
    for(const a of active(c.advances).filter((a:any)=>a.contractStage&&instrumentMatches(a)&&!a.closed)){a.closed={actor:'system:purchase',at:now,notes:'ادامه تعهد از فاکتور مرتبط؛ جلوگیری از تعهد تکراری'};changed=true;}
    for(const p of active(c.payments).filter((p:any)=>active(c.advances).some((a:any)=>a.contractStage&&a.id===p.advanceId&&instrumentMatches(a))))for(const i of invoices.filter((i:any)=>i.recognition)){
     const free=moneyMicro(p.amount)-applied(c,'paymentId',p.id),rest=moneyMicro(i.amount)-applied(c,'invoiceId',i.id),n=free<rest?free:rest;
     if(n>BigInt(0)){c.allocations.push({id:crypto.randomUUID(),invoiceId:i.id,paymentId:p.id,amount:moneyText(n),actor:'system:purchase',at:now,notes:'تخصیص خودکار پرداخت همان سفارش به فاکتور',automatic:true});changed=true;}
    }
   }else if(!active(c.advances).some(instrumentMatches)){
    for(const [index,s] of stages.entries())c.advances.push({id:'contract-stage:'+raw.id+':'+index,orderId:sub?'':raw.id,serviceId:sub?d.serviceId:'',amount:s.amountRial,condition:s.condition,due:'',needsDue:true,contractStage:true,contractDays:s.days,evidence:'شرایط مصوب '+raw.id,release:null,actor:sub?d.financial.actor:d.selectedBy,at:now});changed=true;
   }else{
    for(const a of active(c.advances).filter((a:any)=>a.contractStage&&instrumentMatches(a)&&!a.closed)){
     const stage=stages[Number(a.id.split(':').at(-1))];
     if(!stage){if(!a.paymentHold){a.paymentHold={actor:'system:purchase',at:now,notes:'مرحله در شرایط جدید وجود ندارد؛ تعیین تکلیف مالی لازم است'};changed=true;}continue;}
     if(a.amount!==stage.amountRial||a.condition!==stage.condition||a.contractDays!==stage.days){
      const paid=active(c.payments).filter((p:any)=>p.advanceId===a.id).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0));
      a.previousTerms=[...(a.previousTerms||[]),{amount:a.amount,condition:a.condition,days:a.contractDays,at:now}];
      if(paid>moneyMicro(stage.amountRial))a.paymentHold={actor:'system:purchase',at:now,notes:'پرداخت قبلی از مبلغ اصلاح‌شده بیشتر است؛ تعیین تکلیف مالی لازم است'};
      else{a.amount=stage.amountRial;a.condition=stage.condition;a.contractDays=stage.days;}changed=true;
     }
    }
   }
   if(!changed)continue;
   c.history.push({mode:'contract_treasury_terms',actor:'system:purchase',at:now,notes:'اتصال شرایط مصوب و حفظ یک مانده پرداخت',orderId:raw.id});
   const op=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'contract_treasury_terms',?,'system:purchase',?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=? THEN 1 ELSE 0 END)").bind(op,JSON.stringify({orderId:raw.id}),now,raw.id,raw.revision,cid,existing?.revision||0),existing?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify(c),now,cid):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'purchase_payable',?,1,?,?)").bind(cid,JSON.stringify(c),now,now)]);
  }
  after=page[page.length-1].id;
 }
}

export function purchasePaymentStatus(rows:any[],caseId:string){
 const statements=rows.filter(r=>r.type==='treasury_statement');
 return rows.filter(r=>r.type==='treasury_request'&&r.data.source?.caseId===caseId).map(r=>{
  const payments=rows.filter(m=>m.type==='treasury_movement'&&m.data.requestId===r.id);
  const paid=payments.reduce((n,m)=>n+moneyMicro(m.data.amount),BigInt(0));
  return {id:r.id,state:r.data.state,due:r.data.due,title:r.data.title,amount:r.data.amount,paid:moneyText(paid),matched:payments.length>0&&payments.every(m=>statements.some(s=>s.data.rows.some((x:any)=>x.match?.movementId===m.id))),payments:payments.map(m=>({id:m.id,amount:m.data.amount,day:m.data.day,reference:m.data.reference}))};
 });
}
