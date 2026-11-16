export const assetCategories=[
 {name:'میز، صندلی و مبلمان',icon:'Armchair',kind:'office'},
 {name:'رایانه و تجهیزات الکترونیکی',icon:'Laptop',kind:'office'},
 {name:'تجهیزات اداری',icon:'Printer',kind:'office'},
 {name:'ابزار',icon:'Wrench',kind:'office'},
 {name:'قالب',icon:'Component',kind:'mold'},
 {name:'ماشین‌آلات',icon:'Factory',kind:'machine'},
 {name:'وسایل نقلیه',icon:'Truck',kind:'office'},
 {name:'سایر',icon:'Shapes',kind:'office'},
] as const;
export function assetCategory(name:string){return assetCategories.find(x=>x.name===name);}
// commitAssets' snapshot guard serializes allocation with the registration batch.
export function nextAssetCode(rows:{type:string;data:any}[]){const max=rows.reduce((n,r)=>{const m=r.type==='asset_item'?/^AM-(\d{1,12})$/.exec(r.data.code||''):null;return m?Math.max(n,Number(m[1])):n;},0);if(max>=999999999999)throw Error('ظرفیت شماره اموال تکمیل شده است.');return 'AM-'+String(max+1).padStart(6,'0');}
