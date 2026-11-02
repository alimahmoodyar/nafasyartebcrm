import {requireAccess,can,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {warehouseDirectory,warehouseMember} from '@/lib/material-warehouses';
import {slotWarehouse,internalWarehouseUser} from '@/lib/warehouse-custody';
import {warehouseAccess,flowRole,entity} from '@/lib/material-flow';
import {historyMatch,ledgerMovements} from '@/lib/warehouse-history';
import {GET as stockSnapshot} from '@/app/api/warehouse/stock/route';
export async function GET(request:Request){try{
 const u=await requireAccess(),materialRead=can(u,'batch','read')||flowRole(u,'inventory')||flowRole(u,'qc'),productRead=warehouseAccess(u,'finished');
 if(!internalWarehouseUser(u)||!materialRead&&!productRead)throw new AccessError('دسترسی گردش کالا ندارید.',403);
 const p=new URL(request.url).searchParams,filter={query:p.get('query')||'',code:p.get('code')||'',kind:p.get('kind')||'',itemId:p.get('itemId')||''};
 if(Object.values(filter).some(v=>v.length>200)||!['','material','product'].includes(filter.kind))throw new AccessError('جست‌وجوی گردش کالا معتبر نیست.',400);
 const db=storage(),ws=await warehouseDirectory(),own=new Set(ws.filter(w=>w.data.active&&(warehouseMember(u,w,'inventory')||warehouseMember(u,w,'qc'))).map(w=>w.id)),names=new Map(ws.map(w=>[w.id,w.data.name]));
 const globalRead=u.isAdmin||materialRead&&!u.permissions.warehouseResponsibilities?.length;
 const all=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('receipt','request','build','warehouse_transfer','material')").all()).results.map(entity),byId=new Map(all.map(e=>[e.id,e]));
 const rows=(await db.prepare("SELECT id,kind,payload,created FROM records WHERE kind IN ('batch','device','product') ORDER BY created DESC,id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.payload)}));
 const slots=(await db.prepare('SELECT * FROM flow_slots WHERE quantity>0').all()).results as any[];
 const ledger=(await db.prepare('SELECT e.id,e.operation_id,e.item_id,e.warehouse,e.delta,o.kind,o.payload,o.created,o.rowid AS sequence FROM inventory_entries e JOIN inventory_operations o ON o.id=e.operation_id ORDER BY o.rowid,e.id').all()).results as any[];
 const visible=new Map<string,any[]>();
 for(const e of ledger){
  const b=JSON.parse(e.payload),transfer=b.transferId?byId.get(b.transferId):byId.get(e.operation_id),physical:string[]=[];
  const add=(id:any)=>{if(typeof id==='string'&&id&&!physical.includes(id))physical.push(id)};
  if(e.kind.startsWith('warehouse_')&&transfer?.type==='warehouse_transfer'){add(transfer.data.fromWarehouseId);add(transfer.data.toWarehouseId);}
  else{for(const a of Array.isArray(b.allocations)?b.allocations:[])if(a.batchId===e.item_id||a.batch===e.item_id)add(slotWarehouse(a.location||''));if(!physical.length){add(b.warehouseId);add(b.fromWarehouseId);add(b.toWarehouseId);if(b.receiptId)add(byId.get(b.receiptId)?.data.warehouseId);if(b.requestId)add(byId.get(b.requestId)?.data.warehouseId);}}
  const rawStage=e.warehouse.startsWith('warehouse_transit:')?byId.get(e.warehouse.slice(18))?.data.kind==='device'?'finished':'raw':e.warehouse;
  const stageAllowed=u.isAdmin||warehouseAccess(u,rawStage)||materialRead&&!!u.permissions.flowRoles?.some(r=>['qc','production','procurement'].includes(r))||materialRead&&!!u.permissions.warehouseResponsibilities?.some(r=>r.role==='qc');
  if(!stageAllowed||!u.isAdmin&&(physical.length?e.kind.startsWith('warehouse_')?!physical.some(id=>own.has(id)):!physical.every(id=>own.has(id)):!globalRead))continue;
  const list=visible.get(e.item_id)||[];list.push({...e,physical,payload:undefined});visible.set(e.item_id,list);
 }
 let current:any[]=[];const stock=await stockSnapshot(new Request(new URL('/api/warehouse/stock',request.url)));if(stock.ok)current=(await stock.json() as any).entries;
 const items:any[]=[];
 for(const r of rows){
  if(r.kind==='product'||r.kind==='batch'&&!materialRead||r.kind==='device'&&!productRead)continue;
  const kind=r.kind==='batch'?'material':'product',receipt=byId.get(r.id),events=visible.get(r.id)||[],balance=current.filter(e=>e.row.id===r.id),physical=receipt?.data.warehouseId||r.data.warehouseId||'';
  const belongs=u.isAdmin||events.length||balance.length||!!physical&&own.has(physical)||slots.some(s=>s.batch_id===r.id&&own.has(slotWarehouse(s.location,physical)))||!physical&&globalRead&&r.kind==='batch';
  if(!belongs)continue;
  const master=kind==='material'?(receipt?.data.materialId?byId.get(receipt.data.materialId):all.find(e=>e.type==='material'&&e.data.code===r.data.partCode)):rows.find(v=>v.kind==='product'&&v.id===r.data.product);
  const item={id:r.id,kind,name:master?.data.name||(kind==='material'?r.data.part:r.data.productName||r.data.model)||'',itemCode:master?.data.code||(kind==='material'?r.data.partCode:r.data.productCode)||'',code:r.data.code||'',unit:r.data.unit||(kind==='product'?'دستگاه':''),quantity:balance.length?balance.reduce((n,e)=>n+e.quantity,0):events.length&&stock.ok?0:null};
  if(!historyMatch(item,filter))continue;
  items.push({...item,...(filter.itemId?{movements:ledgerMovements(events,names)}:{})});
 }
 if(filter.itemId&&!items.length)throw new AccessError('سابقهٔ کالا در دسترسی شما یافت نشد.',404);
 return Response.json({items},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت گردش کالا ممکن نشد.'},{status:503});}}
