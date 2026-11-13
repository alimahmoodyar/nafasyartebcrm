import {incomingQcCode} from './incoming-qc-contract';
import {parseShippingQr} from './shipping-packages';
import {parseReturnCarton} from './service-return-parcel-contract';
import {driverReceiptId} from './driver-receipt-contract';
import {parseServiceDeviceQr,serviceDeviceSerial} from './service-device-contract';
/** Labels identify objects, never a role, mutable action, permission or approval. */
export const workflowLabelFamilies=['batch','device','shipping','return','receipt'] as const;
export type ScanAction={id:string;title:string;kind:'navigate'|'shipping'|'return'|'receipt'|'transfer';section?:string;target?:string;code?:string;driver?:boolean;expert?:boolean;intake?:boolean;domain?:string};
export type ScanResult={kind:string;message:string;actions:ScanAction[]};
export function parseWorkflowLabel(value:string,origin:string){
 const raw=typeof value==='string'?value.replace(/\r\n?/g,'\n').trim():'';
 if(!raw||raw.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(raw))throw Error('کد خوانده‌شده معتبر نیست.');
 const batch=incomingQcCode(raw,origin);if(batch)return {kind:'batch' as const,code:batch,raw};
 if(raw.startsWith('NAFASYAR-SHIP/1:')){parseShippingQr(raw);return {kind:'shipping' as const,code:raw,raw};}
 if(raw.startsWith('NAFASYAR-RETURN/1:')&&parseReturnCarton(raw))return {kind:'return' as const,code:raw,raw};
 if(raw.startsWith('NAFASYAR-RECEIPT/1:')&&driverReceiptId(raw))return {kind:'receipt' as const,code:driverReceiptId(raw),raw};
 if(raw.startsWith('NAFASYAR-DEVICE/1:')&&parseServiceDeviceQr(raw))return {kind:'device' as const,code:parseServiceDeviceQr(raw)!,raw};
 if(/^NAFASYAR-|^xn--.*\/1/i.test(raw)||/^https?:\/\//i.test(raw)&&new URL(raw).origin===new URL(origin).origin)throw Error('لیبل داخلی معتبر نیست یا نسخهٔ آن پشتیبانی نمی‌شود.');
 // External text/URLs stay inert references. They are never followed or executed.
 return {kind:'unknown' as const,code:serviceDeviceSerial(raw),raw};
}
