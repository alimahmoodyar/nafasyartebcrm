import {panelConfig,validLine,type PanelConfig} from './sms-panel';
import {AccessError} from './authorization';
// SMS.ir official API: https://github.com/IPeCompany/SmsPanelV2.nodejs (SendBulk).
// Fixed destination: credentials can never be redirected to a client-supplied host.
export async function assetSmsReady(){const config=await panelConfig();return !!config.apiKey&&validLine(config.line);}
export async function sendNafasyarSms(mobile:string,message:string,config?:PanelConfig){
 const {apiKey,line}=config??await panelConfig();
 if(!apiKey||!validLine(line))throw new AccessError('تنظیمات پنل پیامک را در خانهٔ مدیر تکمیل کنید.',503);
 if(!/^09\d{9}$/.test(mobile))throw new AccessError('شماره موبایل معتبر نیست.',400);
 const body=message.trimEnd();
 const messageText=body.endsWith('\nلغو11')?body:body+'\nلغو11';
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 let r:Response;
 try{r=await fetch('https://api.sms.ir/v1/send/bulk',{method:'POST',redirect:'error',headers:{'X-API-KEY':apiKey,'Content-Type':'application/json; charset=utf-8',Accept:'application/json'},body:JSON.stringify({lineNumber:Number(line),MessageText:messageText,Mobiles:[mobile],SendDateTime:null}),signal:controller.signal});}
 catch(error){
  const cause=error instanceof Error?error.message:'';
  const detail=controller.signal.aborted?'مهلت ۲۰ ثانیه‌ای اتصال پایان یافت.':
   /certificate|TLS|SSL/i.test(cause)?'اتصال امن TLS برقرار نشد.':
   /DNS|ENOTFOUND|EAI_AGAIN/i.test(cause)?'نشانی پنل از سرور پیدا نشد.':'سرور پاسخی از api.sms.ir دریافت نکرد.';
  throw new AccessError(detail+' وضعیت ارسال نامشخص است.',503);
 }
 finally{clearTimeout(timer);}
 let d:any=null;try{d=await r.json();}catch{}if(!r.ok||d?.status!==1||!Array.isArray(d?.data?.messageIds)||d.data.messageIds.length!==1||!Number.isSafeInteger(d.data.messageIds[0])||d.data.messageIds[0]<=0)throw new AccessError('پنل پیامک ارسال را تأیید نکرد. وضعیت HTTP '+r.status+'، کد پنل '+(Number.isInteger(d?.status)?d.status:'نامشخص')+'؛ خط، اعتبار و دسترسی IP سرور را در SMS.ir بررسی کنید.',503);
 return Number(d.data.messageIds[0]);
}
export async function sendAssetOtp(mobile:string,code:string){
 if(!/^\d{6}$/.test(code))throw new AccessError('شماره موبایل یا رمز معتبر نیست.',400);
 await sendNafasyarSms(mobile,'نفس‌یار\nکد تأیید شما: '+code+'\nاعتبار: ۵ دقیقه\nاین کد را در اختیار دیگران نگذارید.');
}
