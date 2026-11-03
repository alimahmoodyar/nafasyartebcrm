'use client';
import {useState} from 'react';
import {MaterialSelect} from './material-select';
import {NumberInput} from './number-input';
export function ProductLabelSettings({data,onSaved}:{data:any;onSaved:()=>Promise<void>}){
 const [productId,setProductId]=useState(''),[smallLabels,setSmallLabels]=useState<number|string>(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[operation,setOperation]=useState(()=>crypto.randomUUID());
 return <section className="routine-production__card"><h3>تنظیمات برچسب محصول</h3><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const old=data.labels?.find((l:any)=>l.data.productId===productId),r=await fetch('/api/flow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:operation,confirmed:true,mode:'capacity',productId,smallLabels:Number(smallLabels),revision:old?.revision||0})}),v:any=await r.json();if(!r.ok)throw Error(v.error);await onSaved();setOperation(crypto.randomUUID());}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>
 <fieldset disabled={busy} className="form-grid"><MaterialSelect title="محصول" value={productId} onChange={id=>{setProductId(id);setSmallLabels(data.labels?.find((l:any)=>l.data.productId===id)?.data.smallLabels??'');setOperation(crypto.randomUUID());setError('')}} choices={data.products.map((p:any)=>({id:p.id,code:p.code,name:p.name}))}/><label className="field">تعداد برچسب کوچک برای هر دستگاه؛ صفر یعنی بدون برچسب کوچک<NumberInput type="number" fieldKey="smallLabels" required min={0} max={20} value={smallLabels} onChange={e=>{setSmallLabels(e.target.value);setOperation(crypto.randomUUID())}}/></label><button className="btn primary" disabled={!productId||smallLabels===''}>تأیید و ذخیره برچسب</button></fieldset>{error&&<p role="alert" className="notice error">{error}</p>}
 </form></section>;
}
