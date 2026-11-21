'use client';
import {LockKeyhole} from 'lucide-react';
import {AssetCategoryChoices} from './asset-category-choices';
export function AssetRegistrationFields({draft,change,bulk=false}:{draft:any;change:(key:string,value:any)=>void;bulk?:boolean}){
 const field=(key:string,title:string,required=false)=><label className="field"><span>{title} {required?<b aria-label="اجباری">*</b>:<small>اختیاری</small>}</span><input required={required} maxLength={key==='specifications'?6000:['brand','model'].includes(key)?100:key==='serial'||key==='name'?200:300} value={draft[key]||''} onChange={e=>change(key,e.target.value)}/></label>;
 return <div className="asset-register"><div className="asset-register__grid">{field('name','نام مال',true)}<label className="field">کد یکتای اموال · خودکار<div className="asset-register__automatic">پس از ثبت ساخته می‌شود <LockKeyhole size={17}/></div></label></div>
 <h4>گروه مال <b aria-label="اجباری">*</b></h4><AssetCategoryChoices value={draft.category} onChange={value=>change('category',value)}/>
 {draft.category==='سایر'&&field('customCategory','نام گروه',true)}<div className="asset-register__grid asset-register__grid--three">{field('brand','سازنده')}{field('model','مدل')}{!bulk&&field('serial','سریال کارخانه‌ای')}</div>{field('location','محل فعلی مال',true)}{field('specifications','مشخصات تکمیلی')}
 </div>;
}
