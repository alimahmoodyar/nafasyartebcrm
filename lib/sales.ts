import {storedAccessPermissions} from './permissions';
import {trainingContext} from './training-context';
import {storage} from './storage';
import {AccessError} from './authorization';
import type {Session} from './permissions';
import {dayAt,addDay,validDay,taskRequired,taskText} from './duties';
import {salesAccounts,salesTargetProgress,rial,total,salesRequestChannels} from './sales-contract';
import {sha256} from './firmware';
export const salesFail=(m:string,status=400):never=>{throw new AccessError(m,status)};
export {salesRep,salesManager,salesStaff,salesFinance,salesRead,salesWarehouse,salesViewer,salesReportRead} from './sales-access';
import {salesRep,salesRead,salesWarehouse,salesStaff,salesManager,salesFinance,salesViewer,salesReportRead} from './sales-access';
import {memberId} from './duties';
import {termsPlan} from './sales-network-contract';
import {salesPaymentDays,salesPaymentMaxDays,maxSalesPaymentDays} from './sales-payment-terms';
import {resolveSalesOrderTemplates,selectSalesTemplatePrice} from './sales-template';
import {approvedCostPrice} from './pricing-contract';
// Defer imported validators until call time: duties and sales have circular imports.
export function sreq(v:unknown,max=200){return taskRequired(v,max)}
export function stxt(v:unknown,max=4000){return taskText(v,max)}
export function money(v:unknown,positive=false){const s=sreq(v,18);if(!/^\d{1,18}$/.test(s)||positive&&BigInt(s)<=BigInt(0))salesFail('مبلغ باید ریال صحیح '+(positive?'مثبت':'نامنفی')+' باشد.');return BigInt(s).toString();}
export function sday(v:unknown){const s=sreq(v,10);if(!validDay(s))salesFail('تاریخ معتبر لازم است.');return s;}
export function salesSubmission(u:Session,agentId:string,source:any,at:string,contactRequired=true){
 if(salesRep(u)){if(source!=null)salesFail('نماینده درخواست را مستقیماً از حساب خودش ثبت می‌کند.');return {actor:u.userId,actorName:u.name,agentId,onBehalf:false,channel:'portal',at};}
 if(!source||typeof source!=='object'||Array.isArray(source)||!Object.hasOwn(salesRequestChannels,source.channel))salesFail('روش دریافت درخواست نماینده را مشخص کنید.');
 const day=sday(source.day);if(day>dayAt())salesFail('تاریخ دریافت درخواست در آینده نباشد.');
 return {actor:u.userId,actorName:u.name,agentId,onBehalf:true,channel:source.channel,contactName:contactRequired?sreq(source.contactName,200):stxt(source.contactName??'',200),day,reference:stxt(source.reference??'',1000),at};
}
// Staff payment entry is based on a receipt, not a fabricated customer request.
// Explicit legacy request metadata is still validated when supplied.
export function salesPaymentSubmission(u:Session,agentId:string,source:any,at:string){
 if(salesRep(u)||source!=null)return salesSubmission(u,agentId,source,at);
 return {actor:u.userId,actorName:u.name,agentId,onBehalf:false,channel:'staff_entry',at};
}
export function integer(v:unknown,min=1,max=10000){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)salesFail('عدد صحیح در محدوده مجاز وارد کنید.');return v as number;}
export function arr(v:unknown,max=100){if(!Array.isArray(v)||!v.length||v.length>max)salesFail('فهرست غیرخالی معتبر لازم است.');return v as any[];}
export const salesDecode=(r:any)=>({...r,data:JSON.parse(r.data)});
export async function salesRows(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type GLOB 'sales_*' AND type<>'sales_report' ORDER BY created,id").all()).results.map(salesDecode);}
export async function salesEntity(id:string,type:string){const r:any=await storage().prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(id,type).first();if(!r)salesFail('پرونده پیدا نشد.',404);return salesDecode(r);}
export async function liveSalesUser(u:Session){if(u.isAdmin||trainingContext.getStore())return u;const m:any=await storage().prepare("SELECT status,permissions FROM app_members WHERE subject=? OR id=?").bind(u.userId,u.userId.startsWith('local:')?u.userId.slice(6):u.userId).first();if(!m||m.status!=='active')salesFail('دسترسی فعال لازم است.',403);return {...u,permissions:storedAccessPermissions(m.permissions)};}
export async function salesVisible(u:Session,a:any,operation:'read'|'write'='write'){
 if(salesRep(u))return a.id===u.permissions.salesAgentId;
 if(salesManager(u)||salesFinance(u))return true;
 if(operation==='read'&&salesReportRead(u))return true;
 if(salesStaff(u)||operation==='read'&&salesViewer(u))return a.data.ownerId===await memberId(u);
 // Warehouse-only return reception retains its existing minimal scope.
 return salesWarehouse(u);
}
export async function salesScope(u:Session,id:string,operation:'read'|'write'='write'){u=await liveSalesUser(u);if(!salesRead(u)&&!salesWarehouse(u)||salesRep(u)&&id!==u.permissions.salesAgentId)salesFail('پرونده پیدا نشد یا دسترسی ندارید.',404);const a=await salesEntity(id,'sales_agent');if(!await salesVisible(u,a,operation))salesFail('پرونده در دسترسی شما نیست.',404);if(salesRep(u)&&!a.data.active)salesFail('نمایندگی غیرفعال شده است.',403);return a;}
export async function salesLock(db:D1Database,id:string){const r:any=await db.prepare("SELECT revision FROM flow_entities WHERE id='sales-lock'").first();const now=new Date().toISOString();return [db.prepare("UPDATE inventory_operations SET guard=CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id='sales-lock'),0)=? THEN guard ELSE 0 END WHERE id=?").bind(r?.revision||0,id),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('sales-lock','sales_lock','{}',1,?,?) ON CONFLICT(id) DO UPDATE SET revision=flow_entities.revision+1,updated=excluded.updated").bind(now,now)];}
// Shared by order quotes and the manager's current-price report. A report omits
// agentId deliberately: negotiated buyer prices never become a general price.
export function salesBasePrice(rows:any[],productId:string,kind:string,today:string,agentId=''){
 const templatePrice=selectSalesTemplatePrice(rows,kind,today,productId),approvedPrice=approvedCostPrice(rows,productId,kind,today);
 const prices=rows.filter(p=>p.type==='sales_price'&&!p.data.pricingApprovalId&&p.data.productId===productId&&p.data.active&&(p.data.agentId===''||p.data.agentId===agentId)),price=prices.find(p=>p.data.agentId===agentId)||prices.find(p=>p.data.agentId==='');
 if(!approvedPrice&&!templatePrice&&!price)return null;
 return {approvedPrice,templatePrice,price,unitPrice:approvedPrice?.data.unitPrice??templatePrice?.unitPrice??price.data.unitPrice,source:approvedPrice?'cost_approved' as const:templatePrice?'sales_template' as const:'sales_price' as const,sourceId:approvedPrice?.id||templatePrice?.template.id||price.id};
}
export async function salesQuote(agent:any,items:any[],rows:any[],options:any={}){
 if(agent.data.kind==='referrer')salesFail('عامل معرف طرف حساب خرید نیست.');if(!agent.data.active)salesFail('نمایندگی غیرفعال است.');const today=dayAt();const targets=rows.filter(r=>r.type==='sales_target'&&r.data.agentId===agent.id&&r.data.state==='active'&&r.data.start<=today&&r.data.end>=today);if(targets.length>1)salesFail('بازه قوانین تخفیف تداخل دارد.',409);
 const selectedItems=arr(items,30).map(i=>({productId:sreq(i.productId),quantity:integer(i.quantity,1,10000)}));
 if(new Set(selectedItems.map(i=>i.productId)).size!==selectedItems.length)salesFail('کالای تکراری را در یک ردیف ثبت کنید.');
 const selection=resolveSalesOrderTemplates(rows,agent.data.kind||'representative',today,selectedItems.map(i=>i.productId));
 if(selection.state==='incompatible')salesFail('شرایط پرداخت یا دامنه مذاکره کالاهای انتخابی متفاوت است؛ برای هر گروه با شرایط یکسان پیش‌فاکتور جداگانه ثبت کنید.');
 if(selection.missingProductIds.length&&selection.templates.length){
  const names:string[]=[];for(const productId of selection.missingProductIds){const r:any=await storage().prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(productId).first(),p=r?JSON.parse(r.payload):null;names.push(p?.name||p?.model||p?.code||productId);}
  salesFail('برای این کالاها الگوی فروش معتبر همین نوع خریدار تعریف نشده است: '+names.join('، ')+'؛ مدیر فروش الگو را تکمیل کند.');
 }
 const template=selection.state==='ready'?selection.templates[0].template:undefined;
 const target=targets[0],progress=target?salesTargetProgress(target,rows,today):null;
 const discountBlocked=rial(salesAccounts(rows,agent.id,today).overdue)>BigInt(0);
 const lines:any[]=[];for(const {productId,quantity} of selectedItems){
 const r:any=await storage().prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(productId).first();if(!r||JSON.parse(r.payload).status==='غیرفعال'||JSON.parse(r.payload).status==='توقف تولید')salesFail('محصول فعال موجود نیست.');const product=JSON.parse(r.payload);
 const resolved=salesBasePrice(rows,productId,agent.data.kind||'representative',today,agent.id);if(!resolved)salesFail('قیمت پایه در الگوی فروش یا قیمت فعال برای محصول ثبت نشده است.');const {approvedPrice,templatePrice,price}=resolved!;
 const unitPrice=money(resolved!.unitPrice,true),priceSource=resolved!.source,priceTemplateId=approvedPrice?'':templatePrice?.template.id||'',priceTemplateRevision=approvedPrice?0:templatePrice?.template.revision||0;
 const productTemplate=selection.templates.find(t=>t.productId===productId)?.template,lineBaseDiscountBps=integer(productTemplate?.data.discountBps??0,0,9000);
 const eligibleTarget=target&&(!target.data.productIds.length||target.data.productIds.includes(productId));const lineBps=discountBlocked?0:Math.max(lineBaseDiscountBps,eligibleTarget?progress?.discountBps||0:0);const unitNet=(rial(unitPrice)*BigInt(10000-lineBps))/BigInt(10000);if(unitNet<=BigInt(0))salesFail('قیمت پس از تخفیف معتبر نیست.');
 if(approvedPrice){const approval:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='pricing_approval'").bind(approvedPrice.data.pricingApprovalId).first();const d=approval?JSON.parse(approval.data):null;if(!d||d.productId!==productId||d.kind!==(agent.data.kind||'representative')||d.calculation.unitPrice!==unitPrice)salesFail('مصوبه قیمت در دسترس یا معتبر نیست؛ مالی و مدیرعامل بررسی کنند.',409);if(unitNet<rial(d.calculation.minimumNet))salesFail('تخفیف این فروش از دامنه مجاز مصوبه قیمت بیشتر است؛ مدیرعامل قیمت را بازبینی کند.');}
 lines.push({productId,name:product.name||product.model||product.code,model:product.model||'',quantity,priceSource,priceId:approvedPrice?.id||(templatePrice?'':price.id),priceRevision:approvedPrice?.revision||(templatePrice?0:price.revision),priceTemplateId,priceTemplateRevision,termsTemplateId:productTemplate?.id||'',termsTemplateRevision:productTemplate?.revision||0,baseDiscountBps:lineBaseDiscountBps,...(approvedPrice?{pricingApprovalId:approvedPrice.data.pricingApprovalId}:{}),unitPrice,discountBps:lineBps,unitNet:String(unitNet),net:String(unitNet*BigInt(quantity)),discount:String((rial(unitPrice)-unitNet)*BigInt(quantity))});}
 if(total(lines,l=>l.net)>BigInt('999999999999999999'))salesFail('جمع سفارش از سقف مبلغ مجاز بیشتر است.');

 if(!template&&options.salesTerms)salesFail('ابتدا مدیر الگوی عمومی را تعریف کند.');
 const requestedCash=options.salesTerms?.cashBps??template?.data.cashBps,requestedMonths=options.salesTerms?.months??template?.data.months;
 const daily=selection.templates.some(t=>t.template.data.days!==undefined)||options.salesTerms?.days!==undefined;
 const requestedDays=daily?salesPaymentDays(options.salesTerms?.days!==undefined?options.salesTerms:options.salesTerms?.months!==undefined?{months:integer(options.salesTerms.months,0,12)}:template?.data,today):0;
 const maxDays=daily?salesPaymentMaxDays(template?.data,today):0;
 // Ignore legacy maxCashBps/minMonths: higher cash and earlier settlement are allowed.
 if(template&&options.salesTerms){const minCash=template.data.minCashBps??0,maxMonths=template.data.maxMonths??12;if(Number(requestedCash)<minCash||(daily?requestedDays>maxDays:Number(requestedMonths)>maxMonths))salesFail('شرایط پیشنهادی خارج از دامنه مجاز این نوع خریدار است؛ مدیر فروش باید آن را تأیید یا اصلاح کند.');}
 const terms=template?{templateId:template.id,templateRevision:template.revision,cashBps:integer(requestedCash,0,10000),standardCashBps:template.data.cashBps,minCashBps:template.data.minCashBps??0,maxCashBps:10000,...(daily?{days:integer(requestedDays,0,maxSalesPaymentDays),standardDays:salesPaymentDays(template.data,today),maxDays:integer(maxDays,0,maxSalesPaymentDays)}:{months:integer(requestedMonths,0,12),standardMonths:template.data.months,minMonths:0,maxMonths:template.data.maxMonths??12})}:null;
 let referral:any=null;if(options.referrerId){const ref=rows.find(r=>r.type==='sales_agent'&&r.id===options.referrerId&&r.data.active&&r.data.kind==='referrer'),contracts=rows.filter(r=>r.type==='sales_contract'&&r.data.agentId===ref?.id&&r.data.state==='approved'&&r.data.start<=today&&r.data.end>=today);if(!ref||contracts.length!==1)salesFail('عامل معرف با قرارداد مصوب معتبر انتخاب کنید.');const c=contracts[0];referral={agentId:ref.id,contractId:c.id,bps:c.data.bps,basis:'net-collected-v1'};}
 const deliveryMode=agent.data.kind==='branch'?'consignment':'sale',termDays=terms?salesPaymentDays(terms,today):agent.data.termDays;
 const baseDiscountBps=Math.max(...lines.map(l=>l.baseDiscountBps)),discountBps=Math.max(...lines.map(l=>l.discountBps));
 const quote={...(terms?{salesTerms:terms,installments:termsPlan(String(total(lines,l=>l.net)),terms,today)}:{}),...(referral?{referral}:{}),agentId:agent.id,agentRevision:agent.revision,deliveryMode,day:today,lines,amount:String(total(lines,l=>l.net)),discount:String(total(lines,l=>l.discount)),discountBps,baseDiscountBps,discountBlocked,targetId:target?.id||'',targetRevision:target?.revision||0,targetProgress:progress?.progress||'0',discountPolicy:'max-product-template-and-earned-tier-v1',termDays,due:addDay(today,termDays),recipient:{name:agent.data.name,phone:agent.data.phone,address:agent.data.address,province:agent.data.province,city:agent.data.city}};
 return {...quote,quoteHash:await sha256(new TextEncoder().encode(JSON.stringify(quote)).buffer)};
}
export function publicSalesFile(f:any){const {objectKey,uploadSignature,actor,...data}=f.data;return {...f,data};}
export async function salesDelivery(rows:any[],agentIds:string[]){
 const orders=rows.filter(r=>r.type==='sales_order'&&agentIds.includes(r.data.agentId)),orderIds=new Set(orders.map(o=>o.id));
 const sales=(await storage().prepare("SELECT * FROM flow_entities WHERE type='sale'").all()).results.map(salesDecode).filter(s=>orderIds.has(s.data.salesOrderId));
 const missions=(await storage().prepare("SELECT * FROM flow_entities WHERE type='transport' AND json_extract(data,'$.kind')='sale'").all()).results.map(salesDecode);
 const devices=(await storage().prepare("SELECT id,payload FROM records WHERE kind='device'").all()).results as any[];
 return sales.map(s=>{const m=missions.find(m=>m.data.sourceId===s.id&&m.data.state!=='cancelled');return {id:s.id,revision:s.revision,orderId:s.data.salesOrderId,productId:s.data.productId,state:s.data.state,count:s.data.count,deviceIds:s.data.deviceIds,devices:s.data.deviceIds.map((id:string)=>({id,serial:devices.find(d=>d.id===id)?JSON.parse(devices.find(d=>d.id===id).payload).code:id})),dispatchedAt:s.data.dispatchedAt||'',deliveredAt:s.data.deliveredAt||'',transport:m?{id:m.id,revision:m.revision,state:m.data.state,code:m.data.code,due:m.data.due,carrier:m.data.carrier,waybill:m.data.waybill,tracking:m.data.tracking,packages:m.data.packages,receipt:m.data.receipt||null}:null};});
}
