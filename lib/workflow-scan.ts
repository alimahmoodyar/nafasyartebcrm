import type {Session} from './permissions';
import {AccessError} from './authorization';
import {storage} from './storage';
import {flowRole,warehouseAccess} from './material-flow';
import {warehouseDirectory,warehouseMember,canReceiveWarehouse} from './material-warehouses';
import {internalWarehouseUser} from './warehouse-custody';
import {incomingQcForLabel} from './incoming-qc';
import {warehouseTarget} from './warehouse-workspace';
import {readReturnParcels} from './service-return-parcels';
import {driverReceiptAccess,canReceiveDriverReceipt} from './driver-receipts';
import {readOfficeService,officeServiceAccess} from './service-office';
import {transportDriver} from './transport';
import {GET as packages} from '@/app/api/finished-packages/route';
import {GET as driverWorkspace} from '@/app/api/transport/driver-workspace/route';
import {parseWorkflowLabel,type ScanAction,type ScanResult} from './workflow-scan-contract';

const external=(u:Session)=>!internalWarehouseUser(u);
const nav=(id:string,title:string,section:string,target:string):ScanAction=>({id,title,kind:'navigate',section,target});
async function response(r:Response){const data:any=await r.json();if(!r.ok)throw new AccessError(data.error||'در دسترسی این حساب نیست.',r.status);return data;}
async function transferActions(u:Session,itemId:string,kind:string):Promise<ScanAction[]>{
 if(external(u)||!flowRole(u,'inventory')||!warehouseAccess(u,kind==='batch'?'raw':'finished'))return [];
 const ws=await warehouseDirectory(),ids=ws.filter(w=>w.data.active&&!w.data.deletedAt&&warehouseMember(u,w,'inventory')).map(w=>w.id);
 const rows=(await storage().prepare("SELECT id,data FROM flow_entities WHERE type='warehouse_transfer' AND json_extract(data,'$.itemId')=? AND json_extract(data,'$.state')='pending' AND (json_extract(data,'$.toWarehouseId') IN (SELECT value FROM json_each(?)) OR json_extract(data,'$.fromWarehouseId') IN (SELECT value FROM json_each(?))) ORDER BY created,id LIMIT 21").bind(itemId,JSON.stringify(ids),JSON.stringify(ids)).all()).results as any[];
 if(rows.length>20)throw new AccessError('انتقال‌های متعدد وجود دارد؛ از فهرست انتقال‌ها انتخاب کنید.',409);
 return rows.map(r=>({id:'transfer:'+r.id,title:ids.includes(JSON.parse(r.data).toWarehouseId)?'دریافت انتقال از انبار دیگر':'پیگیری انتقال به انبار دیگر',kind:'transfer',target:r.id}));
}
/** Read-only resolution. All subsequent writes still execute the owning domain's guards. */
export async function resolveWorkflowScan(u:Session,raw:string,origin:string):Promise<ScanResult>{
 let label:ReturnType<typeof parseWorkflowLabel>;try{label=parseWorkflowLabel(raw,origin)}catch(e){throw new AccessError((e as Error).message,400)}
 const db=storage(),actions:ScanAction[]=[];
 if(label.kind==='shipping'){
  const d=await response(await packages(new Request(origin+'/api/finished-packages?'+new URLSearchParams({code:label.code}))));
  actions.push({id:'shipping',title:d.pickup?.allowed?'دریافت بسته از انبار و ادامهٔ حمل':'مشاهدهٔ بسته و دریافت مقصد',kind:'shipping',code:label.code,driver:!!d.pickup?.allowed});
  return {kind:label.kind,message:'سریال‌ها و وضعیت همین بسته؛ دریافت‌های قبلی دوباره ثبت نمی‌شوند.',actions};
 }
 if(label.kind==='return'){
  const d:any=await readReturnParcels(u,new URLSearchParams({code:label.code}));
  actions.push({id:'return',title:d.canReview?'دریافت و بررسی داغی‌ها':d.canCollect?'دریافت کارتن از باربری':'وضعیت کارتن داغی',kind:'return',code:label.code,driver:transportDriver(u)&&!d.canReview,expert:!!d.canReview});
  return {kind:label.kind,message:'عملیات فقط روی اقلام همین کارتن انجام می‌شود.',actions};
 }
 if(label.kind==='receipt'){
  const r=await driverReceiptAccess(u,label.code),intake=canReceiveDriverReceipt(u,r.data.domain);
  return {kind:label.kind,message:'رسید تحویل دستگاه؛ مستقل از موجودی مواد اولیه.',actions:[{id:'receipt',title:intake?'تحویل از راننده و پذیرش دستگاه':'وضعیت رسید دستگاه',kind:'receipt',code:label.raw,intake,domain:r.data.domain}]};
 }
 if(label.kind==='batch'){
  if(external(u))throw new AccessError('این لیبل در دسترسی نقش فعلی نیست.',404);
  const bs=(await db.prepare("SELECT id FROM records WHERE kind='batch' AND json_extract(payload,'$.code')=? LIMIT 2").bind(label.code).all()).results as any[];
  if(!bs.length){const retired=await db.prepare("SELECT r.id FROM flow_entities r,json_each(r.data,'$.identityHistory') h WHERE r.type='receipt' AND json_array_length(r.data,'$.identityHistory')>0 AND json_extract(h.value,'$.from.code')=? LIMIT 1").bind(label.code).first();throw new AccessError(retired?'این لیبل باطل شده است؛ لیبل اصلاح‌شده را دریافت کنید.':'لیبل داخلی پیدا نشد؛ دریافت جدید ایجاد نشد.',retired?410:404)}
  if(bs.length!==1)throw new AccessError('کد بچ یکتا نیست؛ تعیین ردیف لازم است.',409);
  const id=bs[0].id,rs=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='receipt' AND id=? UNION ALL SELECT id,data FROM flow_entities WHERE type='receipt' AND json_extract(data,'$.batchId')=? AND id<>? LIMIT 2").bind(id,id,id).all()).results as any[];
  actions.push(...await transferActions(u,id,'batch'));
  if(rs.length>1)throw new AccessError('اتصال لیبل به رسید یکتا نیست.',409);
  if(flowRole(u,'qc')){try{const q=await incomingQcForLabel(u,label.raw,origin);if(q.receipt)actions.push(nav('qc',q.canInspect?'کنترل کیفیت همین ردیف':'وضعیت کنترل کیفیت','warehouse',warehouseTarget('flow','qc-scan:'+encodeURIComponent(label.code),'receipts')))}catch(e){if(!(e instanceof AccessError)||![403,404].includes(e.status))throw e}}
  if(rs.length&&flowRole(u,'inventory')){const r=rs[0],d=JSON.parse(r.data),ws=await warehouseDirectory(),w=ws.find(w=>w.id===d.warehouseId&&w.data.active&&!w.data.deletedAt);
   if(u.isAdmin||w&&warehouseMember(u,w,'inventory'))actions.push(nav('warehouse',d.state==='awaiting_warehouse'?'دریافت و جانمایی':d.state==='awaiting_relabel'?'تعویض لیبل اصلاح‌شده':'مشاهدهٔ ردیف دریافت و کارهای مجاز','warehouse',warehouseTarget('flow',r.id,'receipts')));
  }
  if(!actions.length)throw new AccessError('کار یا سابقهٔ مجازی برای این لیبل در نقش فعلی پیدا نشد.',404);
  return {kind:label.kind,message:'ردیف ورودی شناسایی شد؛ فقط کارهای مجاز نقش فعلی نمایش داده می‌شوند.',actions};
 }
 // Permanent device labels and legacy serials resolve to their current workflow.
 const serial=label.code;
 if(label.kind==='device'||label.kind==='unknown'&&serial.length<=160&&!/[:/\n]/.test(serial)){
  if(officeServiceAccess(u)){const d=await readOfficeService(u,new URLSearchParams({serial}));if(label.kind==='device'||d.known){const active=d.rows.filter(r=>!['closed','resolved','returned'].includes(r.state));if(active.length>1)throw new AccessError('بیش از یک پروندهٔ باز برای این سریال وجود دارد؛ پرونده را از فهرست تعمیرات انتخاب کنید.',409);actions.push(nav('office',d.activeCaseId?'پروندهٔ جاری تعمیر دستگاه':'سوابق و پذیرش دستگاه','after-sales',d.activeCaseId?'service-office:case:'+d.activeCaseId:'service-office:serial:'+encodeURIComponent(serial)));}}
  if(!external(u)&&(warehouseAccess(u,'finished')||flowRole(u,'production')||u.permissions.flowRoles?.includes('qc'))){
   const ds=(await db.prepare("SELECT id FROM records WHERE kind='device' AND json_extract(payload,'$.code')=? LIMIT 2").bind(serial).all()).results as any[];
   if(ds.length>1)throw new AccessError('سریال یکتا نیست؛ بررسی شناسنامه لازم است.',409);
   if(ds.length){const id=ds[0].id,ws=await warehouseDirectory(),ids=ws.filter(w=>w.data.active&&!w.data.deletedAt&&warehouseMember(u,w,'inventory')).map(w=>w.id);
    actions.push(...await transferActions(u,id,'device'));
    const build:any=await db.prepare("SELECT data FROM flow_entities WHERE type='build' AND id=?").bind(id).first();
    if(build){const b=JSON.parse(build.data);if(flowRole(u,'production')&&b.state==='planned')actions.push(nav('production','برگ تولید همین دستگاه','flow',id));if((u.isAdmin||u.permissions.flowRoles?.includes('qc'))&&['prepared','assembled'].includes(b.state)&&b.latestQc?.verdict!=='pass')actions.push(nav('final-qc','کنترل کیفیت محصول نهایی','flow',id));}
    const hs=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='handoff' AND EXISTS(SELECT 1 FROM json_each(data,'$.deviceIds') WHERE value=?) AND (?=1 OR json_extract(data,'$.warehouseId') IN (SELECT value FROM json_each(?))) ORDER BY created DESC,id LIMIT 21").bind(id,u.isAdmin||flowRole(u,'production')?1:0,JSON.stringify(ids)).all()).results as any[];
    if(hs.length>20)throw new AccessError('سابقهٔ تحویل متعدد است؛ از کارتابل ردیف موردنظر را انتخاب کنید.',409);
    for(const h of hs){const d=JSON.parse(h.data);if(d.pending?.includes(id)||d.shortages?.[id]&&!['lost','recovered'].includes(d.shortages[id].stage))actions.push(nav('handoff:'+h.id,'تحویل محصول نهایی · '+serial,'warehouse',warehouseTarget('fulfillment',h.id,'handoff-receive')));}
    if(!actions.length&&hs.length)actions.push(nav('handoff-history','سابقهٔ تحویل محصول نهایی','warehouse',warehouseTarget('fulfillment',hs[0].id,'handoff-receive')));
   }
  }
  if(transportDriver(u)&&!external(u)){try{const d=await response(await driverWorkspace(new Request(origin+'/api/transport/driver-workspace?'+new URLSearchParams({code:serial}))));if(d.code){const found=await resolveWorkflowScan(u,d.code,origin);actions.push(...found.actions)}}catch(e){if(!(e instanceof AccessError)||![403,404].includes(e.status))throw e}}
 }
 if(actions.length)return {kind:label.kind,message:actions.length>1?'بیش از یک کار مجاز وجود دارد؛ مسیر موردنظر را انتخاب کنید.':'کار مرتبط با دستگاه آماده است.',actions};
 if(label.kind!=='unknown')throw new AccessError('برای این شناسه در نقش فعلی کار مجازی پیدا نشد.',404);
 const known=await db.prepare("SELECT id FROM records WHERE kind IN ('device','batch','product') AND json_extract(payload,'$.code')=? UNION ALL SELECT id FROM flow_entities WHERE type='as_case' AND json_extract(data,'$.serial')=? LIMIT 1").bind(serial,serial).first();
 if(known)throw new AccessError('این کد داخلی است؛ کار مجاز یا شناسهٔ دقیق‌تر لازم است. دریافت جدید ایجاد نشد.',404);
 // Unknown supplier QR is only evidence, never an inferred item/serial/quantity.
 if(!external(u)&&flowRole(u,'inventory')){const ws=await warehouseDirectory();if(ws.some(w=>w.data.active&&!w.data.deletedAt&&canReceiveWarehouse(u,w)))return {kind:'unknown',message:'کد شناخته نشد؛ کالا، تعداد و انبار را در فرم تعیین کنید. کد خارجی فقط مرجع است.',actions:[nav('identify','دریافت و تعیین ماهیت','warehouse',warehouseTarget('flow','external-receipt:'+encodeURIComponent(label.raw),'receipts'))]};}
 throw new AccessError('کد شناخته نشد؛ دریافت و تعیین ماهیت به مسئول مجاز انبار واگذار شود.',404);
}
