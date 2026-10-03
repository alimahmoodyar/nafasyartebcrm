import {env} from 'cloudflare:workers';
import {AccessError} from './authorization';
const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(){
 try{const raw=bytes(env.PASSWORD_VAULT_KEY||'');if(raw.length!==32)throw Error();return await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
 catch{throw new AccessError('کلید امن نگهداری رمزها روی سرور تنظیم نشده است؛ با مدیر سرور تماس بگیرید.',503);}
}
export async function sealPassword(password:string,memberId:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('account-password:'+memberId)},await key(),new TextEncoder().encode(password));
 return 'v1.'+base64(iv)+'.'+base64(new Uint8Array(cipher));
}
export async function openPassword(cipher:string,memberId:string){
 try{const [v,iv,data]=cipher.split('.');if(v!=='v1')throw Error();return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:new TextEncoder().encode('account-password:'+memberId)},await key(),bytes(data)));}
 catch(e){if(e instanceof AccessError)throw e;throw new AccessError('رمز با کلید فعلی سرور قابل بازیابی نیست؛ کلید قبلی را بازیابی یا رمز حساب را بازنشانی کنید.',503);}
}
