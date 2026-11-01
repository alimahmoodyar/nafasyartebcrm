import {GET as flowSnapshot} from '@/app/api/flow/route';
import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {warehouseAccess,entity} from '@/lib/material-flow';
import {warehouseMember} from '@/lib/material-warehouses';
import {internalWarehouseUser} from '@/lib/warehouse-custody';
import {materialStockEntries,filterWarehouseStock} from '@/lib/warehouse-stock';
export async function GET(request:Request){try{
 const u=await requireAccess();if(!internalWarehouseUser(u))throw new AccessError('دسترسی موجودی انبار ندارید.',403);
 const params=new URL(request.url).searchParams,kind=params.get('kind')||'',query=params.get('query')||'',warehouse=params.get('warehouse')||'',stage=params.get('stage')||'';
 if(!['','material','product'].includes(kind)||query.length>200||warehouse.length>200||stage.length>200)throw new AccessError('فیلتر موجودی معتبر نیست.',400);
 const snapshot=await flowSnapshot();if(!snapshot.ok)return snapshot;
 const data:any=await snapshot.json(),warehouses=(data.warehouses||[]).filter((w:any)=>u.isAdmin||warehouseMember(u,w,'inventory')),entries=materialStockEntries(data,u);
 if(warehouseAccess(u,'finished')){
  const db=storage(),builds=(await db.prepare("SELECT * FROM flow_entities WHERE type='build'").all()).results.map(entity),products=(data.rows||[]).filter((r:any)=>r.kind==='product');
  const finished=(await db.prepare("SELECT r.id,r.kind,r.payload,r.created,b.quantity FROM records r JOIN inventory_balances b ON b.item_id=r.id WHERE r.kind='device' AND b.warehouse='finished' AND b.quantity>0").all()).results;
  for(const r of finished as any[]){
   const build=builds.find(b=>b.id===r.id),d=JSON.parse(r.payload),wid=build?.data.warehouseId||'',w=warehouses.find((w:any)=>w.id===wid);
   if(wid&&!w||!wid&&!u.isAdmin)continue;
   const p=products.find((p:any)=>p.id===d.product),name=d.productName||p?.data.name||d.model||'',itemCode=d.productCode||p?.data.code||'';
   const row={id:r.id,kind:'device',created:r.created,data:{code:d.code,product:d.product||'',productName:name,productCode:itemCode,model:d.model||''}};
   entries.push({item_id:r.id,warehouse:'finished',quantity:r.quantity,row,kind:'product',name,itemCode,unit:'دستگاه',warehouseId:wid,warehouseName:w?.data.name||'سوابق بدون انبار فیزیکی',locations:''});
  }
 }
 return Response.json({warehouses,entries:filterWarehouseStock(entries,{kind,query,warehouse,stage})},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت موجودی ممکن نشد.'},{status:503});}}
