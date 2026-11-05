import {stockQuality} from './stock-quality';
import {storage} from './storage';
import {domainAccess,role} from './service-access';
import type {Session} from './permissions';
// Read service lots once, with their real reservation totals. Never add the
// mirrored inventory_balances service buckets to the same report.
export const stockServiceDomains=(u:Session)=>['home','hospital'].filter(d=>domainAccess(u,d)&&role(u,'inventory'));
export async function serviceWarehouseStock(u:Session,warehouses:any[]){
 warehouses=warehouses.filter(w=>!w.data.deletedAt);const entries:any[]=[],visible=new Set<string>(),db=storage();
 for(const domain of stockServiceDomains(u)){
  const lots=(await db.prepare("SELECT l.id,l.owner,l.batch_id,l.quantity,r.payload,json_extract(receipt.data,'$.materialId') material_id,COALESCE((SELECT SUM(s.quantity) FROM service_reservations s WHERE s.lot_id=l.id),0) reserved FROM service_lots l JOIN records r ON r.id=l.batch_id LEFT JOIN flow_entities receipt ON receipt.id=l.batch_id AND receipt.type='receipt' WHERE l.domain=? AND l.quantity>0").bind(domain).all()).results as any[];
  const agents=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='as_agent' AND json_extract(data,'$.domain')=?").bind(domain).all()).results.map((r:any)=>({id:r.id,data:JSON.parse(r.data)}));
  const masters=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='material'").all()).results.map((r:any)=>({id:r.id,data:JSON.parse(r.data)}));
  for(const w of warehouses)if(w.data.serviceDomain===domain&&w.data.serviceOwner)visible.add(w.id);
  for(const l of lots){const batch=JSON.parse(l.payload),w=warehouses.find(w=>w.data.serviceDomain===domain&&w.data.serviceOwner===l.owner),m=l.material_id?masters.find(m=>m.id===l.material_id):masters.find(m=>m.data.code===batch.partCode),name=m?.data.name||batch.part||'',itemCode=m?.data.code||batch.partCode||'',center=l.owner==='office'?'دفتر شرکت':agents.find(a=>a.id===l.owner)?.data.name||'مرکز خدمات ثبت‌شده',title=domain==='home'?'خدمات خانگی':'خدمات بیمارستانی';
   entries.push({item_id:l.batch_id,serviceLotId:l.id,warehouse:'service:'+domain+':'+l.owner,warehouseId:w?.id||'',warehouseName:w?.data.name||title+' / '+center+' (بدون پیوند انبار)',locations:center,quantity:l.quantity,quality:stockQuality('service',l.quantity,undefined,batch),reserved:l.reserved,kind:'material',name,itemCode,unit:batch.unit,row:{id:l.batch_id,kind:'batch',data:{code:batch.code,part:batch.part,partCode:batch.partCode,unit:batch.unit}},passport:{title:'شناسنامه کالا',historical:!m,details:[{label:'نام کالا',value:name},{label:'کد کالا',value:itemCode},{label:'واحد',value:batch.unit},{label:'مشخصات فنی',value:m?.data.specs}],lot:[{label:'کد بچ',value:batch.code},{label:'مرکز خدمات',value:center},{label:'حوزه خدمات',value:title}]}});
  }
 }
 return {entries,warehouseIds:visible};
}
