import {GET as fulfillmentSnapshot} from '@/app/api/fulfillment/route';
import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {entity} from '@/lib/material-flow';
import {warehouseDirectory,warehouseMember} from '@/lib/material-warehouses';
import {internalWarehouseUser} from '@/lib/warehouse-custody';
import {salesRep,salesStaff} from '@/lib/sales';
import {defaultShippingFilters,shippingFilterError,shipmentReportRow,filterShippingRows,shippingSummary,type ShippingFilters} from '@/lib/shipping-report';
export async function GET(request:Request){try{
 const u=await requireAccess();if(!u.isAdmin&&!salesRep(u)&&!internalWarehouseUser(u))throw new AccessError('دسترسی گزارش ارسال ندارید.',403);
 const params=new URL(request.url).searchParams,filters={...defaultShippingFilters};for(const key of Object.keys(filters) as (keyof ShippingFilters)[])if(params.has(key))filters[key]=params.get(key)!;
 const invalid=shippingFilterError(filters);if(invalid)throw new AccessError(invalid,400);
 const response=await fulfillmentSnapshot();if(!response.ok)return response;const snapshot:any=await response.json(),db=storage();
 const entities=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('sales_order','transport','build')").all()).results.map(entity),warehouses=await warehouseDirectory();
 const assigned=new Set((snapshot.sales||[]).filter((s:any)=>[s.data.carrierId,'local:'+s.data.carrierId,s.data.carrierSubject].filter(Boolean).includes(u.userId)).map((s:any)=>s.id));
 const own=new Set(warehouses.filter(w=>warehouseMember(u,w,'inventory')).map(w=>w.id));
 const reports=(snapshot.sales||[]).map((s:any)=>shipmentReportRow(s,entities.find(e=>e.type==='sales_order'&&e.id===s.data.salesOrderId),entities.find(e=>e.type==='transport'&&e.id===s.data.transportId&&e.data.kind==='sale'&&e.data.sourceId===s.id),snapshot.rows||[],entities.filter(e=>e.type==='build'),warehouses)).filter((r:any)=>u.isAdmin||salesStaff(u)||salesRep(u)||snapshot.roles.logistics&&assigned.has(r.id)||r.sources.length&&r.sources.every((w:any)=>own.has(w.id))||!r.sources.length&&!!u.permissions.flowRoles?.includes('inventory'));
 const choices={products:[...new Map(reports.map((r:any)=>[r.productId,{id:r.productId,name:r.productName,code:r.productCode}])).values()].filter((p:any)=>p.id),sources:[...new Map(reports.flatMap((r:any)=>r.sources).map((w:any)=>[w.id,w])).values()],destinations:[...new Map(reports.map((r:any)=>[r.destinationId,{id:r.destinationId,name:r.destinationName}])).values()].filter((v:any)=>v.id),channels:[...new Set(reports.map((r:any)=>r.channel).filter(Boolean))]};
 const rows=filterShippingRows(reports,filters);
 return Response.json({filters,rows,summary:shippingSummary(rows),choices,notice:'گزارش بر مبنای حواله‌های ثبت‌شده سفارش است؛ دریافت تدارکات پایان ارسال نیست. کسری بسته به تعداد دستگاه تبدیل نمی‌شود؛ مقدار نامعلوم نیازمند تطبیق مقصد است.'},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'گزارش سفارش‌های ارسال دریافت نشد.'},{status:503});}}
