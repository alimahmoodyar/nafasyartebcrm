import {moneyMicro,moneyText,MICRO} from './costing';
import {usdRate} from './daily-usd';
export function customCostAnalysis(intake:any,rows:any[],chosenRate:string){
 const rate=usdRate(chosenRate),fx=moneyMicro(rate),materials=rows.filter(r=>r.type==='material'),boms=rows.filter(r=>r.type==='semi_bom'),output:any[]=[],unknown:string[]=[];
 const rates=rows.filter(r=>r.type==='daily_usd_rate');
 const purchase=(code:string,unit:string)=>{
  const found:any[]=[];
  for(const s of rows.filter(r=>r.type==='purchase_settlement')){
   // A reopened invoice is not evidence of its unapproved edited price.
   const d=s.data.state==='approved'?s.data:[...(s.data.history||[])].reverse().map(h=>h.previous).find(d=>d?.state==='approved');if(!d)continue;
   for(const l of d.lines||[]){const receipt=rows.find(r=>r.type==='receipt'&&r.id===l.receiptId),order=rows.find(r=>r.type==='purchase_order'&&r.id===receipt?.data.purchaseOrderId);if(order?.data.partCode!==code||order?.data.unit!==unit)continue;
    try{const q=moneyMicro(l.invoiceQuantity);if(q<=BigInt(0))continue;const net=moneyMicro(l.unitPrice)-moneyMicro(l.discount||'0')*MICRO/q;if(net<BigInt(0))continue;found.push({settlementId:s.id,receiptId:l.receiptId,day:d.invoiceDay,currency:d.currency,unitPrice:net,reference:d.invoiceNumber});}catch{}
   }
  }
  return found.sort((a,b)=>b.day.localeCompare(a.day)||a.settlementId.localeCompare(b.settlementId))[0];
 };
 const visit=(code:string,unit:string,q:bigint,path:string[])=>{
  const m=materials.find(m=>m.data.code===code&&m.data.unit===unit);if(!m){unknown.push('شناسنامه '+code);return;}
  if(path.includes(m.id)){unknown.push('چرخه BOM '+code);return;}
  if(m.data.kind==='semi_finished'){
   const bom=boms.filter(b=>b.data.materialId===m.id).sort((a,b)=>b.data.version-a.data.version)[0];if(!bom){unknown.push('BOM نیمه‌آماده '+code);return;}
   for(const l of bom.data.lines)visit(l.partCode,l.unit,q*moneyMicro(String(l.quantity))/MICRO,[...path,m.id]);return;
  }
  const p=purchase(code,unit),r:any={code,name:m.data.name,unit,quantity:moneyText(q),historical:null,normalized:null,source:null,missing:''};
  if(!p){r.missing='قیمت خرید معتبر ثبت نشده';unknown.push(code+': '+r.missing);output.push(r);return;}
  r.source={settlementId:p.settlementId,receiptId:p.receiptId,day:p.day,currency:p.currency,unitPrice:moneyText(p.unitPrice),reference:p.reference};
  if(p.currency==='USD'){r.historical=moneyText(p.unitPrice*q/MICRO*fx/MICRO);r.normalized=r.historical;}
  else if(['IRR','IRT'].includes(p.currency)){const price=p.unitPrice*(p.currency==='IRT'?BigInt(10):BigInt(1));r.historical=moneyText(price*q/MICRO);const prior=rates.find(x=>x.data.day===p.day);if(prior)r.normalized=moneyText(price*q/MICRO*fx/moneyMicro(prior.data.rate));else{r.missing='نرخ دلار در تاریخ خرید موجود نیست';unknown.push(code+': '+r.missing);}}
  else{r.missing='ارز '+p.currency+' بدون مبنای تبدیل مصوب';unknown.push(code+': '+r.missing);}
  output.push(r);
 };
 for(const i of intake.items||[])for(const l of i.internalBom||[])visit(l.partCode,l.unit,moneyMicro(l.quantity)*BigInt(i.quantity),[]);
 unknown.push('زمان و هزینه کارگری قطعی مشخص نیست');
 const sum=(key:string)=>moneyText(output.reduce((n,l)=>n+(l[key]===null?BigInt(0):moneyMicro(l[key])),BigInt(0)));
 return {rate,lines:output,historical:sum('historical'),normalized:sum('normalized'),unknown:[...new Set(unknown)],complete:false};
}
export function priceSpecSignature(intake:any,order:any){return JSON.stringify({orderId:order.id,lines:order.data.lines,amount:order.data.amount,items:intake.items,specialRequest:intake.specialRequest,specialDescription:intake.specialDescription,technicalResolution:intake.technicalResolution});}
export function currentCustomPrice(intake:any,order:any){return !intake.reviewedPricing||intake.priceApproval?.signature===priceSpecSignature(intake,order);}
