import {env} from 'cloudflare:workers';
import {AccessError} from './authorization';
// SMS.ir official API: https://github.com/IPeCompany/SmsPanelV2.nodejs (SendVerifyCode).
// Fixed destination: credentials can never be redirected to a client-supplied host.
export const assetSmsReady=()=>!!(env as any).SMSIR_API_KEY&&/^[1-9]\d*$/.test(String((env as any).SMSIR_VERIFY_TEMPLATE_ID||''));
export async function sendAssetOtp(mobile:string,code:string){if(!assetSmsReady())throw new AccessError('کلید و قالب ارسال سریع sms.ir هنوز در تنظیمات امن میزبان وارد نشده است.',503);
 const r=await fetch('https://api.sms.ir/v1/send/verify/',{method:'POST',redirect:'error',headers:{'X-API-KEY':(env as any).SMSIR_API_KEY,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({Mobile:mobile,TemplateId:Number((env as any).SMSIR_VERIFY_TEMPLATE_ID),Parameters:[{Name:(env as any).SMSIR_VERIFY_CODE_PARAM||'CODE',Value:code}]}),signal:AbortSignal.timeout(15000)});
 let d:any=null;try{d=await r.json();}catch{}if(!r.ok||d?.status!==1)throw new AccessError('ارسال رمز توسط sms.ir تأیید نشد؛ تنظیمات و اعتبار سرویس را بررسی کنید.',503);
}
