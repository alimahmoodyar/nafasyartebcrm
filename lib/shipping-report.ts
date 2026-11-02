import {isIsoDay,localDay} from './persian-date';
import {normalizeStockSearch} from './warehouse-stock';
export const shippingStatuses:Record<string,string>={all:'همه',open:'باز',reserved:'آماده ارسال',in_transit:'در مسیر',partial:'دریافت ناقص / مغایرت',closed:'بسته‌شده',cancelled:'لغوشده'};
export const shippingDateTypes:Record<string,string>={order:'ثبت سفارش',dispatch:'خروج از انبار',receipt:'دریافت مقصد'};
export type ShippingFilters={query:string;productId:string;sourceId:string;destinationId:string;channel:string;status:string;dateType:string;from:string;to:string};
export const defaultShippingFilters:ShippingFilters={query:'',productId:'',sourceId:'',destinationId:'',channel:'',status:'open',dateType:'order',from:'',to:''};
export function shippingFilterError(f:ShippingFilters){
 if(!Object.hasOwn(shippingStatuses,f.status)||!Object.hasOwn(shippingDateTypes,f.dateType))return 'وضعیت یا نوع تاریخ معتبر نیست.';
 if(Object.values(f).some(v=>typeof v!=='string'||v.length>200))return 'فیلتر گزارش معتبر نیست.';
 if(f.from&&!isIsoDay(f.from)||f.to&&!isIsoDay(f.to))return 'بازه تاریخ معتبر انتخاب کنید.';
 if(f.from&&f.to&&f.from>f.to)return 'تاریخ شروع نباید بعد از پایان باشد.';
 return '';
}
export function shipmentReportRow(s:any,o:any,t:any,rows:any[],builds:any[],warehouses:any[]){
 const d=s.data,od=o?.data||{},td=t?.data||{},product=rows.find(r=>r.id===d.productId&&r.kind==='product')?.data||{},deviceIds:string[]=d.deviceIds||[];
 const serials=deviceIds.map(id=>rows.find(r=>r.id===id)?.data.code||id);
 const sourceIds:string[]=Array.from(new Set<string>(d.sourceWarehouses?.map((w:any)=>w.id)||(d.state==='reserved'?deviceIds.map(id=>builds.find(b=>b.id===id)?.data.warehouseId||'').filter(Boolean):[])));
 const sources=sourceIds.map(id=>({id,name:d.sourceWarehouses?.find((w:any)=>w.id===id)?.name||warehouses.find(w=>w.id===id)?.data.name||'انبار ثبت‌شده'}));
 // A driver's acknowledgement is pickup only, never destination receipt.
 const complete=['delivered','consignment_received'].includes(d.state)||td.state==='delivered'&&td.receipt?.result==='complete';
 const disputed=!complete&&(td.state==='disputed'||td.receipt&&td.receipt.result!=='complete');
 const status=d.state==='cancelled'?'cancelled':complete?'closed':disputed?'partial':d.state==='reserved'?'reserved':'in_transit';
 const quantity=Number(d.count??deviceIds.length),received=status==='closed'?quantity:status==='partial'?null:0,remaining=status==='cancelled'?0:received===null?null:quantity-received;
 const orderDay=o?.created?localDay(o.created):'',dispatchDay=d.dispatchedAt?localDay(d.dispatchedAt):'',receiptDay=td.receipt?.day||(complete?localDay(d.deliveredAt||td.deliveredAt||''):'');
 const timeline:any[]=[];const event=(title:string,at:string,by='',notes='')=>{if(at)timeline.push({title,at,by,notes});};
 event('ثبت سفارش',o?.created,od.submission?.actorName||od.history?.[0]?.actorName||'');event('رزرو و ایجاد حواله',s.created,d.by||'');event('خروج از انبار',d.dispatchedAt,d.dispatchedBy||'');event('دریافت تدارکات از انبار',td.collectedDay||d.acknowledgedAt,d.acknowledgedBy||'');event('تحویل به باربری',td.carrierDay,td.carrier||'');event('عرضه به مقصد',td.offeredDay,td.handoverTo||'');event('اعلام دریافت مقصد',td.receipt?.day,td.receipt?.byName||'',td.receipt?.notes||'');if(complete&&!td.receipt)event('دریافت کامل مقصد',d.deliveredAt||td.deliveredAt,d.deliveredBy||'');
 return {id:s.id,orderId:d.salesOrderId||'',orderCode:od.code||d.salesOrderId||'',shipmentCode:d.code||s.id,productId:d.productId||'',productCode:product.code||'',productName:product.name||'',serials,sources,destinationId:d.salesAgentId||d.partyId||'',destinationName:d.recipient?.name||'',destinationAddress:d.recipient?.address||'',pickup:td.pickup||'',destination:td.destination||d.recipient?.address||'',channel:od.submission?.channel||'',submittedBy:od.submission?.actorName||'',requestDay:od.submission?.day||'',requestReference:od.submission?.reference||'',orderDay,dispatchDay,receiptDay,status,quantity,received,remaining,transportCode:td.code||'',transportState:td.state||'',carrier:td.carrier||d.carrierName||'',waybill:td.waybill||'',tracking:td.tracking||'',receiptResult:td.receipt?.result||'',receiptReference:d.receiptReference||'',notes:d.notes||'',timeline};
}
export function filterShippingRows(rows:any[],f:ShippingFilters){
 const words=normalizeStockSearch(f.query).split(/\s+/).filter(Boolean);
 return rows.filter(r=>{
 const day=f.dateType==='dispatch'?r.dispatchDay:f.dateType==='receipt'?r.receiptDay:r.orderDay;
 return (!f.productId||r.productId===f.productId)&&(!f.sourceId||r.sources.some((w:any)=>w.id===f.sourceId))&&(!f.destinationId||r.destinationId===f.destinationId)&&(!f.channel||r.channel===f.channel)&&(f.status==='all'||(f.status==='open'?!['closed','cancelled'].includes(r.status):r.status===f.status))&&(!f.from||!!day&&day>=f.from)&&(!f.to||!!day&&day<=f.to)&&words.every(w=>normalizeStockSearch([r.orderCode,r.orderId,r.shipmentCode,r.id,...r.serials,r.productCode,r.productName,r.destinationName,r.transportCode,r.waybill,r.tracking,r.requestReference].join(' ')).includes(w));
 });
}
export function shippingSummary(rows:any[]){
 const products=new Map<string,any>();
 for(const r of rows){const key=r.productId||r.productCode||r.id;let p=products.get(key);if(!p){p={productId:r.productId,code:r.productCode,name:r.productName,quantity:0,received:0,remaining:0,unresolvedShipments:0};products.set(key,p);}if(r.status==='cancelled')continue;p.quantity+=r.quantity;if(r.received===null)p.unresolvedShipments++;else{p.received+=r.received;p.remaining+=r.remaining;}}
 return {orders:new Set(rows.map(r=>r.orderId||r.id)).size,shipments:rows.length,open:rows.filter(r=>!['closed','cancelled'].includes(r.status)).length,closed:rows.filter(r=>r.status==='closed').length,products:[...products.values()]};
}
