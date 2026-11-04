'use client';
import {useEffect,useState} from 'react';
import {formatDateTime} from '@/lib/persian-date';
export function BomList({lines,title}:{lines:{partCode:string;name:string;quantity:string;unit:string}[];title:string}){
 return <div style={{maxHeight:420,overflow:'auto'}}><table className="stocktable"><caption>{title} · {lines.length.toLocaleString('fa-IR')} قلم</caption><thead><tr><th>ردیف</th><th>کد کالا</th><th>نام کالا</th><th>مصرف استاندارد یک دستگاه</th><th>واحد</th></tr></thead><tbody>{lines.map((l,i)=><tr key={l.partCode}><td>{(i+1).toLocaleString('fa-IR')}</td><td><bdi>{l.partCode}</bdi></td><td>{l.name}</td><td><bdi>{l.quantity}</bdi></td><td>{l.unit}</td></tr>)}</tbody></table></div>;
}
export function DeviceBom({deviceId,demo}:{deviceId:string;demo:boolean}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(demo)return;const controller=new AbortController();setData(null);setError('');fetch('/api/device-bom?deviceId='+encodeURIComponent(deviceId),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json() as any;if(!r.ok)throw Error(d.error);if(!controller.signal.aborted)setData(d)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'دریافت انجام نشد.')});return()=>controller.abort()},[deviceId,demo,retry]);
 return <section className="detailsection"><h2>فهرست کامل BOM این سریال</h2>{demo?<p>نمایش نسخه متصل به سریال در اطلاعات واقعی شرکت در دسترس است.</p>:error?<><p role="alert">{error}</p><button type="button" className="btn" onClick={()=>setRetry(n=>n+1)}>تلاش دوباره</button></>:!data?<p role="status">در حال دریافت BOM سریال…</p>:<>{data.notice&&<p className="subtle">{data.notice}</p>}{data.bom&&<><p>نسخه {data.bom.version.toLocaleString('fa-IR')} · ثبت نسخه: {formatDateTime(data.bom.created)}</p><BomList lines={data.bom.lines} title="مواد و قطعات نسخه مبنای این سریال"/></>}</>}</section>;
}
