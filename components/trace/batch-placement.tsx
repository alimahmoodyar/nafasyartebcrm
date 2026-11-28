'use client';
import {scaled} from '@/lib/production';

const levels=['راهرو','قفسه','طبقه','خانه'];
export type Placement={location:string;quantity:string;note:string};
const localized=(s:string)=>s.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace('٫','.');
function amount(s:string){try{return scaled(localized(s))}catch{return 0}}
export function placementTotal(rows:Placement[]){return rows.reduce((sum,r)=>sum+amount(r.quantity),0)}
export function completePlacement(rows:Placement[],accepted:number){
 return rows.length>0&&rows.every(r=>!!r.location&&amount(r.quantity)>0)&&new Set(rows.map(r=>r.location)).size===rows.length&&placementTotal(rows)===accepted;
}
export function BinPicker({options,value,onChange}:{options:string[];value:string;onChange:(v:string)=>void}){
 const parts=value.split('-');
 const addresses=options.map(v=>v.split('-')).filter(a=>a.length===4&&a.every(Boolean));
 const legacy=options.filter(v=>v.split('-').length!==4||v.split('-').some(part=>!part));
 if(!options.length)return <div className="formgrid wide">{levels.map((label,i)=><label className="field" key={label}>{label}<input required dir="auto" pattern="[^\s\x7C\x2D]+" value={parts[i]||''} onChange={e=>onChange(levels.map((_,j)=>i===j?e.target.value.replace(/-/g,''):parts[j]||'').join('-'))}/></label>)}</div>;
 return <>{addresses.length>0&&<div className="formgrid wide">{levels.map((label,i)=>{
 const matches=addresses.filter(a=>a.slice(0,i).every((part,j)=>part===parts[j]));
 return <label className="field" key={label}>{label}<select value={parts[i]||''} onChange={e=>{const choices=matches.filter(a=>a[i]===e.target.value);const next=choices.find(a=>a.slice(i+1).every((v,j)=>v===parts[i+1+j]))||choices[0];if(next)onChange(next.join('-'))}}><option value="" disabled>انتخاب کنید</option>{[...new Set(matches.map(a=>a[i]))].sort().map(v=><option key={v}>{v}</option>)}</select></label>
 })}</div>}{legacy.length>0&&<label className="field">نشانی ثبت‌شده با قالب قدیمی<select value={legacy.includes(value)?value:''} onChange={e=>onChange(e.target.value)}><option value="">انتخاب کنید</option>{legacy.map(v=><option key={v}>{v}</option>)}</select></label>}</>;
}
export function BatchPlacement({rows,options,accepted,unit,onChange}:{rows:Placement[];options:string[];accepted:number;unit:string;onChange:(r:Placement[])=>void}){
 const remaining=accepted-placementTotal(rows),available=options.filter(v=>!rows.some(r=>r.location===v));
 function patch(i:number,p:Partial<Placement>){onChange(rows.map((r,j)=>i===j?{...r,...p}:r))}
 if(!options.length)return <p role="alert">ابتدا یک محل مجاز برای این انبار تعریف کنید.</p>;
 return <>{rows.map((r,i)=><fieldset key={i}><legend>محل {String(i+1).toLocaleString()}</legend><BinPicker options={options} value={r.location} onChange={location=>patch(i,{location})}/><label className="field">مقدار در این خانه ({unit})<input inputMode="decimal" value={r.quantity} onChange={e=>patch(i,{quantity:localized(e.target.value)})}/></label><label className="field">یادداشت این خانه (اختیاری)<textarea maxLength={500} value={r.note} onChange={e=>patch(i,{note:e.target.value})}/></label>{rows.length>1&&<button type="button" className="btn" onClick={()=>onChange(rows.filter((_,j)=>j!==i))}>حذف محل</button>}</fieldset>)}
 <button className="btn" type="button" disabled={!available.length} onClick={()=>onChange([...rows,{location:available[0],quantity:remaining>0?String(remaining/1000):'',note:''}])}>افزودن خانه</button>
 <p role="status">جمع جانمایی: {(placementTotal(rows)/1000).toLocaleString('fa-IR')} از {(accepted/1000).toLocaleString('fa-IR')} {unit} · {remaining<0?'مازاد':'مانده'}: {(Math.abs(remaining)/1000).toLocaleString('fa-IR')}</p>
 {new Set(rows.map(r=>r.location)).size!==rows.length&&<p role="alert">آدرس خانه‌ها باید متفاوت باشد.</p>}</>;
}
