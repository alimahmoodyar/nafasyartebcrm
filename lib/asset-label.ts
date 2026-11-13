export const assetQrText=(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('شناسه اموال معتبر نیست.');return 'NAFASYAR-ASSET/1:'+id;};
export function assetLabelId(raw:string){const m=/^NAFASYAR-ASSET\/1:([0-9a-f-]{36})$/i.exec(raw.trim());return m?.[1]||'';}
