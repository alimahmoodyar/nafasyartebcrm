'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
export function TaskNotifier({accountId,onOpen}:{accountId:string;onOpen:()=>void}){
 const [count,setCount]=useState(0),[title,setTitle]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();setCount(0);setTitle('');async function refresh(){if(document.visibilityState==='hidden')return;try{await fetch('/api/tasks/tick',{method:'POST',signal:controller.signal});const r=await fetch('/api/tasks',{cache:'no-store',signal:controller.signal}),d=await r.json() as any;if(!active||!r.ok||d.accountId!==accountId)return;const unread=d.notifications.filter((n:any)=>!n.read_at);setCount(unread.length);setTitle(unread[0]?.message||'');}catch{}}
 const wake=()=>void refresh();void refresh();const timer=setInterval(wake,60000);window.addEventListener('nafasyar-tasks-changed',wake);document.addEventListener('visibilitychange',wake);return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('nafasyar-tasks-changed',wake);document.removeEventListener('visibilitychange',wake)}},[accountId]);
 if(!count)return null;return <button className="task-nudge" onClick={onOpen} title={title} aria-label={count+' اعلان وظیفه؛ باز کردن کارتابل'}><Bell size={18}/><span>پیگیری وظایف · {count.toLocaleString('fa-IR')}</span></button>
}
