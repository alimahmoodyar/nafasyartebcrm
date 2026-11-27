'use client';
import {useEffect,useState} from 'react';
import {SolarDate} from './solar-date';
import {formatDate,formatDateTime} from '@/lib/persian-date';
import type {VisitData} from '@/lib/exhibition-visits';

const blank:VisitData={person:'',phone:'',city:'',company:'',position:'',specialty:'',roles:'',subject:'',note:'',action:'',assignee:'',due:''};
type Visit={id:string;revision:number;updated:string;data:VisitData&{draft:boolean}};
type Member={id:string;name:string};
async function request<T>(query='',body?:unknown){
 const r=await fetch('/api/sales/exhibitions'+query,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const data=await r.json() as T&{error?:string};if(!r.ok)throw Error(data.error||'ثبت بازدید انجام نشد.');return data;
}
type KnownContact=Pick<VisitData,'phone'|'person'|'company'|'city'>;
export function ExhibitionVisits({contacts=[]}:{contacts?:KnownContact[]}){
 const [open,show]=useState(false),[events,setEvents]=useState<string[]>([]),[name,setName]=useState(''),[event,setEvent]=useState('');
 const [visits,setVisits]=useState<Visit[]>([]),[members,setMembers]=useState<Member[]>([]),[me,setMe]=useState('');
 const [form,setForm]=useState<VisitData>(blank),[id,setId]=useState(''),[revision,setRevision]=useState(0),[step,setStep]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reload,refresh]=useState(0),[notice,setNotice]=useState('');
 useEffect(()=>{if(!open)return;let active=true;setBusy(true);setError('');
 request<{members:Member[];me:string;visits:Visit[];events:string[]}>(event?'?event='+encodeURIComponent(event):'').then(r=>{if(!active)return;setMembers(r.members);setMe(r.me);if(event)setVisits(r.visits);else setEvents(r.events)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});
 return ()=>{active=false};
 },[open,event,reload]);
 function openEvent(value:string){setVisits([]);setEvent(value.trim());setNotice('');setId('')}
 function edit(v?:Visit){setForm(v?{...v.data}:{...blank});setRevision(v?.revision||0);setId(v?.id||'visit-'+crypto.randomUUID());setStep(0);setNotice('');setError('')}
 function change(k:keyof VisitData,v:string){setForm(f=>({...f,[k]:v}))}
 async function save(){setBusy(true);setError('');try{const result=await request<{draft:boolean}>('',{id,revision,event,fields:form,draft:step<2});setId('');setNotice(result.draft?'بازدید ناقص ذخیره شد. از همین فهرست می‌توانید تکمیلش کنید.':'بازدید ذخیره شد.');refresh(n=>n+1)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const digits=(v:string)=>(v||'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[ -]/g,'');
 const phone=digits(form.phone);
 const previous=!revision&&/^09[0-9]{9}$/.test(phone)?[...visits.map(v=>v.data),...contacts].find(c=>digits(c.phone)===phone&&c.person):undefined;
 const field=(key:keyof VisitData,label:string)=><label className="field">{label}<input value={form[key]} maxLength={200} type={key==='phone'?'tel':'text'} onChange={e=>change(key,e.target.value)}/></label>;
 if(!open)return <button className="btn" onClick={()=>show(true)}>غرفهٔ نمایشگاه</button>;
 return <section className="flow-card" aria-label="غرفهٔ نمایشگاه"><h3>{event||'غرفهٔ نمایشگاه'}</h3>
 {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error} {!id&&<button className="btn" onClick={()=>refresh(n=>n+1)}>تلاش دوباره</button>}</p>}
 {!event?<><label className="field">نام نمایشگاه و دوره<input value={name} maxLength={120} placeholder="مثلاً ایران‌هلث ۱۴۰۵" onChange={e=>setName(e.target.value)}/></label><div className="tools"><button className="btn primary" disabled={!name.trim()||busy} onClick={()=>openEvent(name)}>باز کردن غرفه</button><button className="btn" onClick={()=>show(false)}>بستن</button></div>{events.map(n=><button className="btn" key={n} onClick={()=>openEvent(n)}>{n}</button>)}</>
 :!id?<><div className="tools"><button className="btn primary" disabled={busy} onClick={()=>edit()}>ثبت بازدیدکننده</button><button className="btn" onClick={()=>openEvent('')}>نمایشگاه‌ها</button></div>{busy?<p>در حال دریافت…</p>:!visits.length&&!error?<p>هنوز بازدیدی ثبت نشده است.</p>:null}
 {visits.map(v=><article className="flow-card" key={v.id}><strong>{v.data.person||v.data.company||'بازدید بدون نام'}</strong><p>{v.data.draft?'نیاز به تکمیل':'ثبت‌شده'} · {formatDateTime(v.updated)}</p>{v.data.action&&<p>{[v.data.action,members.find(m=>m.id===v.data.assignee)?.name,v.data.due&&formatDate(v.data.due)].filter(Boolean).join(' · ')}</p>}<button className="btn" onClick={()=>edit(v)}>باز کردن بازدید</button></article>)}</>
 :<fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}><legend>{['۱ از ۳ · مشخصات فرد','۲ از ۳ · مجموعه و فعالیت','۳ از ۳ · گفت‌وگو و پیگیری'][step]}</legend><div className="formgrid">
 {step===0&&<>{field('phone','شماره همراه')}{previous&&<button className="btn" onClick={()=>setForm(f=>({...f,person:f.person||previous.person,city:f.city||previous.city,company:f.company||previous.company,position:f.position||('position' in previous?String(previous.position):''),specialty:f.specialty||('specialty' in previous?String(previous.specialty):'')}))}>استفاده از مشخصات {previous.person}</button>}{field('person','نام و نام خانوادگی')}{field('city','شهر')}</>}
 {step===1&&<>{field('company','نام مجموعه یا محل فعالیت')}{field('position','سمت')}{field('specialty','حوزهٔ کاری')}{field('roles','نقش در خرید')}</>}
 {step===2&&<>{field('subject','محصول یا موضوع گفت‌وگو')}<label className="field">قدم بعدی<select value={form.action} onChange={e=>{const action=e.target.value;setForm(f=>({...f,action,assignee:action?f.assignee||me:'',due:action?f.due:''}))}}><option value="">بدون پیگیری</option>{['تماس تلفنی','ارسال کاتالوگ','هماهنگی دمو','ارسال پیش‌فاکتور'].map(a=><option key={a}>{a}</option>)}</select></label>{form.action&&<><label className="field">مسئول پیگیری<select value={form.assignee} onChange={e=>change('assignee',e.target.value)}><option value="">بعداً انتخاب می‌کنم</option><option value={me}>خودم</option>{members.filter(m=>m.id!==me).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><SolarDate label="موعد پیگیری" required={false} value={form.due} onChange={v=>change('due',v)}/></>}<label className="field">یادداشت<textarea maxLength={2000} value={form.note} onChange={e=>change('note',e.target.value)}/></label></>}
 </div><div className="tools" style={{position:'sticky',bottom:0,zIndex:2,background:'var(--card,Canvas)',padding:'10px 4px',borderTop:'1px solid var(--border,#ddd)'}}><button className="btn primary" onClick={()=>void save()}>{busy?'در حال ذخیره…':'ذخیره و خروج'}</button>{step<2&&<button className="btn" onClick={()=>setStep(step+1)}>ادامه</button>}{step>0&&<button className="btn" onClick={()=>setStep(step-1)}>بازگشت</button>}</div></fieldset>}</section>;
}
