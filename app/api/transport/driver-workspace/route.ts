import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {transportDriver} from '@/lib/transport';
import {memberId} from '@/lib/duties';
import {storage} from '@/lib/storage';
import {normalizeTransportScan} from '@/lib/transport-scan-contract';
import {shippingQr} from '@/lib/shipping-packages';
import {returnCartonQr,returnParcelStates} from '@/lib/service-return-parcel-contract';
import {driverReceiptQr,driverReceiptStates} from '@/lib/driver-receipt-contract';
import {transportStates} from '@/lib/transport-contract';
async function get(request:Request){try{
 const u=await requireAccess();if(!transportDriver(u)&&!u.isAdmin)throw new AccessError('دسترسی راننده ندارید.',403);
 const mid=await memberId(u),q=new URL(request.url).searchParams,view=q.get('view')||'active',search=(q.get('q')||'').trim(),page=Number(q.get('page')||1);
 if(!['active','history','work'].includes(view)||search.length>100||!Number.isInteger(page)||page<1||page>500)throw new AccessError('فیلتر معتبر نیست.',400);
 const db=storage();
 if(q.has('code')){const code=normalizeTransportScan(q.get('code')||'');if(!code)throw new AccessError('کد معتبر نیست.',400);const matches=(await db.prepare("SELECT f.id AS saleId,json_extract(p.value,'$.id') AS packageId FROM flow_entities f,json_each(f.data,'$.shippingPackages') p,json_each(p.value,'$.deviceIds') i JOIN records r ON r.id=i.value AND r.kind='device' WHERE f.type='sale' AND json_extract(f.data,'$.state')='in_transit' AND (json_extract(f.data,'$.carrierId')=? OR json_extract(f.data,'$.carrierSubject')=?) AND upper(json_extract(r.payload,'$.code'))=? ORDER BY f.id LIMIT 2").bind(mid,u.userId,code).all()).results as any[];if(matches.length!==1)throw new AccessError(matches.length?'این سریال چند مرجع دارد؛ QR بسته را اسکن کنید.':'کد در بسته‌های مجاز شما پیدا نشد؛ برای دستگاه فاقد برچسب از دریافت بدون کد استفاده کنید.',404);return Response.json({kind:'product',code:shippingQr(matches[0].saleId,matches[0].packageId)},{headers:{'Cache-Control':'private, no-store'}});}
 const preview=u.profileReview?.id==='driver'?u.profileReview.missionId||'':'';
 const cte=`WITH owned AS (
 SELECT f.id AS key,f.id AS sourceId,'receipt' AS kind,f.data AS payload,NULL AS part,f.updated AS at,CASE WHEN json_extract(f.data,'$.state')='with_driver' THEN 'active' ELSE 'history' END AS bucket
 FROM flow_entities f WHERE f.type='transport_receipt' AND json_extract(f.data,'$.driverId')=?
 UNION ALL
 SELECT f.id||':'||json_extract(c.value,'$.id'),f.id,'return',f.data,c.value,f.updated,CASE WHEN json_extract(c.value,'$.state') IN ('with_driver','office_partial') THEN 'active' ELSE 'history' END
 FROM flow_entities f,json_each(f.data,'$.cartons') c WHERE f.type='as_return_parcel' AND json_extract(c.value,'$.driverId')=?
 UNION ALL
 SELECT f.id||':'||json_extract(p.value,'$.id'),f.id,'product',f.data,p.value,f.updated,CASE WHEN json_extract(f.data,'$.state') IN ('delivered','consignment_received') OR json_extract(m.data,'$.state') IN ('carrier','delivered') THEN 'history' ELSE 'active' END
 FROM flow_entities f,json_each(f.data,'$.shippingPackages') p LEFT JOIN flow_entities m ON m.id=json_extract(f.data,'$.transportId') AND m.type='transport'
 WHERE f.type='sale' AND (json_extract(f.data,'$.carrierId')=? OR json_extract(f.data,'$.carrierSubject')=?) AND EXISTS(SELECT 1 FROM json_each(p.value,'$.deviceIds') d JOIN json_each(f.data,'$.acknowledgedDeviceIds') a ON d.value=a.value)
 UNION ALL
 SELECT f.id,f.id,'mission',f.data,NULL,f.updated,CASE WHEN json_extract(f.data,'$.state') IN ('delivered','cancelled') THEN 'history' ELSE 'work' END
 FROM flow_entities f WHERE f.type='transport' AND (json_extract(f.data,'$.driverId')=? OR f.id=? AND ?<>'')
 )`;
 const args=[mid,mid,mid,u.userId,mid,preview,preview],stats:any=await db.prepare(cte+" SELECT SUM(bucket='active') active,SUM(bucket='work') work,SUM(bucket='history') history FROM owned").bind(...args).first();
 const searchText=`COALESCE(json_extract(payload,'$.code'),'')||' '||CASE WHEN kind='product' THEN COALESCE(json_extract(payload,'$.packageOrderCode'),'')||' '||COALESCE(json_extract(payload,'$.packageRecipient.name'),'')||' '||COALESCE(json_extract(part,'$.model'),'')||' '||COALESCE((SELECT group_concat(json_extract(part,'$.serials['||i.key||']'),' ') FROM json_each(part,'$.deviceIds') i WHERE EXISTS(SELECT 1 FROM json_each(payload,'$.acknowledgedDeviceIds') a WHERE a.value=i.value)),'') WHEN kind='receipt' THEN COALESCE(json_extract(payload,'$.serial'),'')||' '||COALESCE(json_extract(payload,'$.model'),'')||' '||COALESCE(json_extract(payload,'$.sender'),'')||' '||COALESCE(json_extract(payload,'$.waybill'),'') WHEN kind='return' THEN COALESCE(json_extract(payload,'$.sender.name'),'')||' '||COALESCE(json_extract(payload,'$.tracking'),'')||' '||COALESCE(part,'') ELSE COALESCE(json_extract(payload,'$.recipient'),'')||' '||COALESCE(json_extract(payload,'$.destination'),'')||' '||COALESCE(json_extract(payload,'$.waybill'),'') END`;
 const filter=" bucket=? AND (?='' OR instr(lower("+searchText+"),lower(?))>0)",params=[...args,view,search,search],count:any=await db.prepare(cte+' SELECT COUNT(*) n FROM owned WHERE '+filter).bind(...params).first(),pages=Math.max(1,Math.ceil(count.n/20)),current=Math.min(page,pages);
 const rows=(await db.prepare(cte+' SELECT * FROM owned WHERE '+filter+' ORDER BY at DESC,key LIMIT 20 OFFSET ?').bind(...params,(current-1)*20).all()).results.map((r:any)=>{const d=JSON.parse(r.payload),p=r.part?JSON.parse(r.part):null;
 if(r.kind==='receipt')return {id:r.key,kind:r.kind,title:d.model||'دستگاه دریافتی',code:d.code,state:driverReceiptStates[d.state]||d.state,party:d.sender,serials:[d.serial].filter(Boolean),qr:driverReceiptQr(r.sourceId)};
 if(r.kind==='return')return {id:r.key,kind:r.kind,title:'کارتن داغی '+p.number,code:d.code,state:returnParcelStates[p.state]||p.state,party:d.sender?.name,serials:[...new Set(p.items.map((i:any)=>i.serial))],qr:returnCartonQr(r.sourceId,p.id)};
 if(r.kind==='product'){const received=p.deviceIds.filter((id:string)=>d.acknowledgedDeviceIds.includes(id));return {id:r.key,kind:r.kind,title:'بسته '+p.number+' · '+p.model,code:d.packageOrderCode||r.sourceId,state:r.bucket==='active'?'نزد من':'تحویل‌شده',party:d.packageRecipient?.name,serials:p.serials.filter((_:string,i:number)=>received.includes(p.deviceIds[i])),qr:shippingQr(r.sourceId,p.id)};}
 return {id:r.sourceId,kind:r.kind,title:d.recipient||'مأموریت حمل',code:d.code,state:transportStates[d.state]||d.state,party:d.destination,serials:[],missionId:r.sourceId};});
 return Response.json({rows,view,page:current,pages,total:count.n,counts:{active:stats.active||0,work:stats.work||0,history:stats.history||0}},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'فهرست کارهای راننده دریافت نشد.'},{status:503});}}
export const GET=withServiceRolePreview(get);
