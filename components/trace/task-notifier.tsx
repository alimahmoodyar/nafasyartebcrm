'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';

type Work={title:string;hint?:string};
type TaskSummary={
 accountId:string;profileReview?:{id:string}|null;positionWork:Work[];memberId:string;
 tasks:{assignee:string;state:string;data:{title:string};guidance?:{steps?:string[]}}[];
};
type InboxSummary={accountId:string;me:string;threads:{kind:string;recipientType:string;unread:boolean}[]};

export function TaskNotifier({accountId,profileId='',onOpen}:{accountId:string;profileId?:string;onOpen:(target?:string)=>void}){
 const [work,setWork]=useState<Work[]>([]),[messages,setMessages]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  let generation=0;
  async function read<T>(path:string):Promise<T>{
   const response=await fetch(path,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Cartable unavailable');
   return response.json();
  }
  async function refresh(){
   if(document.hidden)return;
   const current=++generation;
   if(!profileId)await fetch('/api/tasks/tick',{method:'POST',signal:controller.signal}).catch(()=>{});
   if(controller.signal.aborted||current!==generation)return;
   const [tasks,inbox]=await Promise.allSettled([read<TaskSummary>('/api/tasks'),read<InboxSummary>('/api/inbox')]);
   if(controller.signal.aborted||current!==generation)return;
   if(tasks.status==='fulfilled'&&tasks.value.accountId===accountId&&(tasks.value.profileReview?.id||'')===profileId){
    const {positionWork,tasks:personal,memberId}=tasks.value;
    setWork(profileId?positionWork:personal
     .filter(task=>task.assignee===memberId&&['open','blocked'].includes(task.state))
     .map(task=>({title:task.data.title,hint:task.guidance?.steps?.[0]})));
   }
   if(inbox.status==='fulfilled'&&inbox.value.accountId===accountId&&
    (profileId?inbox.value.me==='@profile:'+profileId:!inbox.value.me.startsWith('@profile:'))){
    setMessages(inbox.value.threads.filter(thread=>thread.kind==='message'&&thread.recipientType==='person'&&thread.unread).length);
   }
  }
  const wake=()=>void refresh();
  wake();
  const timer=setInterval(wake,60000);
  window.addEventListener('nafasyar-tasks-changed',wake);
  document.addEventListener('visibilitychange',wake);
  return()=>{
   controller.abort();
   clearInterval(timer);
   window.removeEventListener('nafasyar-tasks-changed',wake);
   document.removeEventListener('visibilitychange',wake);
  };
 },[accountId,profileId]);
 if(!work.length&&!messages)return null;
 const counts=work.length.toLocaleString('fa-IR')+' کار فرایندی باز · '+messages.toLocaleString('fa-IR')+' پیام مستقیم خوانده‌نشده';
 return <div className="task-nudge"><button className="link" onClick={()=>onOpen(work.length?'':'inbox')} title={work[0]?.title} aria-label={counts+'؛ باز کردن کارتابل'}><Bell size={18}/>{work[0]&&<span className="task-question">{work[0].title}{work[0].hint&&' · '+work[0].hint}</span>}<span>{counts}</span></button></div>;
}
