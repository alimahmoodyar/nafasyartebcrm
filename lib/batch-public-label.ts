import {storage} from './storage';
import {AccessError} from './authorization';
import {receiptDay} from './batch-number';
/** Explicit public label projection. Never join stock, QC, supplier, notes or purchase data. */
export async function publicBatchLabel(code:string){
 if(!code||code.length>100||/[\x00-\x1f\x7f]/.test(code))throw new AccessError('شماره بچ معتبر نیست.',400);
 const rows=(await storage().prepare("SELECT id,json_extract(payload,'$.code') code,json_extract(payload,'$.part') name,json_extract(payload,'$.partCode') partCode,json_extract(payload,'$.date') day,json_extract(payload,'$.quantity') quantity,json_extract(payload,'$.unit') unit,json_extract(payload,'$.expiry') expiry FROM records WHERE kind='batch' AND json_extract(payload,'$.code')=? LIMIT 2").bind(code).all()).results as any[];
 if(!rows.length)throw new AccessError('بچ پیدا نشد.',404);if(rows.length!==1)throw new AccessError('شناسه بچ نیازمند بررسی مسئول سامانه است.',409);
 const r=rows[0],day=(v:string)=>{try{return receiptDay(v).display}catch{return v||''}};
 return {recordId:r.id,summary:{name:r.name||'',partCode:r.partCode||'',batchCode:r.code,receiptDay:day(r.day),initialQuantity:r.quantity??'',unit:r.unit||'',expiry:day(r.expiry),notice:'این اطلاعات ثابتِ لیبل هنگام دریافت کالا است؛ مقدار اولیه، موجودی فعلی نیست و این صفحه تأیید کیفیت یا مجوز مصرف محسوب نمی‌شود.'}};
}
