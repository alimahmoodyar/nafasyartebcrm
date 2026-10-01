import {AccessError} from '@/lib/authorization';
// Classify deployment errors without returning database messages, paths or record data.
export function assistantStorageError(error:unknown):AccessError{
 const parts:string[]=[];let e:any=error;for(let i=0;e&&i<4;i++,e=e.cause)parts.push(String(e.message||''));const message=parts.join(' ');
 if(/(?:no such table|does not exist|invalid object name)/i.test(message)){
 if(/assistant_actions/i.test(message))return new AccessError('مدل ذخیره شده است، اما جدول فرمان‌های دستیار روی این سرور آماده نیست. مسئول سرور باید مهاجرت دیتابیس 0012 را روی همین دیتابیس اجرا کند؛ مدل یا کلید API را تغییر ندهید.',503);
 if(/assistant_turns/i.test(message))return new AccessError('مدل ذخیره شده است، اما جدول سابقه دستیار روی این سرور آماده نیست. مسئول سرور باید مهاجرت دیتابیس 0010 را روی همین دیتابیس اجرا کند؛ مدل یا کلید API را تغییر ندهید.',503);
 }
 return new AccessError('دریافت سابقه یا فرمان‌های دستیار از سرور انجام نشد؛ این خطا مربوط به بخش داخلی دستیار است و موفقیت آزمون اتصال مدل را رد نمی‌کند. مسئول سرور پاسخ /api/assistant و لاگ برنامه را بررسی کند.',503);
}
