import {isIsoDay} from './persian-date';

export type SalesTemplateType='fixed'|'promotion';
export type SalesTemplateStatus='scheduled'|'active'|'expired';
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
export function overlappingSalesPromotion<T extends TemplateRow>(rows:T[],kind:string,start:string,end:string):T|undefined {
 return templatesFor(rows,kind).find(r=>{
  if(salesTemplateType(r)!=='promotion'||!isIsoDay(r.data.effectiveFrom))return false;
  const previousEnd=promotionEndDay(r.data.effectiveFrom,r.data.durationDays);
  return !!previousEnd&&r.data.effectiveFrom<=end&&previousEnd>=start;
 });
}
