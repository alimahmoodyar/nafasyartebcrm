import {storage} from './storage';
import type {Session} from './permissions';
import {AccessError} from './authorization';
import {flowRole} from './material-flow';
import {warehouseDirectory,warehouseMember,receiptQcOwners,warehousePerson} from './material-warehouses';
import {receiptQCWarehouse} from './warehouse-receipt-policy';
import {incomingQcCode} from './incoming-qc-contract';
export async function incomingReceiptQuantity(batchId:string,quantity:number){const row:any=await storage().prepare("SELECT COALESCE(SUM(quantity),0) n FROM inventory_balances WHERE item_id=? AND warehouse='quarantine'").bind(batchId).first();return Number.isSafeInteger(quantity)&&quantity>0&&Number(row?.n||0)>=quantity;}
export async function incomingQcForLabel(u:Session,raw:string,origin:string){
 if(!flowRole(u,'qc')||!u.isAdmin&&(u.permissions.salesAgentId||u.permissions.serviceAgentId||u.permissions.hospitalCenterId||u.permissions.qmsRoles?.includes('observer')))throw new AccessError('دسترسی کنترل کیفیت ورودی لازم است.',403);
 const code=incomingQcCode(raw,origin);if(!code)throw new AccessError('لیبل بچ معتبر را اسکن کنید؛ کد کالا به‌تنهایی کافی نیست.',400);
 const db=storage(),batches=(await db.prepare("SELECT id,payload FROM records WHERE kind='batch' AND json_extract(payload,'$.code')=? LIMIT 2").bind(code).all()).results as any[];
 if(!batches.length){const retired=await db.prepare("SELECT r.id FROM flow_entities r,json_each(r.data,'$.identityHistory') h WHERE r.type='receipt' AND json_extract(h.value,'$.from.code')=? LIMIT 1").bind(code).first();throw new AccessError(retired?'این لیبل پس از اصلاح رسید باطل شده است؛ لیبل صحیح را دریافت کنید.':'بچ پیدا نشد.',retired?410:404)}
 if(batches.length!==1)throw new AccessError('شماره بچ یکتا نیست؛ مسئول سامانه بررسی کند.',409);
 const batch=batches[0],b=JSON.parse(batch.payload),batchDto={id:batch.id,code,name:b.part||b.name||'',partCode:b.partCode||'',unit:b.unit||'',quantity:b.quantity||'',day:b.date||''};
 const rows=(await db.prepare("SELECT id,data,revision FROM flow_entities WHERE type='receipt' AND (id=? OR json_extract(data,'$.batchId')=?) LIMIT 2").bind(batch.id,batch.id).all()).results as any[];
 if(rows.length>1)throw new AccessError('ردیف رسید این بچ نیازمند بررسی است.',409);
 if(!rows.length)return {batch:batchDto,receipt:null,canInspect:false,reason:'awaiting_receipt',message:'در انتظار تکمیل دریافت انبار'};
 const r=rows[0],d=JSON.parse(r.data);if(r.id!==batch.id||d.batchId&&d.batchId!==batch.id)throw new AccessError('اتصال بچ به ردیف رسید نیازمند بررسی است.',409);const warehouses=await warehouseDirectory(),w=receiptQCWarehouse({data:d},warehouses);
 const owners=w?receiptQcOwners({data:d},w):[d.qcOwner].filter(Boolean);
 const allowed=u.isAdmin||w&&w.data.active&&warehouseMember(u,{...w,qcMembers:w.qcMembers.filter((m:any)=>owners.includes(m.id))},'qc')||!d.warehouseId&&!!u.permissions.flowRoles?.includes('qc')&&owners.length===1&&warehousePerson(u,owners[0]);
 if(!allowed)throw new AccessError('این ردیف ورودی در مسئولیت کنترل کیفیت شما نیست.',404);
 const completed=['stored','awaiting_relabel','awaiting_warehouse','rejected'].includes(d.state),received=['pending_qc','awaiting_qc_template'].includes(d.state)&&await incomingReceiptQuantity(d.batchId||r.id,d.quantity);
 const reason=completed?'completed':!received?'awaiting_receipt':!d.fields?.length||d.state==='awaiting_qc_template'?'awaiting_template':'ready';
 const message={completed:'کنترل کیفیت این ردیف قبلاً ثبت شده است؛ نتیجه و مرحلهٔ جاری نمایش داده می‌شود.',awaiting_receipt:'در انتظار تکمیل دریافت انبار',awaiting_template:'در انتظار تعریف فرم کنترل کیفیت توسط مسئول فنی',ready:'فرم کنترل کیفیت همین ردیف ورودی آماده است.'}[reason];
 return {batch:batchDto,receipt:{id:r.id,type:'receipt',revision:r.revision,data:{batchId:d.batchId||r.id,materialId:d.materialId,state:d.state,fields:d.fields||[],specs:d.specs||'',quantity:d.quantity,accepted:d.accepted||0,rejected:d.rejected||0,day:d.day,warehouseId:d.warehouseId,quarantineWarehouseId:d.quarantineWarehouseId,canInspect:reason==='ready',canWarehouseAct:false,qc:d.qc||null}},canInspect:reason==='ready',reason,message};
}
