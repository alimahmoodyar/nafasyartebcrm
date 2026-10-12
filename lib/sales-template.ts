import {isIsoDay} from './persian-date';

export type SalesTemplateType='fixed'|'promotion';
export type SalesTemplateStatus='scheduled'|'active'|'expired';
export type SalesTemplateProductPrice={productId:string,unitPrice:string};
type TemplateRow={id:string,type:string,created:string,data:any};
const templateData=(template:any)=>template?.data??template;

// Legacy records have neither a type nor an effective date and stay immediately valid.
export function salesTemplateType(template:any):SalesTemplateType{return templateData(template)?.templateType==='promotion'?'promotion':'fixed';}
export function promotionEndDay(start:unknown,durationDays:unknown):string|null {
 if(!isIsoDay(start)||typeof durationDays!=='number'||!Number.isSafeInteger(durationDays)||durationDays<1)return null;
 const end=new Date(new Date(start+'T12:00:00Z').getTime()+(durationDays-1)*86400000);
 if(!Number.isFinite(end.getTime()))return null;
 const day=end.toISOString().slice(0,10);return isIsoDay(day)?day:null;
}
export function salesTemplateStatus(template:any,today:string):SalesTemplateStatus {
 const data=templateData(template),start=data?.effectiveFrom;
 if(start&&(!isIsoDay(start)||start>today))return 'scheduled';
 if(salesTemplateType(data)==='promotion'){
  const end=promotionEndDay(start,data?.durationDays);
  if(!end||end<today)return 'expired';
 }
 return 'active';
}
const newestFirst=(a:TemplateRow,b:TemplateRow)=>(b.data.version||0)-(a.data.version||0)||b.created.localeCompare(a.created)||b.id.localeCompare(a.id);
const templatesFor=<T extends TemplateRow>(rows:T[],kind:string)=>rows.filter(r=>r.type==='sales_template'&&r.data.kind===kind);
export function latestSalesTemplate<T extends TemplateRow>(rows:T[],kind:string):T|undefined {return templatesFor(rows,kind).sort(newestFirst)[0];}
export function selectFixedSalesTemplate<T extends TemplateRow>(rows:T[],kind:string,today:string):T|undefined {
 return templatesFor(rows,kind).filter(r=>salesTemplateType(r)==='fixed'&&salesTemplateStatus(r,today)==='active').sort(newestFirst)[0];
}
export function selectSalesTemplate<T extends TemplateRow>(rows:T[],kind:string,today:string):T|undefined {
 const promotion=templatesFor(rows,kind).filter(r=>salesTemplateType(r)==='promotion'&&salesTemplateStatus(r,today)==='active').sort(newestFirst)[0];
 return promotion??selectFixedSalesTemplate(rows,kind,today);
}
// Older templates did not carry prices. Promotions can override selected products
// while the effective fixed template remains the price source for the rest.
export function salesTemplateProductPrice(template:any,productId:string):SalesTemplateProductPrice|undefined {
 const prices=templateData(template)?.productPrices;return Array.isArray(prices)?prices.find(p=>p?.productId===productId):undefined;
}
export function selectSalesTemplatePrice<T extends TemplateRow>(rows:T[],kind:string,today:string,productId:string):{template:T,unitPrice:string}|undefined {
 const active=selectSalesTemplate(rows,kind,today),activePrice=salesTemplateProductPrice(active,productId);
 if(active&&activePrice)return {template:active,unitPrice:activePrice.unitPrice};
 if(active&&salesTemplateType(active)==='promotion'){
  const fixed=selectFixedSalesTemplate(rows,kind,today),fixedPrice=salesTemplateProductPrice(fixed,productId);
  if(fixed&&fixedPrice)return {template:fixed,unitPrice:fixedPrice.unitPrice};
 }
 return undefined;
}
export function overlappingSalesPromotion<T extends TemplateRow>(rows:T[],kind:string,start:string,end:string):T|undefined {
 return templatesFor(rows,kind).find(r=>{
  if(salesTemplateType(r)!=='promotion'||!isIsoDay(r.data.effectiveFrom))return false;
  const previousEnd=promotionEndDay(r.data.effectiveFrom,r.data.durationDays);
  return !!previousEnd&&r.data.effectiveFrom<=end&&previousEnd>=start;
 });
}
