import {env} from 'cloudflare:workers';
import {AccessError} from './authorization';
import {encryptToken,decryptToken} from './llm-secrets';

const objectKey='private-settings/sms-panel.v1';
export type PanelConfig={apiKey:string;line:string;mobile:string};
export const validLine=(line:string)=>/^[1-9]\d{3,19}$/.test(line)&&Number.isSafeInteger(Number(line));
export async function panelConfig():Promise<PanelConfig>{
 const saved=await env.BUCKET?.get(objectKey);
 if(saved){
  const ciphertext=new TextDecoder().decode(await saved.arrayBuffer());
  return JSON.parse(await decryptToken(ciphertext,objectKey));
 }
 const host=env as typeof env & {SMSIR_API_KEY?:string;SMSIR_LINE_NUMBER?:string;PUBLIC_WARRANTY_TEST_MOBILE?:string};
 return {apiKey:host.SMSIR_API_KEY||'',line:String(host.SMSIR_LINE_NUMBER||''),mobile:host.PUBLIC_WARRANTY_TEST_MOBILE||''};
}
export const publicFields=({apiKey,line,mobile}:PanelConfig)=>({hasKey:!!apiKey,line,mobile});
function digits(value:unknown){
 return String(value??'').trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
}
export async function savePanel(raw:{apiKey?:unknown;line?:unknown;mobile?:unknown}){
 const line=digits(raw.line),mobile=digits(raw.mobile);
 if(!validLine(line))throw new AccessError('شمارهٔ خط فرستنده معتبر نیست.',400);
 if(!/^09\d{9}$/.test(mobile))throw new AccessError('شمارهٔ تست باید ۱۱ رقم باشد و با ۰۹ شروع شود.',400);
 const apiKey=String(raw.apiKey??'').trim()||(await panelConfig()).apiKey;
 if(!apiKey||!/^[!-~]{1,2048}$/.test(apiKey))throw new AccessError('کلید پنل معتبر را وارد کنید.',400);
 const config={apiKey,line,mobile};
 const cipher=await encryptToken(JSON.stringify(config),objectKey);
 if(!env.BUCKET)throw new AccessError('فضای ذخیرهٔ تنظیمات در دسترس نیست.',503);
 await env.BUCKET.put(objectKey,new TextEncoder().encode(cipher));
 return publicFields(config);
}
