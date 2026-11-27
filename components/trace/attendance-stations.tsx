'use client';
import {StationSounds} from './station-sounds';
import {useEffect,useState} from 'react';
type Mode='in'|'out'|'both';
type Station={id:string,name:string,location:string,state:string,mode:Mode};
const labels={in:'فقط ورود',out:'فقط خروج',both:'ورود و خروج'};
async function request(url:string,method='GET',payload?:unknown){
 const response=await fetch(url,{method,cache:'no-store',headers:payload?{'Content-Type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined});
 const result:any=await response.json();
 if(!response.ok)throw Error(result.error||'ارتباط با سامانه برقرار نشد.');
 return result;
}
export function AttendanceStations({back}:{back:()=>void}){
 const [stations,setStations]=useState<Station[]>([]),[name,setName]=useState(''),[location,setLocation]=useState(''),[mode,setMode]=useState<Mode>('both');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[next,setNext]=useState('');
 const endpoint='/api/personnel/stations';
 async function list(after=''){
  const r=await request(endpoint+(after?'?after='+encodeURIComponent(after):''));
  setStations(old=>after?[...old,...r.stations]:r.stations);setNext(r.next||'');
 }
 useEffect(()=>{void list().catch(e=>setError(e.message))},[]);
 async function link(){
  setBusy(true);setError('');
  try{const result=await request(endpoint,'POST',{name:name.trim(),location:location.trim(),mode});
   window.location.assign('/attendance-station/index.html#ticket='+encodeURIComponent(result.ticket));
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function revoke(s:Station){
  if(!window.confirm('اتصال ایستگاه «'+s.name+'» قطع شود؟ پیش از قطع، ترددهای ذخیره‌شده را ارسال کنید.'))return;
  setBusy(true);setError('');
  try{await request(endpoint,'DELETE',{id:s.id});await list()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="panel inside" dir="rtl"><header className="tools"><h2>ایستگاه‌های حضور و غیاب</h2><button className="btn" onClick={back}>بازگشت</button></header><form onSubmit={e=>{e.preventDefault();void link()}}><label className="field">نام ایستگاه<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label className="field">محل نصب<input required maxLength={100} value={location} onChange={e=>setLocation(e.target.value)}/></label><label className="field">نوع تردد<select value={mode} onChange={e=>setMode(e.target.value as Mode)}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="btn primary" disabled={busy||!name.trim()||!location.trim()}>نصب و اتصال روی این سیستم</button></form>{error&&<p role="alert">{error}</p>}<StationSounds/><h3>ایستگاه‌های شرکت</h3>{stations.map(s=><article className="flow-card" key={s.id}><strong>{s.name}</strong><p>{s.location} · {labels[s.mode]} · {s.state==='active'?'متصل':s.state==='pending'?'در انتظار اتصال':'قطع‌شده'}</p>{s.state!=='revoked'&&<button className="btn" disabled={busy} onClick={()=>void revoke(s)}>قطع اتصال</button>}</article>)}{next&&<button className="btn" disabled={busy} onClick={()=>void list(next).catch(e=>setError(e.message))}>بیشتر</button>}</section>
}
