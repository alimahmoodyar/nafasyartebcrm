'use client';
import {useRef,useState} from 'react';

import {CameraCodeScanner} from './camera-code-scanner';
import {normalizeTransportScan} from '@/lib/transport-scan-contract';
export type CartonSerial={deviceId:string;serial:string;model:string};
export function CartonSerials({items,selected,onChange,manual=true,camera=false,disabled=false}:{items:CartonSerial[];selected:string[];onChange:(ids:string[])=>void;manual?:boolean;camera?:boolean;disabled?:boolean}){
 const [code,setCode]=useState(''),[error,setError]=useState('');
 const latest=useRef(selected);latest.current=selected;
 const chosen=new Set(selected);
 const models=new Map<string,CartonSerial[]>();
 for(const item of items){const model=item.model||'مدل ثبت‌نشده';models.set(model,[...(models.get(model)||[]),item]);}
 function scan(value=code){
  if(disabled)return;
  const matches=items.filter(row=>normalizeTransportScan(row.serial)===normalizeTransportScan(value));
  const item=matches.length===1?matches[0]:undefined;
  if(!item){setError('این سریال در فهرست این حواله نیست.');return;}
  if(latest.current.includes(item.deviceId)){setError('این سریال قبلاً علامت خورده است.');return;}
  const next=[...latest.current,item.deviceId];latest.current=next;onChange(next);setCode('');setError('');
 }
 return <section className="flow-card" style={{gridColumn:'1 / -1'}}>
  {camera&&<CameraCodeScanner onScan={scan} disabled={disabled}/>}
  <label className="field">اسکن سریال کارتن<input disabled={disabled} maxLength={3000} dir="ltr" autoComplete="off" value={code} onChange={e=>{setCode(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();if(code.trim())scan();}}}/></label>
  <button type="button" className="btn" disabled={disabled||!code.trim()} onClick={()=>scan()}>افزودن سریال اسکن‌شده</button>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {[...models].map(([model,rows])=>{
   const marked=rows.filter(row=>chosen.has(row.deviceId)).length;
   return <fieldset key={model}><legend>{model} · {marked.toLocaleString('fa-IR')} از {rows.length.toLocaleString('fa-IR')}</legend>
    {manual&&<button type="button" className="btn" disabled={disabled} onClick={()=>onChange(marked===rows.length?selected.filter(id=>!rows.some(row=>row.deviceId===id)):[...new Set([...selected,...rows.map(row=>row.deviceId)])])}>{marked===rows.length?'برداشتن تیک‌های این مدل':'انتخاب همهٔ سریال‌های این مدل'}</button>}
    {rows.map(row=><label className="flow-check" key={row.deviceId}><input type="checkbox" checked={chosen.has(row.deviceId)} disabled={disabled||!manual} onChange={e=>onChange(e.target.checked?[...selected,row.deviceId]:selected.filter(id=>id!==row.deviceId))}/><bdi>{row.serial}</bdi></label>)}
   </fieldset>;
  })}
 </section>;
}
