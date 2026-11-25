import {env} from 'cloudflare:workers';
import {AccessError} from './authorization';
// SMS.ir official API: https://github.com/IPeCompany/SmsPanelV2.nodejs (SendBulk).
// Fixed destination: credentials can never be redirected to a client-supplied host.
export const assetSmsReady=()=>!!(env as any).SMSIR_API_KEY&&/^[1-9]\d{3,19}$/.test(String((env as any).SMSIR_LINE_NUMBER||''))&&Number.isSafeInteger(Number((env as any).SMSIR_LINE_NUMBER));
export async function sendNafasyarSms(mobile:string,message:string){if(!assetSmsReady())throw new AccessError('کلید و خط ارسال عادی sms.ir هنوز در تنظیمات امن میزبان وارد نشده است.',503);
 if(!/^09\d{9}$/.test(mobile))throw new AccessError('شماره موبایل معتبر نیست.',400);
 const body=message.trimEnd();
 const messageText=body.endsWith('\nلغو11')?body:body+'\nلغو11';
 let r:Response;
 try{r=await fetch('https://api.sms.ir/v1/send/bulk',{method:'POST',redirect:'error',headers:{'X-API-KEY':(env as any).SMSIR_API_KEY,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({lineNumber:Number((env as any).SMSIR_LINE_NUMBER),MessageText:messageText,Mobiles:[mobile],SendDateTime:null}),signal:AbortSignal.timeout(15000)});}
 catch{throw new AccessError('ارتباط با پنل پیامک برقرار نشد و ارسال تأیید نشده است.',503);}
 let d:any=null;try{d=await r.json();}catch{}if(!r.ok||d?.status!==1||!Array.isArray(d?.data?.messageIds)||d.data.messageIds.length!==1||!Number.isSafeInteger(d.data.messageIds[0])||d.data.messageIds[0]<=0)throw new AccessError('ارسال رمز توسط sms.ir تأیید نشد؛ خط ارسال، اعتبار و وضعیت شماره مقصد را بررسی کنید.',503);
}
export async function sendAssetOtp(mobile:string,code:string){
 if(!/^\d{6}$/.test(code))throw new AccessError('شماره موبایل یا رمز معتبر نیست.',400);
 await sendNafasyarSms(mobile,'نفس‌یار\nکد تأیید شما: '+code+'\nاعتبار: ۵ دقیقه\nاین کد را در اختیار دیگران نگذارید.');
}
