import {parseShippingQr} from './shipping-packages';
import {parseReturnCarton} from './service-return-parcel-contract';
import {driverReceiptId} from './driver-receipt-contract';
export function driverScanRoute(raw:string){
 const code=typeof raw==='string'?raw.trim():'';
 if(!code||code.length>3000)throw Error('کد خوانده‌شده معتبر نیست.');
 if(code.startsWith('NAFASYAR-SHIP/1:')){parseShippingQr(code);return {kind:'product' as const,code};}
 if(parseReturnCarton(code))return {kind:'return' as const,code};
 if(code.startsWith('NAFASYAR-RECEIPT/1:')&&driverReceiptId(code))return {kind:'receipt' as const,code};
 throw Error('این کد برچسب سامانه نیست. برای دستگاه فاقد برچسب، «دریافت دستگاه بدون کد» را انتخاب کنید.');
}
