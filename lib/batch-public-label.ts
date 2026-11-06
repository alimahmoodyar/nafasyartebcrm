import {batchLabelContext} from './batch-label-context';
import {storage} from './storage';
import {AccessError} from './authorization';
import {receiptDay} from './batch-number';
/** Explicit public label projection. Public default/current location and catalog reference photo are explicitly approved; no stock quantities, QC results, supplier, notes or purchase data. */
export async function publicBatchLabel(code:string){
 if(!code||code.length>100||/[\x00-\x1f\x7f]/.test(code))throw new AccessError('شماره بچ معتبر نیست.',400);
 const rows=(await storage().prepare("SELECT id,json_extract(payload,'$.code') code,json_extract(payload,'$.part') name,json_extract(payload,'$.partCode') partCode,json_extract(payload,'$.date') day,json_extract(payload,'$.quantity') quantity,json_extract(payload,'$.unit') unit,json_extract(payload,'$.expiry') expiry FROM records WHERE kind='batch' AND json_extract(payload,'$.code')=? LIMIT 2").bind(code).all()).results as any[];
 if(!rows.length){const retired=await storage().prepare("SELECT r.id FROM flow_entities r,json_each(r.data,'$.identityHistory') h WHERE r.type='receipt' AND json_extract(h.value,'$.from.code')=? LIMIT 1").bind(code).first();if(retired)throw new AccessError('این لیبل پس از اصلاح رسید باطل شده است؛ لیبل صحیح را از مسئول انبار دریافت کنید.',410);throw new AccessError('بچ پیدا نشد.',404);}if(rows.length!==1)throw new AccessError('شناسه بچ نیازمند بررسی مسئول سامانه است.',409);
 const r=rows[0],day=(v:string)=>{try{return receiptDay(v).display}catch{return v||''}};
 const context=await batchLabelContext(r.id,r.partCode||''),photoUrl='/b/'+encodeURIComponent(code)+'?photo='+encodeURIComponent(context.photoId);
 return {recordId:r.id,materialId:context.materialId,photoId:context.photoId,summary:{name:r.name||'',partCode:r.partCode||'',batchCode:r.code,receiptDay:day(r.day),initialQuantity:r.quantity??'',unit:r.unit||'',expiry:day(r.expiry),defaultLocations:context.defaultLocations,actualLocations:context.actualLocations,locationNotice:context.locationNotice,photo:context.photoId?{url:photoUrl,fullUrl:photoUrl+'&full=1',title:'تصویر مرجع کالا'}:null,notice:'مشخصات اولیه مربوط به دریافت کالا است؛ محل نگهداری و عکس مرجع با اینترنت به‌روز می‌شوند. مقدار اولیه، موجودی فعلی نیست و این صفحه تأیید کیفیت یا مجوز مصرف محسوب نمی‌شود.'}};
}
