import {latinDigits} from './persian-date';

export const assetQrText=(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('شناسه اموال معتبر نیست.');return 'NAFASYAR-ASSET/1:'+id;};
export function assetLabelId(raw:string){const m=/^NAFASYAR-ASSET\/1:([0-9a-f-]{36})$/i.exec(raw.trim());return m?.[1]||'';}

export function generatedAssetCode(raw:string){
 const code=latinDigits(raw.trim()).toUpperCase();
 const digits=/^AM-(\d{6,12})$/.exec(code)?.[1];
 if(!digits||Number(digits)===0||String(Number(digits)).padStart(6,'0')!==digits)return '';
 return code;
}
