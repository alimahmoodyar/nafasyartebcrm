import {AccessError} from './authorization';
import {coverage,supplyEntities,needSupply,quantity,quoteCost} from './sourcing';
import {validQuoteCount} from './procurement-decisions';
import {checkPurchaseTechnical,checkSupplierPurchase} from './suppliers';
import {commercialTerms} from './procurement-commercial';
import {taskRequired as req,dayAt} from './duties';
export async function splitProcurement(c:any){
 const {b,u,plan,get,put,guard,now,db,statements}=c;needSupply(u,'commerce_manager');
 const fail=(s:string,status=400):never=>{throw new AccessError(s,status)};
 const line=(await coverage(plan)).find(l=>l.partCode===b.partCode);if(!line||line.shortage<=0||plan.data.state!=='sourcing')fail('ردیف نیاز باز لازم است.');
 const existing=(await supplyEntities('purchase_order')).some(o=>o.data.planId===plan.id&&o.data.partCode===line.partCode&&!['cancelled','closed'].includes(o.data.state));if(existing)fail('این ردیف سفارش فعال دارد.',409);
 const quotes=(await supplyEntities('sourcing_quote')).filter(q=>q.data.planId===plan.id&&q.data.partCode===line.partCode&&q.data.round===line.round);
 if(validQuoteCount(quotes,line,dayAt())<3)fail('برای تقسیم خرید، سه پاسخ معتبر لازم است؛ استثنای کمتر از سه پاسخ از مسیر انتخاب عادی انجام شود.');
 if(!Array.isArray(b.allocations)||b.allocations.length<2||b.allocations.length>20)fail('حداقل دو پیشنهاد انتخاب کنید.');
 const reason=req(b.notes,4000),seen=new Set<string>();let total=0;
 for(const a of b.allocations){const q=await get(req(a.quoteId),'sourcing_quote'),d=q.data,n=quantity(a.quantity);if(seen.has(q.id)||!quotes.some(x=>x.id===q.id)||n>d.quantity||d.commercialVersion!==3||!d.costsComplete||d.technical!=='pass'||d.financial==='fail'||d.validUntil<dayAt())fail('پیشنهاد معتبر و مقدار در ظرفیت فروشنده لازم است.');seen.add(q.id);total+=n;
 const safe=await checkPurchaseTechnical(line.materialId,d.supplierLinkId,{specs:line.specs,designVersion:line.designVersion}),qualified=await checkSupplierPurchase(d.supplierLinkId,line.materialId,d.route,n);for(const e of [...Object.values(safe),...Object.values(qualified)])guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',e.id,e.revision);
 const commercial=commercialTerms({...d,discountRial:(BigInt(d.discountRial||'0')*BigInt(n)/BigInt(d.quantity)).toString()},quoteCost({...d,extrasRial:'0'},n));const snapshot={...d,...commercial,quantity:n,financial:undefined,paymentStages:undefined};
 const id=crypto.randomUUID();put(id,'purchase_order',{procurementVersion:3,planId:plan.id,partCode:line.partCode,materialId:line.materialId,unit:line.unit,warehouseId:plan.data.warehouseId||'',quantity:n,quoteId:q.id,quoteSnapshot:snapshot,materialSpecs:line.specs||'',designVersion:line.designVersion||0,supplierId:d.supplierId,supplierLinkId:d.supplierLinkId,supplier:d.supplier,route:d.route,totalRial:commercial.totalRial,deliveryDays:d.deliveryDays,deliveryStart:d.deliveryStart,requiredAdvanceRial:d.requiredAdvanceRial,eta:'',promisedEta:'',state:'awaiting_funding',paymentWorkflowRequired:true,splitFrom:b.id,decision:reason,selectedBy:u.userId,history:[{stage:'split_award',actor:u.userId,at:now,notes:reason}]});
 statements.push(db.prepare('INSERT INTO sourcing_holds(id,plan_id,part_code,unit,source_type,source_id,quantity) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),plan.id,line.partCode,line.unit,'po',id,n));
 }
 if(total!==line.shortage)fail('جمع مقدار تقسیم‌شده باید برابر مقدار موردنیاز باشد.');
}
