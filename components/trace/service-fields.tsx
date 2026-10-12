'use client';
import {Plus} from 'lucide-react';
import {NumberInput} from './number-input';
import {MoneyInput} from './money-input';
import {SolarDate} from './solar-date';
import {localDay} from '@/lib/persian-date';
import {consumerDraftLine,consumerRowTotal} from '@/lib/service-consumer-form';
import type {ServiceField} from '@/lib/after-sales-contract';
export const seedServiceFields=(fields:ServiceField[]):any=>Object.fromEntries(fields.map(f=>[f.key,f.type==='rows'?[]:f.type==='boolean'?false:f.type==='date'?localDay():f.type==='money'?(f.optional?'':'0'):f.options?.[0]?.[0]||'']));
type Pricing={tariffs:any[];day:string;domain:string};
export function ServiceFields({fields,value,onChange,options,pricing,disabled=false}:{fields:ServiceField[];value:any;onChange:(v:any)=>void;options:(s:string)=>string[][];pricing?:Pricing;disabled?:boolean}){
 return <>{fields.map(f=>{const v=value[f.key],set=(x:any)=>onChange({...value,[f.key]:x});
  if(f.type==='rows')return <fieldset className="wide as-rows" key={f.key}><legend>{f.label}</legend>{(v||[]).map((rawRow:any,i:number)=>{const row=f.key==='lines'&&pricing?consumerDraftLine(rawRow,rawRow,pricing.tariffs,pricing.day,pricing.domain):rawRow;const total=f.key==='lines'?consumerRowTotal(row):null;return <div className="as-row" key={i}><strong>ردیف {Number(i+1).toLocaleString('fa-IR')}</strong><div className="formgrid"><ServiceFields fields={f.fields!} value={row} options={options} pricing={pricing} disabled={disabled} onChange={x=>set(v.map((a:any,n:number)=>n===i?(f.key==='lines'&&pricing?consumerDraftLine(x,row,pricing.tariffs,pricing.day,pricing.domain):x):a))}/></div>{total!==null&&<p aria-live="polite">هزینه این قطعه برای مشتری: {BigInt(total).toLocaleString('fa-IR')} ریال</p>}<button type="button" className="link" disabled={disabled} onClick={()=>set(v.filter((_:any,n:number)=>n!==i))}>حذف ردیف {Number(i+1).toLocaleString('fa-IR')}</button></div>})}<button type="button" className="btn" disabled={disabled||(v||[]).length>=40} onClick={()=>set([...(v||[]),seedServiceFields(f.fields!)])}><Plus size={16}/>افزودن ردیف</button></fieldset>;
  if(f.type==='date')return <SolarDate key={f.key} label={f.label} value={v||''} required={!f.optional} disabled={disabled} onChange={set}/>;
  if(f.type==='boolean')return <label className="field as-check" key={f.key}><input type="checkbox" disabled={disabled} checked={v===true} onChange={e=>set(e.target.checked)}/>{f.label}</label>;
  if(f.type==='money'){
   const automatic=f.key==='customerUnitRial'&&['tariff','warranty'].includes(value.customerPriceSource);
   return <label className="field" key={f.key}>{f.label}{f.optional&&!automatic?(f.key==='customerUnitRial'?' (در صورت نبود تعرفه)':' (اختیاری)'):''}<MoneyInput aria-label={f.label} required={f.key==='customerUnitRial'?!automatic&&!['warranty','part_warranty'].includes(value.coverage):!f.optional} readOnly={automatic} disabled={disabled} value={v??''} onChange={set}/><small>{automatic?(value.customerPriceSource==='warranty'?'گارانتی؛ مبلغ مشتری صفر است.':'قیمت مصرف‌کننده از تعرفه معتبر؛ بر اساس مقدار محاسبه می‌شود.'):'ریال'}{f.key==='customerUnitRial'&&!automatic&&value.coverage==='paid'?' · تعرفه مصرف‌کننده ثبت نشده؛ قیمت را وارد کنید.':''}</small></label>;
  }
  return <label className={'field '+(f.type==='textarea'?'wide':'')} key={f.key}>{f.label}{f.optional?' (اختیاری)':''}{f.type==='select'?<select required={!f.optional} disabled={disabled} value={v||''} onChange={e=>set(e.target.value)}><option value="">انتخاب کنید</option>{(f.options||options(f.source||'')).map(([k,l])=><option value={k} key={k}>{l}</option>)}</select>:f.type==='textarea'?<textarea rows={3} required={!f.optional} disabled={disabled} maxLength={4000} value={v||''} onChange={e=>set(e.target.value)}/>:<NumberInput fieldKey={f.key} required={!f.optional} disabled={disabled} maxLength={1000} inputMode={f.type==='quantity'?'decimal':undefined} dir={f.type==='quantity'?'ltr':undefined} value={v??''} onChange={e=>set(e.target.value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))))}/>}</label>;
 })}</>;
}
