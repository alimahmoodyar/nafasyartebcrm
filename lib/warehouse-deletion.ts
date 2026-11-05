import {storage} from './storage';
import {AccessError} from './authorization';
import {materialWarehouses} from './material-warehouses';

type Check={sql:string;args:any[];message:string};
// The same predicates run for the preview and inside the deleting transaction.
// Keep definitions as tombstones: ledger/receipt IDs and original names never change.
export async function warehouseDeletionPlan(id:string){
 const db=storage(),all=await materialWarehouses(),warehouse=all.find(w=>w.id===id);
 if(!warehouse)throw new AccessError('انبار پیدا نشد.',404);
 const targets=[warehouse,...all.filter(w=>!w.data.deletedAt&&w.data.parentId===id&&w.data.quarantineFor===id&&w.data.internalQuarantine===true&&w.data.warehouseType==='quarantine')];
 const ids=JSON.stringify(targets.map(w=>w.id)),checks:Check[]=[];
 const check=(sql:string,args:any[],message:string)=>checks.push({sql,args,message});
 check("EXISTS(SELECT 1 FROM flow_entities WHERE type='material_warehouse' AND COALESCE(json_extract(data,'$.deletedAt'),'')='' AND json_extract(data,'$.parentId') IN (SELECT value FROM json_each(?)) AND id NOT IN (SELECT value FROM json_each(?)))",[ids,ids],'این انبار زیرانبار دارد؛ ابتدا زیرانبار را منتقل یا حذف کنید.');
 check("EXISTS(SELECT 1 FROM flow_entities WHERE type='material_warehouse' AND COALESCE(json_extract(data,'$.deletedAt'),'')='' AND json_extract(data,'$.directReceiptEnabled')=1 AND json_extract(data,'$.quarantineWarehouseId') IN (SELECT value FROM json_each(?)) AND id NOT IN (SELECT value FROM json_each(?)))",[ids,ids],'این قرنطینه هنوز مسیر ورود انبار مادر است؛ ابتدا اجازه دریافت مستقیم مادر را غیرفعال کنید.');
 check("EXISTS(SELECT 1 FROM flow_slots s LEFT JOIN flow_entities r ON r.id=s.batch_id AND r.type='receipt' LEFT JOIN records b ON b.id=s.batch_id WHERE s.quantity>0 AND (CASE WHEN instr(s.location,'|')>0 THEN substr(s.location,1,instr(s.location,'|')-1) ELSE COALESCE(NULLIF(json_extract(r.data,'$.warehouseId'),''),NULLIF(json_extract(b.payload,'$.warehouseId'),''),'') END) IN (SELECT value FROM json_each(?)))",[ids],'انبار یا قرنطینه آن موجودی در محل نگهداری دارد؛ ابتدا موجودی را انتقال دهید.');
 check(`EXISTS(SELECT 1 FROM inventory_balances i LEFT JOIN flow_entities r ON r.id=i.item_id AND r.type='receipt' LEFT JOIN flow_entities f ON f.id=i.item_id AND f.type='build' LEFT JOIN records b ON b.id=i.item_id WHERE i.quantity>0 AND (
 i.warehouse IN (SELECT value FROM json_each(?)) OR
 (i.warehouse='quarantine' AND COALESCE(NULLIF(json_extract(r.data,'$.quarantineWarehouseId'),''),NULLIF(json_extract(r.data,'$.warehouseId'),''),NULLIF(json_extract(b.payload,'$.quarantineWarehouseId'),''),NULLIF(json_extract(b.payload,'$.warehouseId'),''),'') IN (SELECT value FROM json_each(?))) OR
 (i.warehouse='raw' AND i.quantity>COALESCE((SELECT SUM(s.quantity) FROM flow_slots s WHERE s.batch_id=i.item_id),0) AND COALESCE(NULLIF(json_extract(r.data,'$.warehouseId'),''),NULLIF(json_extract(b.payload,'$.warehouseId'),''),'') IN (SELECT value FROM json_each(?))) OR
 (i.warehouse='nonconforming' AND COALESCE(NULLIF(json_extract(r.data,'$.warehouseId'),''),NULLIF(json_extract(b.payload,'$.warehouseId'),''),'') IN (SELECT value FROM json_each(?))) OR
 (i.warehouse IN ('finished','reserved') AND COALESCE(NULLIF(json_extract(f.data,'$.warehouseId'),''),NULLIF(json_extract(b.payload,'$.warehouseId'),''),'') IN (SELECT value FROM json_each(?)))
 ))`,[ids,ids,ids,ids,ids],'انبار یا قرنطینه آن موجودی، کالای مردود یا محصول رزروشده دارد؛ حذف مجاز نیست.');
 check("EXISTS(SELECT 1 FROM flow_entities w JOIN service_lots l ON l.domain=json_extract(w.data,'$.serviceDomain') AND l.owner=json_extract(w.data,'$.serviceOwner') WHERE w.id IN (SELECT value FROM json_each(?)) AND (l.quantity>0 OR EXISTS(SELECT 1 FROM service_reservations s WHERE s.lot_id=l.id)))",[ids],'موجودی یا رزرو مرکز خدماتِ متصل به این انبار هنوز خالی نیست.');
 check("EXISTS(SELECT 1 FROM flow_entities w JOIN inventory_balances i ON i.warehouse='service:'||json_extract(w.data,'$.serviceDomain')||':'||json_extract(w.data,'$.serviceOwner') WHERE w.id IN (SELECT value FROM json_each(?)) AND i.quantity>0)",[ids],'مرکز خدمات متصل به انبار موجودی ثبت‌شده دارد.');
 check("EXISTS(SELECT 1 FROM flow_entities WHERE (type='receipt' AND json_extract(data,'$.state') IN ('pending_qc','awaiting_warehouse') AND (json_extract(data,'$.warehouseId') IN (SELECT value FROM json_each(?)) OR json_extract(data,'$.quarantineWarehouseId') IN (SELECT value FROM json_each(?)))) OR (type='request' AND json_extract(data,'$.state') IN ('pending','awaiting_line_receipt') AND json_extract(data,'$.warehouseId') IN (SELECT value FROM json_each(?))) OR (type='handoff' AND json_extract(data,'$.state')='pending' AND json_extract(data,'$.warehouseId') IN (SELECT value FROM json_each(?))))",[ids,ids,ids,ids],'دریافت، کنترل کیفیت، جانمایی یا تحویل باز برای این انبار وجود دارد؛ ابتدا آن را تعیین تکلیف کنید.');
 check("EXISTS(SELECT 1 FROM flow_entities WHERE type='build' AND json_extract(data,'$.warehouseId') IN (SELECT value FROM json_each(?)) AND json_extract(data,'$.state') IN ('finished','reserved','awaiting_receipt','warehouse_transit'))",[ids],'محصول یا تحویل ناتمام به این انبار وابسته است؛ ابتدا وضعیت آن را تعیین تکلیف کنید.');
 check("EXISTS(SELECT 1 FROM flow_entities t WHERE t.type='warehouse_transfer' AND (json_extract(t.data,'$.fromWarehouseId') IN (SELECT value FROM json_each(?)) OR json_extract(t.data,'$.toWarehouseId') IN (SELECT value FROM json_each(?))) AND (json_extract(t.data,'$.state')='pending' OR EXISTS(SELECT 1 FROM inventory_balances i WHERE i.warehouse='warehouse_transit:'||t.id AND i.quantity>0)))",[ids,ids],'انتقال بین انبارها هنوز در راه یا منتظر دریافت است؛ ابتدا آن را دریافت یا لغو کنید.');
 const blockers:string[]=[];for(const c of checks){const result:any=await db.prepare('SELECT '+c.sql+' AS blocked').bind(...c.args).first();if(result?.blocked)blockers.push(c.message);}
 const unlink=all.filter(w=>!w.data.deletedAt&&!targets.some(t=>t.id===w.id)&&targets.some(t=>t.id===w.data.quarantineWarehouseId));
 return {warehouse,targets,unlink,checks,review:{warehouseId:id,name:warehouse.data.name,revision:warehouse.revision,deleted:!!warehouse.data.deletedAt,canDelete:!warehouse.data.deletedAt&&!blockers.length,blockers,includes:targets.map(w=>({id:w.id,name:w.data.name}))}};
}
