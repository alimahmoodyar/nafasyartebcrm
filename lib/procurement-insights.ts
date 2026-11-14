import {orderFinancialSummary} from './sourcing-workflow';
import {moneyMicro,moneyText} from './costing';
import {storage} from './storage';
import {decode} from './sourcing';
import {deltaPercent} from './procurement-commercial';
/** Bounded history for one material/source; no unrelated finance exposed to drivers. */
export async function procurementInsights(q:any,materialId:string){
 const db=storage(),d=q.data;
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type='purchase_order' AND json_extract(data,'$.materialId')=? AND json_extract(data,'$.state') NOT IN ('cancelled','awaiting_funding') ORDER BY created DESC,id DESC LIMIT 40").bind(materialId).all()).results.map(decode);
 const comparable=rows.filter(o=>o.data.unit===d.unit&&o.data.quoteSnapshot?.specs===d.specs&&o.data.quoteSnapshot?.unitPrice);
 const history=comparable.slice(0,10).map(o=>({id:o.id,date:o.created,supplier:o.data.supplier,quantity:o.data.quantity,unit:o.data.unit,unitPrice:o.data.quoteSnapshot.unitPrice,currency:o.data.quoteSnapshot.currency,totalRial:o.data.totalRial,commercialVersion:o.data.quoteSnapshot.commercialVersion,paymentTerms:o.data.quoteSnapshot.paymentTerms}));
 const previous=comparable.find(o=>o.data.quoteSnapshot.currency===d.currency);
 const sameSupplier=comparable.find(o=>o.data.supplierId===d.supplierId);
 const supplierRows=(await db.prepare("SELECT * FROM flow_entities WHERE type='purchase_order' AND json_extract(data,'$.supplierId')=? AND json_extract(data,'$.state') NOT IN ('closed','cancelled') ORDER BY updated DESC LIMIT 40").bind(d.supplierId||'').all()).results.map(decode);
 const quality=(await db.prepare("SELECT * FROM flow_entities WHERE type='receipt' AND json_extract(data,'$.materialId')=? AND json_extract(data,'$.purchaseOrderId') IN (SELECT id FROM flow_entities WHERE type='purchase_order' AND json_extract(data,'$.supplierId')=?) ORDER BY created DESC LIMIT 40").bind(materialId,d.supplierId||'').all()).results.map(decode);
 const payables=(await db.prepare("SELECT data,id FROM flow_entities WHERE type='purchase_payable' AND json_extract(data,'$.supplierId')=? ORDER BY updated DESC LIMIT 40").bind(d.supplierId||'').all()).results.map((r:any)=>({id:r.id,data:JSON.parse(r.data)}));
 const taxIssues=payables.flatMap(c=>(c.data.invoices||[]).filter((i:any)=>!i.voided&&i.invoiceType==='formal'&&i.tax?.state!=='accepted').map((i:any)=>({caseId:c.id,invoiceId:i.id,state:i.tax?.state||'awaiting_seller',reference:i.reference})));
 const warnings:string[]=[];if(taxIssues.length)warnings.push('صورتحساب رسمی یا مؤدیان تعیین‌تکلیف‌نشده');
 if(supplierRows.some(o=>o.data.pendingSupplierCredit))warnings.push('طلب یا پیش‌پرداخت تعیین‌تکلیف‌نشده نزد فروشنده');
 if(quality.some(r=>r.data.purchaseHold))warnings.push('مغایرت خرید باز');
 if(quality.some(r=>r.data.rejected>(r.data.supplierReturns||[]).reduce((n:number,x:any)=>n+x.quantity,0)))warnings.push('سابقه مردودی همین کالا؛ نتیجه فنی را بررسی کنید');
 const advances=payables.flatMap(c=>(c.data.advances||[]).filter((a:any)=>!a.voided&&!a.closed).map((a:any)=>({caseId:c.id,id:a.id,amount:a.amount,orderId:a.orderId,paid:moneyText((c.data.payments||[]).filter((p:any)=>!p.voided&&p.advanceId===a.id).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0)))})));
 return {advances,taxIssues,history,previous:previous?{id:previous.id,unitPrice:previous.data.quoteSnapshot.unitPrice,currency:previous.data.quoteSnapshot.currency,date:previous.created,quantity:previous.data.quantity}:null,sameSupplier:sameSupplier?{id:sameSupplier.id,date:sameSupplier.created,unitPrice:sameSupplier.data.quoteSnapshot.unitPrice}:null,openOrders:supplierRows.map(o=>({id:o.id,supplier:o.data.supplier,quantity:o.data.quantity,state:o.data.state,totalRial:o.data.totalRial,financial:orderFinancialSummary(o,payables)})),quality:{sampleCount:quality.length,accepted:quality.reduce((n,r)=>n+(r.data.accepted||0),0),rejected:quality.reduce((n,r)=>n+(r.data.rejected||0),0)},warnings,limited:true};
}
