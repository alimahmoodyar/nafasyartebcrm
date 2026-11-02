import {normalizeStockSearch} from './warehouse-stock';
import {warehouseName} from './production';
export type HistoryFilter={code?:string;kind?:string;query?:string;itemId?:string};
export function historyMatch(item:any,filter:HistoryFilter){
 const words=normalizeStockSearch(filter.query||'').split(/\s+/).filter(Boolean);
 return (!filter.code||normalizeStockSearch(item.itemCode)===normalizeStockSearch(filter.code))&&(!filter.kind||item.kind===filter.kind)&&(!filter.itemId||item.id===filter.itemId)&&words.every(word=>normalizeStockSearch([item.name,item.itemCode,item.code].join(' ')).includes(word));
}
export const historyLabels:Record<string,string>={opening:'موجودی آغازین',move:'انتقال وضعیت',finish:'مصرف تولید / محصول نهایی',flow_receipt:'ورود کالا',flow_incoming_qc:'کنترل کیفیت ورودی',flow_shelve:'جانمایی',flow_issue:'تحویل به خط تولید',flow_build:'مصرف تولید',flow_reject:'ثبت نامنطبق',flow_repair:'برگشت از تعمیر',warehouse_send:'ارسال بین انبارها',warehouse_receive:'دریافت انتقال انبار',warehouse_cancel:'لغو انتقال',fulfillment_receive:'دریافت محصول',fulfillment_reserve:'رزرو فروش',fulfillment_dispatch:'ارسال سفارش',fulfillment_cancel_sale:'لغو رزرو فروش'};
export function historyLabel(kind:string){return historyLabels[kind]||(kind.startsWith('hospital_')?'خدمات بیمارستانی':kind.startsWith('as_')||kind.startsWith('after_sales_')?'خدمات پس از فروش':kind.startsWith('routine_')?'تولید روزانه':kind.startsWith('project_')?'پروژه تولید':'گردش ثبت‌شدهٔ انبار');}
const historyStage=(id:string)=>id==='reserved'?'رزرو فروش':id==='in_transit'?'در مسیر ارسال':id==='delivered'?'تحویل‌شده':id.startsWith('consignment:')?'امانی نماینده':id.startsWith('service:')?'موجودی خدمات':warehouseName(id);
// Only display sanitized ledger data; operation payloads can contain prices or
// private customer information and must never be returned by this report.
export function ledgerMovements(entries:any[],names:Map<string,string>){
 const groups=new Map<string,any>();
 for(const e of entries){let g=groups.get(e.operation_id);if(!g){g={id:e.operation_id,at:e.created,sequence:e.sequence,label:historyLabel(e.kind),incoming:0,outgoing:0,from:new Set<string>(),to:new Set<string>(),physical:e.physical||[]};groups.set(e.operation_id,g);}if(e.delta>0){g.incoming+=e.delta;g.to.add(historyStage(e.warehouse));}else{g.outgoing-=e.delta;g.from.add(historyStage(e.warehouse));}}
 return [...groups.values()].sort((a,b)=>a.sequence-b.sequence).map(({sequence,...g})=>({...g,quantity:Math.max(g.incoming,g.outgoing),from:[...g.from].join('، ')||'خارج از موجودی',to:[...g.to].join('، ')||'خارج از موجودی',warehouses:g.physical.map((id:string)=>names.get(id)||'انبار ثبت‌شده').join(' ← '),physical:undefined}));
}
