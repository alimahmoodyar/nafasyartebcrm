'use client';
import {useEffect,useRef,useState} from 'react';
import {CameraCodeScanner} from './camera-code-scanner';
import {incomingQcCode} from '@/lib/incoming-qc-contract';
export function IncomingQcScanner({onResolved}:{onResolved:(data:any)=>void|Promise<void>}){
 const [open,setOpen]=useState(false),[code,setCode]=useState(''),[error,setError]=useState(''),[data,setData]=useState<any>(null),[loading,setLoading]=useState(false),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++},[]);
 async function scan(raw:string){if(!incomingQcCode(raw,window.location.origin)){setError('لیبل بچ همین سامانه را اسکن کنید؛ کد کالا به‌تنهایی کافی نیست.');return}const n=++sequence.current;setOpen(false);setLoading(true);setError('');setData(null);try{const r=await fetch('/api/incoming-qc?'+new URLSearchParams({code:raw}),{cache:'no-store'}),d:any=await r.json();if(!r.ok)throw Error(d.error||'ردیف کنترل کیفیت پیدا نشد.');if(n!==sequence.current)return;setData(d);if(d.receipt)await onResolved(d)}catch(e){if(n===sequence.current)setError((e as Error).message)}finally{if(n===sequence.current)setLoading(false)}}
 return <section dir="rtl"><button className="btn primary" disabled={loading} onClick={()=>{setOpen(v=>!v);setError('')}}>اسکن لیبل کنترل ورودی</button>{open&&<><CameraCodeScanner autoStart onScan={scan}/><form className="tools" onSubmit={e=>{e.preventDefault();void scan(code)}}><label className="field">شماره بچ یا متن QR لیبل<textarea maxLength={3000} value={code} onChange={e=>setCode(e.target.value)}/></label><button className="btn">بازکردن فرم همین ردیف</button></form></>}{loading&&<p role="status">در حال شناسایی ردیف ورودی…</p>}{error&&<p className="notice error" role="alert">{error}</p>}{data&&!data.receipt&&<p className="notice">{data.batch.name} · {data.batch.code} · {data.message}</p>}</section>;
}
