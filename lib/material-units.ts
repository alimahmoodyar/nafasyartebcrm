// A quantity is always expressed in the material's own unit. Sets and pairs are
// distinct units; normalization only reconciles spelling, never converts stock.
export const materialUnits=['عدد','ست','جفت','کیلوگرم','گرم','متر','سانتی‌متر','سانتی‌متر مربع','لیتر'];
export const materialUnitLabels:Record<string,string>=Object.fromEntries(materialUnits.map(unit=>[unit,unit]));
export function normalizeMaterialUnit(value:unknown):string{
 if(typeof value!=='string')return '';
 const key=(text:string)=>text.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]/g,'');
 const normalized=key(value);
 return materialUnits.find(unit=>key(unit)===normalized)||'';
}
