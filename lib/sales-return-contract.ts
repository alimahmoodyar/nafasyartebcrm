import type {Session} from './permissions';
import {salesRep,salesStaff,salesFinance} from './sales-access';
import {domainWriteAccess,role} from './service-access';

export const returnActions={
 review:'بررسی اولیه خدمات',waybill:'ثبت بارنامه برگشت',pickup:'تحویل از باربری به خدمات',
 inspect:'ثبت نتیجه بررسی حضوری',handback:'ثبت تحویل دستگاه به نماینده',technical:'ثبت تصمیم و بستن بررسی فنی',
 factory:'دریافت در انبار کارخانه',line:'تحویل به خط تولید',repair:'ثبت تعمیر یا تعویض قطعه',
 quality:'ثبت نتیجه کنترل کیفیت',pack:'تأیید بسته‌بندی و برگشت به موجودی',
 settle:'تأیید عودت و کسر از بدهی',refund:'ثبت پرداخت مازاد',
 reserve:'رزرو دستگاه جایگزین',dispatch:'ساخت ارسال جداگانه'
} as const;
export type ReturnAction=keyof typeof returnActions;
export function returnRoles(u:Session){
 const p=u.permissions,internal=!p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId&&!p.salesRoles?.includes('agent')&&!p.serviceRoles?.includes('agent');
 const staff=(allowed:boolean)=>u.isAdmin||internal&&allowed;
 return {
  rep:salesRep(u),sales:staff(salesStaff(u)),finance:staff(salesFinance(u)),
  service:staff((domainWriteAccess(u,'home')||domainWriteAccess(u,'hospital'))&&['support','intake','technician','coordinator'].some(r=>role(u,r))||p.write.includes('service')),
  logistics:staff(!!p.transportRoles?.includes('manager')||!!p.flowRoles?.includes('logistics')),
  technical:staff(!!p.supplyRoles?.includes('engineering')||!!p.roleAssignment?.roles.some(r=>['engineering','technical_manager'].includes(r))),
  factory:staff(!!p.flowRoles?.includes('inventory')||!!p.warehouseResponsibilities?.some(r=>r.role==='inventory')),
  line:staff(!!p.flowRoles?.includes('production')),quality:staff(!!p.flowRoles?.includes('qc'))
 };
}
export const returnActionRoles:Record<ReturnAction,Array<keyof ReturnType<typeof returnRoles>>>={
 review:['service'],waybill:['rep','sales'],pickup:['logistics'],inspect:['service'],handback:['logistics'],
 technical:['technical'],factory:['factory'],line:['factory'],repair:['line'],quality:['quality'],pack:['factory'],
 settle:['sales'],refund:['finance'],reserve:['sales'],dispatch:['sales']
};
export function pendingReturnActions(d:any,saleState?:string):ReturnAction[]{
 if(d.intake==='review')return ['review'];
 if(d.intake==='approved')return ['waybill'];
 if(d.intake==='shipment')return ['pickup'];
 if(d.intake==='at_service')return ['inspect'];
 if(d.intake==='handback')return ['handback'];
 if(d.intake!=='inspected')return [];
 const actions:ReturnAction[]=[];
 if(!d.technical)actions.push('technical');
 const stage:Record<string,ReturnAction>={at_service:'factory',factory:'line',line:'repair',repaired:'quality',passed:'pack'};
 if(stage[d.deviceStage])actions.push(stage[d.deviceStage]);
 if(d.resolution==='refund'&&!d.settlement)actions.push('settle');
 if(d.settlement?.payable!=='0'&&d.settlement&&!d.settlement.paidAt)actions.push('refund');
 if(d.resolution==='replacement'&&(!d.replacement||saleState==='cancelled'))actions.push('reserve');
 if(d.replacement&&saleState==='reserved'&&!d.replacement.separate&&!d.replacement.orderId)actions.push('dispatch');
 return actions;
}
export function returnStatus(d:any,saleState?:string){
 if(d.intake==='rejected')return 'رد شده';
 if(d.intake!=='inspected')return ({review:'در انتظار بررسی خدمات',approved:'در انتظار ثبت بارنامه',shipment:'در انتظار تدارکات',at_service:'در انتظار بررسی حضوری',handback:'در انتظار تحویل مجدد به نماینده'} as Record<string,string>)[d.intake]||'در جریان';
 const commercial=d.resolution==='replacement'?saleState==='delivered'||saleState==='delivered_partner':!!d.settlement&&(d.settlement.payable==='0'||!!d.settlement.paidAt);
 if(d.technical&&d.deviceStage==='sellable'&&commercial)return 'بسته‌شده';
 if(d.technical&&d.deviceStage==='sellable')return d.resolution==='replacement'?'در انتظار تحویل جایگزین':'در انتظار تسویه';
 return 'در جریان';
}
export function refundAllocation(invoices:any[],amount:bigint){
 let remaining=amount;
 const ordered=invoices.flatMap(i=>i.installments.map((p:any)=>({...p,invoiceId:i.id})))
  .filter(p=>BigInt(p.remaining)>BigInt(0)).sort((a,b)=>a.due.localeCompare(b.due)||a.invoiceId.localeCompare(b.invoiceId)||a.id.localeCompare(b.id));
 const allocations=[];
 for(const p of ordered){
  if(remaining===BigInt(0))break;
  const due=BigInt(p.remaining),applied=due<remaining?due:remaining;
  allocations.push({invoiceId:p.invoiceId,installmentId:p.id,amount:String(applied)});remaining-=applied;
 }
 return {offset:String(amount-remaining),payable:String(remaining),allocations};
}
