'use client';
import {useEffect,useState} from 'react';
type Kind='in'|'out';
type Sounds=Record<Kind,{name:string}|null>;
const titles={in:'صدای خوش‌آمدگویی',out:'صدای خروج'};
const endpoint='/api/personnel/stations/audio';
export function StationSounds(){
 const [sounds,setSounds]=useState<Sounds|null>(null),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 async function load(){
  const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error('دریافت تنظیمات صدا ممکن نشد.');
  setSounds(await r.json() as Sounds);
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
 async function change(kind:Kind,file?:File){
  setMessage('');setError('');
  if(file&&file.size>2097152){setError('حداکثر اندازهٔ هر فایل ۲ مگابایت است.');return}
  if(!file&&!window.confirm('فایل «'+titles[kind]+'» حذف شود؟'))return;
  setBusy(true);
  try{
   const form=new FormData();form.append('kind',kind);if(file)form.append('file',file);
   const r=await fetch(endpoint,file?{method:'PUT',body:form}:{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})});
   if(!r.ok){const result:any=await r.json();throw Error(result.error||'تغییر فایل ذخیره نشد.')}
   await load();setRevision(v=>v+1);setMessage(titles[kind]+(file?' ذخیره شد.':' حذف شد.'));
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="panel inside"><h3>صداهای ورود و خروج</h3><p>فایل MP3 یا WAV تا ۲ مگابایت. ایستگاه‌ها هنگام اتصال فایل‌ها را دریافت می‌کنند.</p>
 <div className="flow-grid">{(['in','out'] as const).map(kind=><article className="flow-card" key={kind}><h4>{titles[kind]}</h4>{sounds&&<p>{sounds[kind]?.name||'فایلی انتخاب نشده است.'}</p>}{sounds?.[kind]&&<audio key={revision} controls preload="none" src={endpoint+'/sound?kind='+kind+'&v='+revision}/>}
 <label className="field">{sounds?.[kind]?'جایگزینی فایل':'بارگذاری فایل'}<input type="file" aria-label={titles[kind]} accept=".mp3,.wav,audio/mpeg,audio/wav" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void change(kind,file)}}/></label>
 {sounds?.[kind]&&<button className="btn" disabled={busy} onClick={()=>void change(kind)}>حذف فایل</button>}</article>)}</div>
 {busy&&<p role="status">در حال ذخیره…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>
}
