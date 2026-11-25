import {AccessError} from './authorization';
import {clean} from './bom-import';

export const materialAccountingSql="upper(COALESCE(json_extract(data,'$.accountingCode'),''))";
export const materialAccountingKey=(code:string)=>code.replace(/[a-z]/g,letter=>letter.toUpperCase());

export function materialAccountingCode(value:unknown){
 if(typeof value!=='string')throw new AccessError('کد حسابداری باید متن باشد.',400);
 const code=clean(value);
 if(code.length>80||/[\s\u0000-\u001f]/.test(code)||/^[+-]?\d+(?:\.\d+)?e[+-]\d+$/i.test(code))throw new AccessError('کد حسابداری را به صورت متن و بدون فاصله وارد کنید.',400);
 return code;
}

export async function nextMaterialCode(seed:string,occupied:(code:string)=>boolean|Promise<boolean>){
 for(let attempt=0;attempt<40;attempt++){
  const hash=new DataView(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('material:'+seed+':'+attempt)));
  const code='907'+String(hash.getUint32(0)%1_000_000_000).padStart(9,'0');
  if(!await occupied(code))return code;
 }
 throw new AccessError('کد هم‌نفس تخصیص پیدا نکرد. دوباره تلاش کنید.',409);
}
