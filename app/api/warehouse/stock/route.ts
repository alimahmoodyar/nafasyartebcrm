import {materialWarehouses} from '@/lib/material-warehouses';
import {serviceWarehouseStock,stockServiceDomains} from '@/lib/service-warehouse-stock';
import {recordFields} from '@/lib/model';
import {GET as flowSnapshot} from '@/app/api/flow/route';
import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {warehouseAccess,entity} from '@/lib/material-flow';
import {warehouseMember} from '@/lib/material-warehouses';
import {internalWarehouseUser} from '@/lib/warehouse-custody';
import {materialStockEntries,filterWarehouseStock,groupWarehouseStock} from '@/lib/warehouse-stock';
export async function GET(request:Request){try{
 const u=await requireAccess();if(!internalWarehouseUser(u))throw new AccessError('دسترسی موجودی انبار ندارید.',403);
 const params=new URL(request.url).searchParams,kind=params.get('kind')||'',query=params.get('query')||'',warehouse=params.get('warehouse')||'',stage=params.get('stage')||'';
 if(!['','material','product'].includes(kind)||query.length>200||warehouse.length>200||stage.length>200)throw new AccessError('فیلتر موجودی معتبر نیست.',400);
 const includeChildren=params.get('includeChildren')!=='false';if(params.has('includeChildren')&&!['true','false'].includes(params.get('includeChildren')!))throw new AccessError('فیلتر زیرانبار معتبر نیست.',400);
 const snapshot=await flowSnapshot();if(!snapshot.ok&&(snapshot.status!==403||!stockServiceDomains(u).length))return snapshot;
 const data:any=snapshot.ok?await snapshot.json():{},allWarehouses=await materialWarehouses(),warehouses=(data.warehouses||[]).filter((w:any)=>u.isAdmin||warehouseMember(u,w,'inventory')),entries=materialStockEntries(data,u);
 const service=await serviceWarehouseStock(u,allWarehouses);entries.push(...service.entries);
 const visibleIds=new Set<string>([...warehouses.map((w:any)=>w.id),...service.warehouseIds]);
 // Add only ancestor labels for grouping; parent visibility grants no child stock.
 for(const id of [...visibleIds]){let w=allWarehouses.find(w=>w.id===id);const seen=new Set<string>();while(w?.data.parentId&&!seen.has(w.id)){seen.add(w.id);const parent=allWarehouses.find(v=>v.id===w.data.parentId);if(!parent)break;visibleIds.add(parent.id);w=parent;}}
 const directory=allWarehouses.filter(w=>visibleIds.has(w.id)).map(w=>({id:w.id,data:{name:w.data.name,parentId:w.data.parentId||'',active:w.data.active}}));
 if(warehouseAccess(u,'finished')){
  const db=storage(),builds=(await db.prepare("SELECT * FROM flow_entities WHERE type='build'").all()).results.map(entity),products=(data.rows||[]).filter((r:any)=>r.kind==='product');
  const finished=(await db.prepare("SELECT r.id,r.kind,r.payload,r.created,b.quantity FROM records r JOIN inventory_balances b ON b.item_id=r.id WHERE r.kind='device' AND b.warehouse='finished' AND b.quantity>0").all()).results;
  for(const r of finished as any[]){
   const build=builds.find(b=>b.id===r.id),d=JSON.parse(r.payload),wid=build?.data.warehouseId||'',w=warehouses.find((w:any)=>w.id===wid);
   if(wid&&!w||!wid&&!u.isAdmin)continue;
   const p=products.find((p:any)=>p.id===d.product),name=p?.data.name||d.productName||d.model||'',itemCode=p?.data.code||d.productCode||'';
   const row={id:r.id,kind:'device',created:r.created,data:{code:d.code,product:d.product||'',productName:name,productCode:itemCode,model:d.model||''}};
   const passport={title:'شناسنامه محصول',historical:!p,details:p?recordFields('product',p.data).map(f=>({label:f.label,value:f.optionLabels?.[p.data[f.key]]||p.data[f.key]})):[{label:'نام محصول هنگام تولید',value:name},{label:'کد محصول هنگام تولید',value:itemCode}],lot:[{label:'سریال دستگاه',value:d.code},{label:'مدل دستگاه هنگام تولید',value:d.model},{label:'نسخه طراحی',value:d.design},{label:'نسخه نرم‌افزار',value:d.firmware}]};
   entries.push({passport,item_id:r.id,warehouse:'finished',quality:{usable:r.quantity,pending:0,rejected:0},quantity:r.quantity,row,kind:'product',name,itemCode,unit:'دستگاه',warehouseId:wid,warehouseName:w?.data.name||'سوابق بدون انبار فیزیکی',locations:''});
  }
 }
 const filtered=filterWarehouseStock(entries,{kind,query,warehouse,stage,includeChildren},directory);
 return Response.json({warehouses:directory,entries:filtered,groups:groupWarehouseStock(filtered)},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت موجودی ممکن نشد.'},{status:503});}}
