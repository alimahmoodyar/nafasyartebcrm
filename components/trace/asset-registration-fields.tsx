'use client';
import {Armchair,Laptop,Printer,Wrench,Component,Factory,Truck,Shapes,Check,LockKeyhole} from 'lucide-react';
import {assetCategories} from '@/lib/asset-categories';
const icons={Armchair,Laptop,Printer,Wrench,Component,Factory,Truck,Shapes};
export function AssetRegistrationFields({draft,change,bulk=false}:{draft:any;change:(key:string,value:any)=>void;bulk?:boolean}){
 const field=(key:string,title:string,required=false)=><label className="field"><span>{title} {required?<b aria-label="اجباری">*</b>:<small>اختیاری</small>}</span><input required={required} maxLength={key==='specifications'?6000:['brand','model'].includes(key)?100:key==='serial'||key==='name'?200:300} value={draft[key]||''} onChange={e=>change(key,e.target.value)}/></label>;
 return <div className="asset-register"><div className="asset-register__grid">{field('name','نام مال',true)}<label className="field">کد یکتای اموال · خودکار<div className="asset-register__automatic">پس از ثبت ساخته می‌شود <LockKeyhole size={17}/></div></label></div>
 <h4>گروه مال <b aria-label="اجباری">*</b></h4><div className="asset-register__groups" role="group" aria-label="گروه مال">{assetCategories.map(c=>{const Icon=icons[c.icon],chosen=draft.category===c.name;return <button className={'asset-register__group'+(chosen?' is-selected':'')} type="button" key={c.name} aria-pressed={chosen} onClick={()=>change('category',c.name)}><Icon size={27}/><span>{c.name}</span>{chosen&&<Check size={16}/>}</button>})}</div>
 {draft.category==='سایر'&&field('customCategory','نام گروه',true)}<div className="asset-register__grid asset-register__grid--three">{field('brand','سازنده')}{field('model','مدل')}{!bulk&&field('serial','سریال کارخانه‌ای')}</div>{field('location','محل فعلی مال',true)}{field('specifications','مشخصات تکمیلی')}
 </div>;
}
