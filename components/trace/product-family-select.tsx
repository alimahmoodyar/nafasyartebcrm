'use client';
import {useEffect,useState} from 'react';
import {productFamilyValues} from '@/lib/product-families';
export function ProductFamilySelect({value,onChange,disabled=false,required=true,families,accountId}:{value:string;onChange:(value:string)=>void;disabled?:boolean;required?:boolean;families?:string[];accountId?:string}){
 const [loaded,setLoaded]=useState<string[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(families)return;let active=true;const controller=new AbortController();setLoaded(null);setError('');
  void fetch('/api/products/families',{cache:'no-store',signal:controller.signal,headers:accountId?{'x-assistant-account':accountId}:{}}).then(async response=>{const data=await response.json() as {error?:string;accountId?:string;families?:unknown};if(!data||typeof data!=='object')throw Error('فهرست خانواده محصول معتبر نیست.');if(!response.ok)throw Error(data.error||'فهرست خانواده محصول دریافت نشد.');if(accountId&&data.accountId!==accountId)throw Error('حساب ورود تغییر کرده است.');if(!Array.isArray(data.families)||data.families.some((v:unknown)=>typeof v!=='string'))throw Error('فهرست خانواده محصول معتبر نیست.');if(active)setLoaded(data.families as string[]);}).catch(e=>{if(active){setLoaded(null);setError(e.message)}});
  return()=>{active=false;controller.abort()};
 },[families,accountId]);
 const options=families||loaded,choices=options?productFamilyValues(options):null,unlisted=!!value&&!!choices&&!choices.includes(value);
 return <><select aria-label="خانواده محصول" disabled={disabled||!options} required={required} value={value} onChange={e=>onChange(e.target.value)}><option value="">{options?'انتخاب خانواده محصول':'در حال دریافت خانواده‌های محصول…'}</option>{!options&&value&&<option value={value}>{value}</option>}{unlisted&&<option value={value} disabled>گزینه قبلی در فهرست نیست؛ دوباره انتخاب کنید</option>}{(choices||[]).map(family=><option key={family} value={family}>{family}</option>)}</select>{error&&<small role="alert">{error}</small>}</>;
}
