import {serviceCosts} from './purchase-fulfillment';
import {storage} from './storage';
import {requireAccess,AccessError} from './authorization';
import {hasSupply} from './sourcing';
import {costRead,costWrite,moneyMicro,moneyText,MICRO} from './costing';
export const settleFail=(m:string,s=400):never=>{throw new AccessError(m,s)};
export const settleText=(v:any,max=500)=>{if(typeof v!=='string'||!v.trim()||v.length>max)settleFail('متن الزامی یا نامعتبر است.');return v.trim();};
export const settleAmount=(v:any):bigint=>{try{return moneyMicro(v);}catch{return settleFail('مبلغ نامنفی معتبر لازم است.');}};
export const settleFinance=(u:any)=>costWrite(u);
export const settleRead=(u:any)=>!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId&&(costRead(u)||hasSupply(u,'finance')||hasSupply(u,'ceo')||hasSupply(u,'domestic')||hasSupply(u,'foreign'));
export const settleBuyer=(u:any,route:string)=>settleRead(u)&&['domestic','foreign'].includes(route)&&hasSupply(u,route);
export const settleVisible=(u:any,s:any)=>settleRead(u)&&(costRead(u)||hasSupply(u,'finance')||hasSupply(u,'ceo')||settleBuyer(u,s.data.route));
export async function settlementUser(){const u=await requireAccess();if(!settleRead(u))settleFail('دسترسی بازرگانی یا مالی لازم است.',403);return u;}
export async function settlementRows(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type IN ('purchase_settlement','settlement_file','purchase_order','receipt','cost_price','purchase_service','purchase_payable') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export function settlementBy(rows:any[],id:string,u:any){const s=rows.find(r=>r.type==='purchase_settlement'&&r.id===id);if(!s||!settleVisible(u,s))settleFail('پرونده تسویه در دسترس نیست.',404);return s;}
export const settlementHelp=[
 'بازرگانی یک فاکتور نهایی را برای بچ‌های دریافت‌شده از یک تأمین‌کننده و مسیر خرید در همان پرونده تأمین ثبت می‌کند. هر بچ فقط در یک پرونده تسویه قرار می‌گیرد؛ تحویل‌های مرحله‌ای پرونده جدا دارند.',
 'مبلغ تخفیف هر ردیف به ارز فاکتور است. نرخ تبدیل، ریال به ازای یک واحد ارز است. هزینه جانبی، مالیات قابل بازیافت و پرداخت گزارش‌شده به ریال ثبت می‌شوند؛ پرداخت گزارش‌شده سند پرداخت یا تسویه حساب نیست.',
 'هزینه‌های مشترک با ارزش خالص کالا یا وزن توزیع می‌شوند؛ مالی می‌تواند مبلغ هر ردیف را دستی تخصیص دهد. واحدهای متفاوت با تعداد جمع زده نمی‌شوند. مالیات قابل بازیافت وارد قیمت موجودی نمی‌شود.',
 'پیشنهاد بهای موجودی فقط سهم مقدار پذیرفته‌شده از کل مبلغ است. مبلغ خارج از موجودی برای کسری، رد کیفی یا ادعای تأمین‌کننده جدا می‌ماند؛ مالی مبلغ نهایی این بخش و علت آن را تأیید می‌کند. هیچ رد یا کسری خودکار روی کالای سالم سرشکن نمی‌شود.',
 'ارسال به مالی قیمت موجودی را تغییر نمی‌دهد. پس از تأیید مالی، قیمت واحد روی بچ‌های پذیرفته و جانمایی‌شده همان پرونده به‌صورت اتمی ثبت می‌شود. اصلاح پرونده تأییدشده نیازمند بازگشایی مالی و تأیید دوباره است؛ قیمت قبلی تا تأیید جدید معتبر می‌ماند.',
 'این فرم سند سپیدار، پرداخت بانکی یا اعتبار تأمین‌کننده صادر نمی‌کند. برای فاکتور شامل چند محموله، مقدار و مبلغ سهم هر محموله را با توضیح و مدارک مشخص کنید تا مبلغ تکرار نشود.'
];
export function settlementPreview(data:any,rows:any[]){
 const problems:string[]=[],finance=data.finance||{};const rate=settleAmount(finance.fxRate??data.fxRate);if(rate<=BigInt(0))settleFail('نرخ تبدیل مثبت لازم است.');
 if(data.currency==='IRR'&&rate!==MICRO||data.currency==='IRT'&&rate!==BigInt(10)*MICRO)settleFail('نرخ تبدیل ریال ۱ و تومان ۱۰ است.');
 const expenses=(data.expenses||[]).reduce((n:bigint,e:any)=>n+settleAmount(e.amountRial),BigInt(0));
 const lines=(data.lines||[]).map((l:any)=>{const r=rows.find(x=>x.id===l.receiptId&&x.type==='receipt');if(!r)settleFail('رسید مرتبط پیدا نشد.');const o=rows.find(x=>x.id===r.data.purchaseOrderId&&x.type==='purchase_order');if(!o||o.data.state==='cancelled')problems.push('سفارش لغو یا حذف شده: '+l.receiptId);
 const q=Math.round(Number(l.invoiceQuantity)*1000);if(!Number.isSafeInteger(q)||q<=0||!/^\d{1,9}(\.\d{1,3})?$/.test(l.invoiceQuantity))settleFail('مقدار فاکتور معتبر نیست.');const gross=settleAmount(l.unitPrice)*BigInt(q)/BigInt(1000),discount=settleAmount(l.discount);if(discount>gross)settleFail('تخفیف از مبلغ ردیف بیشتر است.');const net=(gross-discount)*rate/MICRO;const f=(finance.lines||[]).find((x:any)=>x.receiptId===l.receiptId)||{};
 const currentPrice=rows.find(x=>x.type==='cost_price'&&x.data.batchId===r.data.batchId);
 const accepted=r.data.accepted||0,received=r.data.quantity; if(!['stored','rejected'].includes(r.data.state))problems.push('QC و جانمایی تکمیل نشده: '+l.receiptId);
 return {...l,orderId:r.data.purchaseOrderId,partCode:o?.data.partCode,unit:o?.data.unit,received,accepted,rejected:r.data.rejected||0,receiptRevision:r.revision,priceRevision:currentPrice?.revision||0,currentUnitCost:currentPrice?.data.unitCost??null,priceSettlementId:currentPrice?.data.settlementId||'',net,gross,discount,q,finance:f,unitCost:null};});
 const basis=finance.allocation||'value';if(!['value','weight','manual'].includes(basis))settleFail('روش تخصیص معتبر نیست.');
 const weights=lines.map((l:any)=>basis==='value'?l.net:basis==='weight'?settleAmount(l.finance.weight||'0'):settleAmount(l.finance.extrasRial||'0'));
 const totalWeight=weights.reduce((n:bigint,v:bigint)=>n+v,BigInt(0));if(expenses>BigInt(0)&&totalWeight<=BigInt(0))problems.push('مبنای تخصیص هزینه مشترک را تکمیل کنید.');if(basis==='manual'&&totalWeight!==expenses)problems.push('جمع تخصیص دستی باید دقیقاً برابر هزینه مشترک باشد.');
 let allocated=BigInt(0);const output=lines.map((l:any,i:number)=>{const extra=basis==='manual'?weights[i]:totalWeight>BigInt(0)?(i===lines.length-1?expenses-allocated:expenses*weights[i]/totalWeight):BigInt(0);allocated+=extra;const linkedServices=serviceCosts(rows,'receipt',l.receiptId),serviceTotal=linkedServices.reduce((n:bigint,x:any)=>n+settleAmount(x.amount),BigInt(0));const total=l.net+extra+serviceTotal;
 const denominator=Math.max(l.q,l.received);const suggestedExcluded=total-total*BigInt(l.accepted)/BigInt(denominator);const excluded=l.finance.excludedRial===undefined?suggestedExcluded:settleAmount(l.finance.excludedRial);if(excluded>total)settleFail('مبلغ خارج از موجودی از کل ردیف بیشتر است.');if(!l.accepted&&excluded!==total)problems.push('رد کامل: تمام مبلغ باید خارج از موجودی باشد.');
 const mismatch=l.q!==l.received||l.rejected>0;if(mismatch&&!l.finance.disposition?.trim())problems.push('تعیین تکلیف کسری/رد لازم است: '+l.receiptId);if(l.finance.excludedRial===undefined)problems.push('مبلغ خارج از موجودی باید توسط مالی تأیید شود: '+l.receiptId);
 const inventory=total-excluded;const unit=l.accepted?inventory*BigInt(1000)/BigInt(l.accepted):null;const residue=unit===null?BigInt(0):inventory-unit*BigInt(l.accepted)/BigInt(1000);
 return {...l,finance:undefined,q:undefined,net:moneyText(l.net),gross:moneyText(l.gross),discount:moneyText(l.discount),discountAmount:moneyText(l.discount),serviceCosts:linkedServices,serviceCost:moneyText(serviceTotal),extras:moneyText(extra),total:moneyText(total),excluded:moneyText(excluded),suggestedExcluded:moneyText(suggestedExcluded),inventory:moneyText(inventory),unitCost:unit===null?null:moneyText(unit),roundingRial:moneyText(residue),disposition:l.finance.disposition||''};});
 return {lines:output,allocation:basis,fxRate:moneyText(rate),expenses:moneyText(expenses),total:moneyText(lines.reduce((n:bigint,l:any)=>n+l.net,BigInt(0))+expenses+output.reduce((n:bigint,l:any)=>n+settleAmount(l.serviceCost),BigInt(0))),recoverableTaxRial:data.recoverableTaxRial,reportedPaidRial:data.reportedPaidRial,problems:[...new Set(problems)],ready:!problems.length};
}
