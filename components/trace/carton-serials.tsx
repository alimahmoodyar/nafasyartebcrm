'use client';
import {useState} from 'react';

export type CartonSerial={deviceId:string;serial:string;model:string};
export function CartonSerials({items,selected,onChange,manual=true}:{items:CartonSerial[];selected:string[];onChange:(ids:string[])=>void;manual?:boolean}){
 const [code,setCode]=useState(''),[error,setError]=useState('');
 const chosen=new Set(selected);
 const models=new Map<string,CartonSerial[]>();
 for(const item of items){const model=item.model||'مدل ثبت‌نشده';models.set(model,[...(models.get(model)||[]),item]);}
 function scan(){
  const item=items.find(row=>row.serial.toUpperCase()===code.trim().toUpperCase());
  if(!item){setError('این سریال در فهرست این حواله نیست.');return;}
  if(chosen.has(item.deviceId)){setError('این سریال قبلاً علامت خورده است.');return;}
  onChange([...selected,item.deviceId]);setCode('');setError('');
 }
 return <section className="flow-card" style={{gridColumn:'1 / -1'}}>
  <label className="field">اسکن سریال کارتن<input dir="ltr" autoComplete="off" value={code} onChange={e=>{setCode(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();if(code.trim())scan();}}}/></label>
  <button type="button" className="btn" disabled={!code.trim()} onClick={scan}>افزودن سریال اسکن‌شده</button>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {[...models].map(([model,rows])=>{
   const marked=rows.filter(row=>chosen.has(row.deviceId)).length;
   return <fieldset key={model}><legend>{model} · {marked.toLocaleString('fa-IR')} از {rows.length.toLocaleString('fa-IR')}</legend>
    {manual&&<button type="button" className="btn" onClick={()=>onChange(marked===rows.length?selected.filter(id=>!rows.some(row=>row.deviceId===id)):[...new Set([...selected,...rows.map(row=>row.deviceId)])])}>{marked===rows.length?'برداشتن تیک‌های این مدل':'انتخاب همهٔ سریال‌های این مدل'}</button>}
    {rows.map(row=><label className="flow-check" key={row.deviceId}><input type="checkbox" checked={chosen.has(row.deviceId)} disabled={!manual} onChange={e=>onChange(e.target.checked?[...selected,row.deviceId]:selected.filter(id=>id!==row.deviceId))}/><bdi>{row.serial}</bdi></label>)}
   </fieldset>;
  })}
 </section>;
}
