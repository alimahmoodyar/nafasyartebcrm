'use client';
import {useEffect,useState} from 'react';
import {eventApi,PeoplePicker,type Person} from './event-controls';
import {ExhibitionVisits} from './exhibition-visits';
import {SolarDate} from './solar-date';
import {formatDate,localDay} from '@/lib/persian-date';
type Event={id:string;name:string;brief:string;place:string;managerName:string;team:string[];start:string;end:string};
type Directory={manager:boolean;events:Event[]};
export function EventProfileLink(){
 const [visible,set]=useState(false);
 useEffect(()=>{let active=true;eventApi<Directory>('').then(d=>{if(active)set(d.manager||d.events.length>0)}).catch(()=>{});return ()=>{active=false}},[]);
 return visible?<a className="btn" href="/events">رویدادهای من</a>:null;
}
export function EventDirectory(){
 const [list,setList]=useState<Directory>(),[active,select]=useState<Event>(),[create,creating]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [manager,setManager]=useState<Person[]>([]),[team,setTeam]=useState<Person[]>([]),[start,setStart]=useState(localDay()),[end,setEnd]=useState(localDay());
 async function load(){setError('');try{setList(await eventApi<Directory>(''))}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load()},[]);
 async function save(form:HTMLFormElement){setBusy(true);setError('');const data=Object.fromEntries(new FormData(form));try{await eventApi('',{...data,start,end,mode:'create',manager:manager[0].id,team:team.map(m=>m.id)});creating(false);setTeam([]);setManager([]);await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <main dir="rtl" className="flow-card" style={{maxWidth:850,margin:'20px auto',padding:20}}><a href="/">خانهٔ هم‌نفس</a><h2>رویدادهای من</h2>{error&&<p role="alert">{error} <button className="btn" onClick={()=>void load()}>تلاش دوباره</button></p>}
 {active?<><p>{active.brief}</p><small>مسئول رویداد: {active.managerName} · {active.team.length.toLocaleString('fa-IR')} عضو غرفه · {active.place} · {formatDate(active.start)} تا {formatDate(active.end)}</small><ExhibitionVisits key={active.id} managed={active} onExit={()=>select(undefined)}/></>:create?<form onSubmit={e=>{e.preventDefault();void save(e.currentTarget)}}><fieldset disabled={busy}><legend>تعریف رویداد</legend><div className="formgrid"><label className="field">نام و دوره<input name="name" maxLength={120} required/></label><label className="field">محل<input name="place" maxLength={200}/></label><SolarDate label="شروع" value={start} onChange={setStart}/><SolarDate label="پایان" value={end} onChange={setEnd}/><label className="field">خلاصه رویداد<textarea name="brief" maxLength={1500}/></label></div><PeoplePicker label="مسئول رویداد" values={manager} onChange={setManager}/><PeoplePicker label="اعضای غرفه" multi values={team} onChange={setTeam}/><button className="btn primary" disabled={!manager.length||!team.length}>ذخیرهٔ رویداد</button><button className="btn" type="button" onClick={()=>creating(false)}>بازگشت</button></fieldset></form>:<>{list?.manager&&<button className="btn primary" onClick={()=>creating(true)}>تعریف رویداد</button>}{list?.events.map(e=><article className="flow-card" key={e.id}><strong>{e.name}</strong><p>{e.brief}</p><button className="btn" onClick={()=>select(e)}>باز کردن رویداد</button></article>)}{list&&!list.events.length&&<p>هنوز رویدادی برای شما تعریف نشده است.</p>}</>}</main>
}
