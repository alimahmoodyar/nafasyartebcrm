import {env} from 'cloudflare:workers';
import {AccessError} from './authorization';
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes));}
async function encryptionKey(){
 try{const raw=Uint8Array.from(atob(env.LLM_CONFIG_ENCRYPTION_KEY||''),c=>c.charCodeAt(0));if(raw.length!==32)throw Error();return await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
 catch{throw new AccessError('کلید رمزگذاری تنظیم نشده است؛ با مدیر سرور تماس بگیرید.',503);}
}
export async function encryptToken(token:string,id:string){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await encryptionKey(),new TextEncoder().encode(token));return 'v1.'+b64(iv)+'.'+b64(new Uint8Array(encrypted));}
// Server-only: for the authenticated assistant runner. Never returned by HTTP or MCP.
export async function decryptToken(cipher:string,id:string){try{const [version,iv,data]=cipher.split('.');if(version!=='v1')throw new AccessError('نسخه رمزگذاری معتبر نیست.',503);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(iv),c=>c.charCodeAt(0)),additionalData:new TextEncoder().encode(id)},await encryptionKey(),Uint8Array.from(atob(data),c=>c.charCodeAt(0))));}catch(e){if(e instanceof AccessError)throw e;throw new AccessError('توکن ذخیره‌شده با کلید رمزگذاری فعلی سرور باز نمی‌شود؛ مدیر باید کلید رمزگذاری قبلی را بازیابی کند یا توکن این پروفایل را دوباره ذخیره کند.',503);}}
