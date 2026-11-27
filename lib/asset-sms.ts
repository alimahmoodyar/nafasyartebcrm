import {panelConfig,validLine,type PanelConfig} from './sms-panel';
import {AccessError} from './authorization';
import {mirrorBaleSms} from './bale-safir';
import {withSmsReport,type SmsReportUpdate,type SmsPurpose} from './sms-report';
// SMS.ir official API: https://github.com/IPeCompany/SmsPanelV2.nodejs (SendBulk).
// Fixed destination: credentials can never be redirected to a client-supplied host.
export async function assetSmsReady(){const config=await panelConfig();return !!config.apiKey&&validLine(config.line);}
export function sendNafasyarSms(mobile:string,message:string,config?:PanelConfig,otp?:string,report?:SmsReportUpdate|SmsPurpose){
 if(typeof report==='function')return send(mobile,message,config,otp,report);
 return withSmsReport(report||'other',update=>send(mobile,message,config,otp,update));
}
async function send(mobile:string,message:string,config:PanelConfig|undefined,otp:string|undefined,report:SmsReportUpdate){
 report('config_unavailable',{mobile});
 const {apiKey,line}=config??await panelConfig();
 if(!apiKey||!validLine(line))throw new AccessError('تنظیمات پنل پیامک را در خانهٔ مدیر تکمیل کنید.',503);
 if(!/^09\d{9}$/.test(mobile)){report('invalid_mobile');throw new AccessError('شماره موبایل معتبر نیست.',400);}
 const body=message.trimEnd();
 const messageText=body.endsWith('\nلغو11')?body:body+'\nلغو11';
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 type SendReply={status?:unknown;data?:{messageIds?:unknown}};
 let r:Response,reply:SendReply|null=null;
 try{
  r=await fetch('https://api.sms.ir/v1/send/bulk',{method:'POST',redirect:'manual',headers:{'X-API-KEY':apiKey,'Content-Type':'application/json; charset=utf-8',Accept:'application/json'},body:JSON.stringify({lineNumber:Number(line),MessageText:messageText,Mobiles:[mobile],SendDateTime:null}),signal:controller.signal});
  try{reply=await r.json() as SendReply|null;}catch(error){if(controller.signal.aborted)throw error;}
 }catch(error){
  const failure=error instanceof Error?error:null;
  const nested=failure?.cause as {code?:unknown;message?:unknown}|undefined;
  const cause=[failure?.message,nested?.code,nested?.message].filter(value=>typeof value==='string').join(' ');
  const reason=controller.signal.aborted?'network_timeout':/certificate|TLS|SSL/i.test(cause)?'network_tls':/DNS|ENOTFOUND|EAI_AGAIN/i.test(cause)?'network_dns':'network_error';
  report(reason);
  const detail={network_timeout:'مهلت ۲۰ ثانیه‌ای اتصال پایان یافت.',network_tls:'اتصال امن TLS برقرار نشد.',network_dns:'نشانی پنل از سرور پیدا نشد.',network_error:'سرور پاسخی از api.sms.ir دریافت نکرد.'}[reason];
  throw new AccessError(detail+' وضعیت ارسال نامشخص است.',503);
 }finally{clearTimeout(timer);}
 const panelCode=typeof reply?.status==='number'&&Number.isSafeInteger(reply.status)?reply.status:undefined;
 const ids=reply?.data?.messageIds,messageId=Array.isArray(ids)&&ids.length===1&&Number.isSafeInteger(ids[0])&&ids[0]>0?Number(ids[0]):undefined;
 if(!r.ok||panelCode!==1||messageId===undefined){
  report(panelCode!==undefined&&panelCode!==1||r.status>=400&&r.status<500?'provider_rejected':'provider_response_unknown',{httpStatus:r.status,panelCode});
  throw new AccessError('پنل پیامک ارسال را تأیید نکرد. وضعیت HTTP '+r.status+'، کد پنل '+(panelCode??'نامشخص')+'؛ خط، اعتبار و دسترسی IP سرور را در SMS.ir بررسی کنید.',503);
 }
 report('provider_accepted',{httpStatus:r.status,panelCode,messageId});
 await mirrorBaleSms(mobile,body.replace(/\nلغو11$/,''),otp);
 return messageId;
}
export async function sendAssetOtp(mobile:string,code:string){
 if(!/^\d{6}$/.test(code))throw new AccessError('شماره موبایل یا رمز معتبر نیست.',400);
 await sendNafasyarSms(mobile,'نفس‌یار\nکد تأیید شما: '+code+'\nاعتبار: ۵ دقیقه\nاین کد را در اختیار دیگران نگذارید.',undefined,code,'asset_otp');
}
