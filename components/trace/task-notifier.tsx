'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';

type ProfileScope={id:string;buyerId?:string;missionId?:string};
type Work={title:string;hint?:string};
type TaskSummary={
 accountId:string;profileReview?:ProfileScope|null;positionWork:Work[];memberId:string;
 tasks:{assignee:string;state:string;data:{title:string};guidance?:{steps?:string[]}}[];
};
type InboxSummary={accountId:string;me:string;threads:{kind:string;recipientType:string;isRecipient:boolean;unread:boolean}[]};

export function TaskNotifier({accountId,profile,onOpen}:{accountId:string;profile?:ProfileScope;onOpen:(target?:string)=>void}){
 const profileId=profile?.id||'',buyerId=profile?.buyerId||'',missionId=profile?.missionId||'';
 const [work,setWork]=useState<Work[]>([]),[messages,setMessages]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  let generation=0;
  async function read<T>(path:string):Promise<T>{
   const response=await fetch(path,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Cartable unavailable');
   return {data:await response.json() as T,isolated:response.headers.get('X-Training-Workspace')==='isolated'};
  }
  async function refresh(){
   if(document.hidden)return;
   const current=++generation;
   if(!profileId)await fetch('/api/tasks/tick',{method:'POST',signal:controller.signal}).catch(()=>{});
   if(controller.signal.aborted||current!==generation)return;
   const [tasks,inbox]=await Promise.allSettled([read<TaskSummary>('/api/tasks'),read<InboxSummary>('/api/inbox')]);
   if(controller.signal.aborted||current!==generation)return;
   const taskSummary=tasks.status==='fulfilled'?tasks.value.data:null;
   const scope=taskSummary?.profileReview;
   const sample=tasks.status==='fulfilled'&&tasks.value.isolated&&profileId==='sales-representative'&&!buyerId;
   const taskScopeMatches=(scope?.id||'')===profileId&&(sample||(scope?.buyerId||'')===buyerId)&&(scope?.missionId||'')===missionId;
   if(tasks.status==='fulfilled'&&taskSummary?.accountId===accountId&&taskScopeMatches){
    const {positionWork,tasks:personal,memberId}=taskSummary;
    setWork(profileId?positionWork:personal
     .filter(task=>!!memberId&&task.assignee===memberId&&['open','blocked'].includes(task.state))
     .map(task=>({title:task.data.title,hint:task.guidance?.steps?.[0]})));
   }else setWork([]);
   if(inbox.status==='fulfilled'&&inbox.value.data.accountId===accountId&&
    (profileId?inbox.value.data.me==='@profile:'+profileId:!inbox.value.data.me.startsWith('@profile:'))){
    setMessages(inbox.value.data.threads.filter(thread=>thread.kind==='message'&&thread.recipientType==='person'&&thread.isRecipient&&thread.unread).length);
   }else setMessages(0);
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
 },[accountId,profileId,buyerId,missionId]);
 if(!work.length&&!messages)return null;
 const counts=work.length.toLocaleString('fa-IR')+' کار فرایندی باز · '+messages.toLocaleString('fa-IR')+' پیام مستقیم خوانده‌نشده';
 return <div className="task-nudge"><button className="link" onClick={()=>onOpen(work.length?'':'inbox')} title={work[0]?.title} aria-label={counts+'؛ باز کردن کارتابل'}><Bell size={18}/>{work[0]&&<span className="task-question">{work[0].title}{work[0].hint&&' · '+work[0].hint}</span>}<span>{counts}</span></button></div>;
}
