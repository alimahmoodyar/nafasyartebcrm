import {stockQuality} from './stock-quality';
import {warehouseDescendants} from './warehouse-tree';
import type {Session} from './permissions';
export const normalizeStockSearch=(s:string)=>String(s||'').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\u200c/g,' ').trim();
export function filterWarehouseStock(entries:any[],filters:{kind?:string;query?:string;warehouse?:string;stage?:string;includeChildren?:boolean},warehouses:any[]=[]){
 const scope=filters.warehouse?filters.includeChildren===false?new Set([filters.warehouse]):warehouseDescendants(warehouses,filters.warehouse):null;
 const words=normalizeStockSearch(filters.query||'').split(/\s+/).filter(Boolean);
 return entries.filter(e=>(!filters.kind||e.kind===filters.kind)&&(!scope||scope.has(e.warehouseId))&&(!filters.stage||e.warehouse===filters.stage)&&words.every(word=>normalizeStockSearch([e.name,e.itemCode,e.row.data.code,e.row.data.model,e.locations].join(' ')).includes(word)));
}
// Group only already-authorized and filtered entries. Never add unlike units or
// merge unidentified items by their display name.
export function groupWarehouseStock(entries:any[]){
 const groups=new Map<string,any>();
 for(const e of entries){
  const identity=e.itemCode?.trim()?['code',normalizeStockSearch(e.itemCode)]:['item',e.item_id];
  const key=JSON.stringify([e.kind,...identity,e.unit||'']);
  let group=groups.get(key);
  if(!group){group={key,grouped:true,kind:e.kind,name:e.name,itemCode:e.itemCode,unit:e.unit,passport:e.passport?{...e.passport,lot:[]}:undefined,quantity:0,usable:0,pending:0,rejected:0,reserved:0,available:0,entries:[],lotCount:0};groups.set(key,group);}
  const quality=e.quality||stockQuality(e.warehouse,e.quantity,undefined,e.row);group.quantity+=e.quantity;group.usable+=quality.usable;group.pending+=quality.pending;group.rejected+=quality.rejected;group.reserved+=e.reserved||0;group.available+=Math.max(0,quality.usable-(e.reserved||0));group.entries.push({...e,quality});
 }
 for(const group of groups.values())group.lotCount=new Set(group.entries.map((e:any)=>e.row.id)).size;
 return [...groups.values()];
}
// Material visibility follows the existing flow snapshot and physical slot custody.
export function materialStockEntries(data:any,user:Session){
 const warehouses=(data.warehouses||[]).filter((w:any)=>user.isAdmin||(w.inventoryMembers||[]).some((m:any)=>[m.id,'local:'+m.id,m.subject].filter(Boolean).includes(user.userId))),receipts=(data.entities||[]).filter((e:any)=>e.type==='receipt'),materials=(data.entities||[]).filter((e:any)=>e.type==='material'),rows=data.rows||[];
 return (data.balances||[]).filter((b:any)=>b.quantity>0&&!String(b.warehouse).startsWith('service:')&&(user.isAdmin||(data.warehouseIds||[]).includes(b.warehouse))).flatMap((b:any)=>{
  const row=rows.find((r:any)=>r.id===b.item_id);if(!row||row.kind!=='batch')return [];
  const receipt=receipts.find((r:any)=>r.id===row.id),material=receipt?.data.materialId?materials.find((m:any)=>m.id===receipt.data.materialId):materials.find((m:any)=>m.data.code===row.data.partCode);
  const passport={title:'شناسنامه کالا',materialId:material?.id||'',historical:!material,details:[{label:'نام کالا',value:material?.data.name||row.data.part},{label:'کد کالا',value:material?.data.code||row.data.partCode},{label:'واحد',value:material?.data.unit||row.data.unit},{label:'مشخصات فنی / نقشه مرجع',value:material?.data.specs}],lot:[{label:'کد بچ',value:row.data.code},{label:'مشخصات این بچ',value:row.data.specs||receipt?.data.specs},{label:'تأمین‌کننده',value:row.data.supplier},{label:'سازنده',value:row.data.maker},{label:'لات سازنده',value:row.data.manufacturerLot}]};
  const common={...b,quality:stockQuality(b.warehouse,b.quantity,receipt,row),row,passport,kind:'material',name:material?.data.name||row.data.part||'',itemCode:material?.data.code||row.data.partCode||'',unit:row.data.unit};
  if(b.warehouse==='raw'&&(data.slots||[]).some((s:any)=>s.batch_id===row.id))return data.slots.filter((s:any)=>s.batch_id===row.id&&s.quantity>0).flatMap((s:any)=>{const wid=s.location.includes('|')?s.location.slice(0,s.location.indexOf('|')):receipt?.data.warehouseId||row.data.warehouseId||'',w=warehouses.find((w:any)=>w.id===wid);if(wid&&!w)return [];return [{...common,quantity:s.quantity,quality:stockQuality(b.warehouse,s.quantity,receipt,row),warehouseId:wid,warehouseName:w?.data.name||'سوابق بدون انبار فیزیکی',locations:s.location.includes('|')?s.location.slice(s.location.indexOf('|')+1):s.location}];});
  const stored=['raw','quarantine'].includes(b.warehouse),w=stored?warehouses.find((w:any)=>w.id===(receipt?.data.warehouseId||row.data.warehouseId)):undefined;
  if(stored&&(receipt?.data.warehouseId||row.data.warehouseId)&&!w)return [];
  return [{...common,warehouseId:w?.id||'',warehouseName:w?.data.name||(stored?'سوابق بدون انبار فیزیکی':'محل فیزیکی جداگانه ثبت نشده'),locations:''}];
 });
}
