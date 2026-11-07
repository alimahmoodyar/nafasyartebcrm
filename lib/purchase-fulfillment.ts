import {storage} from './storage';
import {needsPurchaseConfirmation} from './sourcing-delivery';
import {orderDelivery,orderFinancialSummary} from './sourcing-workflow';
import {currentRemainderResolution} from './sourcing-workflow';
import {moneyMicro,moneyText} from './costing';
const active=(a:any[]=[])=>a.filter(x=>!x.voided);
export const serviceStates:Record<string,string>={open:'منتظر تحویل',submitted:'خروجی ارائه‌شده؛ منتظر تأیید دریافت',returned:'نیازمند اصلاح خروجی',accepted:'دریافت خدمت تأییدشده'};
export function serviceCosts(rows:any[],kind:string,targetId:string){return rows.filter(r=>r.type==='purchase_service'&&r.data.state==='accepted'&&r.data.costApproval).flatMap(r=>(r.data.costs||[]).filter((a:any)=>a.kind===kind&&a.targetId===targetId).map((a:any)=>({serviceId:r.id,caseId:r.data.caseId,title:r.data.title,amount:a.amount,approval:r.data.costApproval.at,key:r.id+':'+kind+':'+targetId})));}
export function serviceSummary(s:any,rows:any[]){const c=rows.find(r=>r.id===s.data.caseId&&r.type==='purchase_payable'),invoices=active(c?.data.invoices).filter((i:any)=>i.lines.some((l:any)=>l.serviceId===s.id));const billed=invoices.reduce((n:bigint,i:any)=>n+moneyMicro(i.amount),BigInt(0)),allocatedPaid=active(c?.data.allocations).filter((a:any)=>invoices.some((i:any)=>i.id===a.invoiceId)).reduce((n:bigint,a:any)=>n+moneyMicro(a.amount),BigInt(0));
 const unallocated=active(c?.data.payments).filter((p:any)=>p.serviceId===s.id||active(c?.data.advances).some((a:any)=>a.id===p.advanceId&&a.serviceId===s.id)).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount)-active(c?.data.allocations).filter((a:any)=>a.paymentId===p.id).reduce((v:bigint,a:any)=>v+moneyMicro(a.amount),BigInt(0)),BigInt(0)),paid=allocatedPaid+unallocated;
 const costIssues=(s.data.costs||[]).flatMap((a:any)=>{const target=rows.find(r=>r.id===a.targetId);if(!target)return ['مقصد هزینه در دسترس نیست'];if(a.kind==='receipt'){const price=rows.find(r=>r.type==='cost_price'&&r.data.batchId===target.data.batchId);if(target.data.state!=='stored'||!price?.data.serviceCosts?.some((x:any)=>x.serviceId===s.id&&x.amount===a.amount&&x.approval===s.data.costApproval?.at))return ['دریافت کالا یا ثبت سهم خدمت در بهای بچ کامل نیست'];}return [];});
 const blockers=[...(s.data.state!=='accepted'?['دریافت خدمت تأیید نشده']:[]),...(!s.data.costApproval?['تخصیص هزینه تأیید نشده']:[]),...(billed!==moneyMicro(s.data.amount)?['فاکتورهای خدمت با مبلغ تعهد برابر نیست']:[]),...(allocatedPaid!==billed||!billed||unallocated>BigInt(0)?['تسویه مالی خدمت کامل نیست']:[]),...costIssues];
 return {unallocated:moneyText(unallocated),allocatedPaid:moneyText(allocatedPaid),billed:moneyText(billed),paid:moneyText(paid),remaining:moneyText(moneyMicro(s.data.amount)-paid),delivery:serviceStates[s.data.state],cost:s.data.costApproval?'تخصیص تأییدشده':'تخصیص ناقص',blockers:[...new Set(blockers)],complete:!blockers.length,overdue:s.data.state!=='accepted'&&s.data.due<new Date().toISOString().slice(0,10)};}
export function purchaseCompletion(c:any,rows:any[]){const d=c.data,delivery:string[]=[],cost:string[]=[],financial:string[]=[];const invoices=active(d.invoices),payments=active(d.payments),allocations=active(d.allocations);
 if(!invoices.length){financial.push('فاکتور خرید ثبت نشده');if(!rows.some(r=>r.type==='purchase_service'&&r.data.caseId===c.id)){delivery.push('کالا یا خدمت مرتبط با پرداخت هنوز مشخص نشده');cost.push('مقصد هزینه هنوز مشخص نشده');}}
 for(const i of invoices){const paid=[...allocations,...(d.creditOffsets||[])].filter((a:any)=>a.invoiceId===i.id).reduce((n:bigint,a:any)=>n+moneyMicro(a.amount),BigInt(0));if(!i.recognition||paid!==moneyMicro(i.amount))financial.push('بدهی یا تسویه فاکتور '+i.reference+' کامل نیست');
 for(const l of i.lines){if(l.serviceId){const s=rows.find(r=>r.id===l.serviceId&&r.type==='purchase_service');if(!s||s.data.state!=='accepted')delivery.push('خدمت فاکتور '+i.reference+' تأیید دریافت ندارد');if(!s?.data.costApproval)cost.push('تخصیص هزینه خدمت '+i.reference+' کامل نیست');continue;}
 const rs=l.receiptIds.map((id:string)=>rows.find(r=>r.id===id&&r.type==='receipt'));const accepted=rs.reduce((n:number,r:any)=>n+(r?.data.accepted||0),0);if(!rs.length||rs.some((r:any)=>!r||r.data.state!=='stored')||accepted!==l.quantity||rs.some((r:any)=>r.data.rejected)&&!currentRemainderResolution(rows.find(o=>o.type==='purchase_order'&&o.id===l.orderId),rows))delivery.push('تعداد / کیفیت / جانمایی فاکتور '+i.reference+' کامل نیست');
 for(const r of rs.filter(Boolean)){const st=rows.find(x=>x.type==='purchase_settlement'&&x.data.state==='approved'&&x.data.lines.some((v:any)=>v.receiptId===r.id));const priced=rows.find(x=>x.type==='cost_price'&&x.data.batchId===r.data.batchId);if(!st||priced?.data.settlementId!==st.id||priced?.data.settlementRevision!==st.revision||st.data.approvals?.at(-1)?.preview?.lines.find((x:any)=>x.receiptId===r.id)?.receiptRevision!==r.revision)cost.push('بهای نهایی بچ '+r.id+' تأیید نشده یا نیازمند بازبینی است');}
 }}
 for(const p of payments)if(allocations.filter((a:any)=>a.paymentId===p.id).reduce((n:bigint,a:any)=>n+moneyMicro(a.amount),BigInt(0))!==moneyMicro(p.amount))financial.push('پرداخت تخصیص‌نیافته: '+p.reference);
 if(active(d.advances).some((a:any)=>!a.closed))financial.push('برنامه پیش‌پرداخت باز است');
 if(active(d.issues).some((a:any)=>a.state!=='resolved'))delivery.push('نقص باز وجود دارد');
 const services=rows.filter(r=>r.type==='purchase_service'&&r.data.caseId===c.id);for(const s of services){if(s.data.state!=='accepted')delivery.push('دریافت خدمت '+s.data.title+' تأیید نشده');const v=serviceSummary(s,rows);if(!v.complete)cost.push(...v.blockers.map(b=>s.data.title+': '+b));}
 const receiptIds=new Set(invoices.flatMap((i:any)=>i.lines.flatMap((l:any)=>l.receiptIds||[])));for(const s of rows.filter(r=>r.type==='purchase_service'&&(r.data.costs||[]).some((a:any)=>a.kind==='receipt'&&receiptIds.has(a.targetId)))){const v=serviceSummary(s,rows);if(!v.complete)cost.push('خدمت وابسته '+s.data.title+': '+v.blockers.join(' / '));}
 const blockers=[...new Set([...delivery,...cost,...financial])];return {delivery:[...new Set(delivery)],cost:[...new Set(cost)],financial:[...new Set(financial)],blockers,ready:!blockers.length,closed:!!d.completion&&!blockers.length,stale:!!d.completion&&!!blockers.length};}

export function purchaseOrderCanAutoClose(order:any,rows:any[]){
 try{
 const data=order.data;
 if(data.pendingSupplierCredit||!['issued','paid','preparing','shipped'].includes(data.state)||needsPurchaseConfirmation(data)||!data.totalRial||moneyMicro(data.totalRial)<=BigInt(0))return false;
 const delivery=orderDelivery(order,rows.filter(r=>r.type==='receipt'));
 if(delivery.pending||delivery.remaining>0)return false;
 const financial=orderFinancialSummary(order,rows.filter(r=>r.type==='purchase_payable'));
 return moneyMicro(financial.paidRial)===moneyMicro(data.totalRial)&&moneyMicro(financial.invoicedRial)===moneyMicro(data.totalRial)&&moneyMicro(financial.unallocatedRial)===BigInt(0);
 }catch{return false;}
}

/** Close only against a current warehouse and finance snapshot. */
export async function syncPurchaseOrderClosures(){
 const db=storage(),types="('purchase_order','receipt','purchase_payable')";
 const records=async()=>(await db.prepare('SELECT id,type,data,revision FROM flow_entities WHERE type IN '+types).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const snapshot=await records();
 for(const order of snapshot.filter(r=>r.type==='purchase_order'&&purchaseOrderCanAutoClose(r,snapshot))){
  const current=await records(),latest=current.find(r=>r.id===order.id);
  if(!latest||!purchaseOrderCanAutoClose(latest,current))continue;
  const now=new Date().toISOString(),id=crypto.randomUUID(),data={...latest.data,state:'closed',closedAt:now,closeNote:'تحویل و مانده پرداخت تکمیل شد.',history:[...(latest.data.history||[]),{stage:'auto_closed',actor:'workflow',at:now}]};
  const count=current.length,revisions=current.reduce((sum,r)=>sum+r.revision,0);
  try{await db.batch([
   db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'purchase_auto_close',?,'workflow',?,CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE type IN "+types+")=? AND (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type IN "+types+")=? THEN 1 ELSE 0 END)").bind(id,JSON.stringify({orderId:latest.id}),now,count,revisions),
   db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,latest.id,latest.revision),
   db.prepare("DELETE FROM sourcing_holds WHERE source_type='po' AND source_id=?").bind(latest.id),
   db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,'workflow',?,'purchase_auto_close',?,?)").bind(crypto.randomUUID(),latest.id,JSON.stringify({state:'closed',reason:data.closeNote}),now)
  ]);}catch(error){if(!/constraint|guard|RESET_MAINTENANCE/i.test(String(error)))throw error;}
 }
}
