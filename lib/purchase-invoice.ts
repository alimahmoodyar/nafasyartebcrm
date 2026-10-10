import {moneyMicro,moneyText} from './costing';
import {normalizeExpense} from './expense-register';
import {invoiceTaxStates} from './purchase-invoice-contract';
const active=(rows:any[]=[])=>rows.filter(r=>!r.voided);
const plusWeek=(day:string)=>new Date(Date.parse(day+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);
export function invoiceDocument(i:any,caseId:string,rows:any[]){return rows.find(f=>f.type==='payable_file'&&f.id===i.documentId&&f.data.caseId===caseId)||null;}
export function invoiceDocumentMissing(i:any,rows:any[],caseId?:string){
 const owner=caseId||rows.find(c=>c.type==='purchase_payable'&&c.data.invoices?.some((x:any)=>x.id===i.id))?.id;
 return !owner||!invoiceDocument(i,owner,rows);
}
/** No type is inferred for legacy records. Text references are not uploaded documents. */
export function invoiceFollowups(c:any,rows:any[],today:string){
 const payments=active(c.data.payments),allocations=active(c.data.allocations),invoices=active(c.data.invoices),out:any[]=[];
 for(const i of invoices){
  if(!invoiceDocumentMissing(i,rows,c.id))continue;
  const linked=allocations.filter(a=>a.invoiceId===i.id&&payments.some(p=>p.id===a.paymentId));
  const paid=linked.reduce((n,a)=>n+moneyMicro(a.amount),BigInt(0));if(paid<=BigInt(0))continue;
  const first=linked.map(a=>payments.find(p=>p.id===a.paymentId)!.day).sort()[0],due=plusWeek(first);
  if(due<=today)out.push({key:'invoice:'+i.id,caseId:c.id,invoiceId:i.id,reference:i.reference,supplier:c.data.supplier,route:c.data.route,paid:moneyText(paid),paymentDay:first,due,invoiceType:i.invoiceType||'unspecified',title:'پیگیری سند فاکتور پرداخت‌شده '+i.reference});
 }
 // Payment-first purchases also need follow-up; do not lose an alert merely because no invoice was entered.
 for(const p of payments){const used=allocations.filter(a=>a.paymentId===p.id&&invoices.some(i=>i.id===a.invoiceId)).reduce((n,a)=>n+moneyMicro(a.amount),BigInt(0)),remaining=moneyMicro(p.amount)-used,due=plusWeek(p.day);if(remaining>BigInt(0)&&due<=today)out.push({key:'payment:'+p.id,caseId:c.id,paymentId:p.id,reference:p.reference,supplier:c.data.supplier,route:c.data.route,paid:moneyText(remaining),paymentDay:p.day,due,invoiceType:'unspecified',title:'پیگیری فاکتور و سند پرداخت تخصیص‌نیافته '+p.reference});}
 return out;
}
export function formalInvoiceReport(cases:any[],rows:any[],q:URLSearchParams){
 const norm=(s:any)=>normalizeExpense(String(s||'')),supplier=norm(q.get('supplier')),product=norm(q.get('product')),reference=norm(q.get('reference')),from=q.get('from')||'',to=q.get('to')||'',state=q.get('state')||'';
 const results=cases.flatMap(c=>active(c.data.invoices).filter(i=>i.invoiceType==='formal').map(i=>{const f=invoiceDocument(i,c.id,rows),s=rows.find(r=>r.type==='supplier'&&r.id===c.data.supplierId),items=i.lines.map((l:any)=>{const o=rows.find(r=>r.id===l.orderId&&r.type==='purchase_order');const m=rows.find(r=>r.type==='material'&&(r.id===o?.data.materialId||r.data.code===o?.data.partCode));return [o?.data.partCode,m?.data.name,o?.data.partName,o?.data.name,o?.data.title].filter(Boolean).join(' · ')});return {caseId:c.id,revision:c.revision,invoiceId:i.id,supplier:s?.data.name||c.data.supplier,reference:i.reference,day:i.day,amount:i.amount,products:items,taxState:i.tax?.state||'awaiting_seller',taxId:i.tax?.taxId||'',taxRecordedAt:i.tax?.at||'',taxDay:i.tax?.day||'',taxNote:i.tax?.note||'',document:f?{id:f.id,filename:f.data.filename}:null};})).filter(i=>(!supplier||norm(i.supplier).includes(supplier))&&(!product||norm(i.products.join(' ')).includes(product))&&(!reference||norm(i.reference+' '+i.taxId).includes(reference))&&(!from||i.day>=from)&&(!to||i.day<=to)&&(!state||i.taxState===state)).sort((a,b)=>b.day.localeCompare(a.day)||a.invoiceId.localeCompare(b.invoiceId));
 const counts=Object.fromEntries(Object.keys(invoiceTaxStates).map(s=>[s,results.filter(r=>r.taxState===s).length])),offset=Number(q.get('offset')||0),limit=100;
 return {total:results.length,counts,items:results.slice(offset,offset+limit),nextOffset:offset+limit<results.length?offset+limit:null};
}
