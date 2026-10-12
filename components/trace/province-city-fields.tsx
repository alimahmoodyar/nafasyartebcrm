'use client';
import {iranLocalities,iranLocationText,iranProvinces} from '@/lib/iran-locations';

export type ProvinceCityFieldsProps={province?:string;city?:string;onChange:(province:string,city:string)=>void;disabled?:boolean;required?:boolean;cityRequired?:boolean};
/** Two adjacent fields fit the enclosing formgrid, including narrow dialogs. */
export function ProvinceCityFields({province='',city='',onChange,disabled=false,required=false,cityRequired=required}:ProvinceCityFieldsProps){
 const p=iranProvinces.find(name=>iranLocationText(name)===iranLocationText(province))||province;
 const localities=iranLocalities(p),cities=localities.filter(l=>l.kind==='city'),counties=localities.filter(l=>l.kind==='county');
 const knownCity=localities.find(l=>iranLocationText(l.name)===iranLocationText(city));
 const c=knownCity?.name||city,legacyProvince=!!p&&!iranProvinces.includes(p),legacyCity=!!c&&!knownCity;
 // The persisted field is a locality name. Same-name county/city rows share a
 // single option, while county-only names remain separately selectable.
 const cityNames=new Set(cities.map(l=>l.name)),countyOnly=counties.filter(l=>!cityNames.has(l.name));
 const uniqueCities=cities.filter((l,i)=>cities.findIndex(other=>other.name===l.name)===i);
 return <>
  <label className="field" style={{minWidth:0}}><span>استان{!required?' (اختیاری)':''}</span>
   <select aria-label="استان" name="province" value={p} required={required} disabled={disabled} onChange={e=>onChange(e.target.value,e.target.value===p?city:'')}>
    <option value="">انتخاب استان</option>{legacyProvince&&<option value={p}>{p} — ثبت قبلی</option>}
    {iranProvinces.map(name=><option key={name} value={name}>{name}</option>)}
   </select>
  </label>
  <label className="field" style={{minWidth:0}}><span>شهر / شهرستان{!cityRequired?' (اختیاری)':''}</span>
   <select aria-label="شهر / شهرستان" name="city" value={c} required={cityRequired} disabled={disabled||!p||legacyProvince} onChange={e=>onChange(p,e.target.value)}>
    <option value="">{p?'انتخاب شهر یا شهرستان':'ابتدا استان را انتخاب کنید'}</option>
    {legacyCity&&<option value={c}>{c} — ثبت قبلی</option>}
    <optgroup label="شهرها">{uniqueCities.map(l=><option key={'city:'+l.name} value={l.name}>{l.name}{counties.some(c=>c.name===l.name)?' (شهر / شهرستان)':''}</option>)}</optgroup>
    {countyOnly.length>0&&<optgroup label="شهرستان‌ها">{countyOnly.map(l=><option key={'county:'+l.name} value={l.name}>{l.name} (شهرستان)</option>)}</optgroup>}
   </select>
   {legacyCity&&<small>نام ثبت‌شده قبلی حفظ می‌شود؛ با تغییر استان، شهر را دوباره انتخاب کنید.</small>}
  </label>
 </>;
}
