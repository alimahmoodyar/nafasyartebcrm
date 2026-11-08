'use client';
import {useEffect,useRef,useState} from 'react';
import {Paperclip,Send} from 'lucide-react';
import {formatDate} from '@/lib/persian-date';

type Contact={id:string;name:string;active:boolean;positions?:string[];avatarUrl?:string|null};
type Thread={id:string;title:string;kind:string;recipientType:string;sender:string;senderName:string;recipientId:string;recipientName:string;isSender:boolean;state:string;updated:string;revision:number;unread:boolean;lastMessage?:string;link?:unknown};
type Message={id:string;author:string;created:string;body:string;mode:string;sentRevision?:number};
type Conversation={me:string;thread:Thread;messages:Message[];nextOffset:number|null;peerReadRevision:number;files:{id:string;filename:string}[]};
type Mailbox={me:string;threads:Thread[];limited:boolean};
const clock=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit'});
const direct=(t:Thread)=>t.kind==='message'&&t.recipientType==='person';
const peer=(t:Thread)=>t.isSender?t.recipientId:t.sender;
const open=(t:Thread)=>!['closed','cancelled','completed'].includes(t.state);
const searchKey=(value:string)=>value.replace(/ي/g,'ی').replace(/ك/g,'ک').toLocaleLowerCase('fa').trim();
async function request<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...options});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'ارتباط با صندوق پیام انجام نشد.');
 return result;
}
const post=(body:object)=>request<{threadId:string}>('/api/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

function ContactIdentity({contact}:{contact:Contact}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[contact.avatarUrl]);
 const title=contact.positions?.join('، ');
 return <span className="direct-chat-identity">
  {contact.avatarUrl&&!failed?<img src={contact.avatarUrl} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<span className="direct-chat-avatar" aria-hidden="true">{Array.from(contact.name.trim())[0]||'؟'}</span>}
  <span><strong>{contact.name}</strong>{title&&<small>{title}</small>}</span>
 </span>;
}
export function DirectMessages(){
 const [box,setBox]=useState<Mailbox|null>(null),[directory,setDirectory]=useState<Contact[]>([]),[contactId,setContactId]=useState(''),[query,setQuery]=useState(''),[body,setBody]=useState(''),[details,setDetails]=useState<Conversation[]>([]),[limit,setLimit]=useState(8),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const list=useRef<HTMLDivElement>(null),contactRef=useRef(''),operation=useRef(false),refreshVersion=useRef(0);
 const conversations=(box?.threads||[]).filter(direct);
 const contacts=new Map(directory.map(contact=>[contact.id,contact]));
 for(const thread of conversations){
  const id=peer(thread);
  if(!contacts.has(id))contacts.set(id,{id,name:thread.isSender?thread.recipientName:thread.senderName,active:false});
 }
 const contact=contacts.get(contactId);
 const grouped=new Map<string,Thread[]>();
 for(const thread of conversations){
  const id=peer(thread),group=grouped.get(id);
  if(group)group.push(thread);else grouped.set(id,[thread]);
 }
 const threads=grouped.get(contactId)||[], visible=threads.slice(0,limit);
 const signature=visible.map(t=>t.id+':'+t.revision).join(',');
 const ordered=[...contacts.values()].filter(c=>searchKey([c.name,...(c.positions||[])].join(" ")).includes(searchKey(query))).sort((a,b)=>(grouped.get(b.id)?.[0]?.updated||'').localeCompare(grouped.get(a.id)?.[0]?.updated||'')||a.name.localeCompare(b.name,'fa'));
 async function refresh(){
  const version=++refreshVersion.current;
  const result=await request<Mailbox>('/api/inbox');
  if(version===refreshVersion.current)setBox(result);
 }
 useEffect(()=>{
  let active=true;
  const failed=(e:Error)=>{if(active)setError(e.message)};
  const wake=()=>{if(!document.hidden)void refresh().catch(failed)};
  wake();
  void request<{me:string;people:Contact[]}>('/api/inbox?view=directory').then(result=>{if(active)setDirectory(result.people.filter(c=>c.id!==result.me).map(c=>({...c,active:true})))}).catch(failed);
  window.addEventListener('focus',wake);
  document.addEventListener('visibilitychange',wake);
  const timer=setInterval(wake,15000);
  return()=>{active=false;refreshVersion.current++;clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)};
 },[]);
 useEffect(()=>{
  let active=true;
  if(!visible.length){setLoading(false);return;}
  setLoading(true);
  void Promise.all(visible.map(t=>request<Conversation>('/api/inbox?thread='+encodeURIComponent(t.id)))).then(async result=>{
   if(!active)return;
   setDetails(previous=>result.map(next=>{
    const old=previous.find(item=>item.thread.id===next.thread.id);
    if(!old||old.messages.length<=50)return next;
    const merged=new Map([...old.messages,...next.messages].map(message=>[message.id,message]));
    return {...next,messages:[...merged.values()],nextOffset:old.nextOffset===null?null:old.nextOffset+Math.max(0,next.thread.revision-old.thread.revision)};
   }));
   const unread=result.filter(d=>d.thread.unread);
   if(!document.hidden&&unread.length){
    await Promise.all(unread.map(d=>post({id:crypto.randomUUID(),mode:'read',threadId:d.thread.id,revision:d.thread.revision,expectedMailbox:d.me})));
    if(active){
     window.dispatchEvent(new Event('nafasyar-tasks-changed'));
     await refresh();
    }
   }
  }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[contactId,signature,box]);
 function select(id:string){
  if(contactRef.current===id)return;
  contactRef.current=id;
  setContactId(id);setBody('');setDetails([]);setLimit(8);setError('');
 }
 const timeline=details.flatMap(d=>d.messages.map(m=>({m,d}))).sort((a,b)=>a.m.created.localeCompare(b.m.created)||a.m.id.localeCompare(b.m.id));
 const lastMessage=timeline.at(-1)?.m.id;
 useEffect(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight},[contactId,lastMessage]);
 const target=threads.find(t=>open(t)&&!t.link);
 async function act(run:()=>Promise<void>){
  if(operation.current)return;
  operation.current=true;setBusy(true);setError('');
  try{await run();await refresh();window.dispatchEvent(new Event('nafasyar-tasks-changed'))}
  catch(e){setError((e as Error).message);void refresh().catch(()=>{})}
  finally{operation.current=false;setBusy(false)}
 }
 async function send(){
  const text=body.trim();
  if(!contact?.active||!box||!text)return;
  await act(async()=>{
   const id=crypto.randomUUID(),expectedMailbox=box.me;
   if(target)await post({id,mode:'reply',threadId:target.id,revision:target.revision,body:text,expectedMailbox});
   else await post({id,mode:'create',recipientId:contact.id,recipientType:'person',kind:'message',priority:'normal',title:contact.name,body:text,expectedMailbox});
   if(contactRef.current===contact.id)setBody('');
  });
 }
 function attach(file:File){
  if(!target||!box)return;
  const form=new FormData();form.set('file',file);
  void act(async()=>{await request('/api/inbox/files?thread='+encodeURIComponent(target.id)+'&requestId='+crypto.randomUUID(),{method:'POST',headers:{'x-inbox-mailbox':box.me},body:form})});
 }
 async function older(){
  const selected=contactId;
  await act(async()=>{
   const pages=await Promise.all(details.filter(d=>d.nextOffset!==null).map(d=>request<Conversation>('/api/inbox?thread='+encodeURIComponent(d.thread.id)+'&offset='+d.nextOffset)));
   if(contactRef.current!==selected)return;
   setDetails(previous=>previous.map(d=>{
    const page=pages.find(p=>p.thread.id===d.thread.id);
    if(!page)return d;
    return {...d,messages:[...new Map([...page.messages,...d.messages].map(m=>[m.id,m])).values()],nextOffset:page.nextOffset};
   }));
   if(threads.length>limit)setLimit(limit+8);
  });
 }
 return <div dir="rtl">
  {error&&<p className="notice error" role="alert">{error} <button type="button" className="btn" onClick={()=>void refresh().catch(e=>setError(e.message))}>تلاش دوباره</button></p>}
  <div className={'inbox-layout direct-chat'+(contact?' has-thread':'')}>
   <aside className="inbox-list"><h3>مخاطب‌ها</h3><label className="field">جست‌وجوی مخاطب<input type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    {ordered.map(c=>{
     const items=grouped.get(c.id)||[],unread=items.filter(t=>t.unread).length;
     return <button type="button" key={c.id} className={'inbox-thread '+(c.id===contactId?'selected ':'')+(unread?'unread':'')} aria-pressed={c.id===contactId} onClick={()=>select(c.id)}><ContactIdentity contact={c}/>{items[0]?.lastMessage&&<span className="direct-chat-preview">{items[0].lastMessage}</span>}{items[0]&&<small>{formatDate(items[0].updated)} · {clock.format(new Date(items[0].updated))}</small>}{unread>0&&<small>{unread.toLocaleString('fa-IR')} گفت‌وگوی خوانده‌نشده</small>}</button>;
    })}
    {!ordered.length&&<p>{box?'مخاطبی پیدا نشد.':'در حال دریافت مخاطب‌ها…'}</p>}
    {box?.limited&&<small>فهرست شامل ۳۰۰ گفت‌وگوی اخیر است.</small>}
   </aside>
   <section className="inbox-conversation" aria-label="گفت‌وگوی مستقیم">
    {!contact?<p className="empty">برای شروع، یک مخاطب انتخاب کنید.</p>:<>
     <header><button type="button" className="btn inbox-back" onClick={()=>select('')}>مخاطب‌ها</button><h3><ContactIdentity contact={contact}/></h3></header>
     <div className="inbox-messages" ref={list}>
      {(threads.length>limit||details.some(d=>d.nextOffset!==null))&&<button type="button" className="btn" disabled={busy||loading} onClick={()=>void older()}>پیام‌های قدیمی‌تر</button>}
      {loading&&!timeline.length&&<p role="status">در حال دریافت پیام‌ها…</p>}
      {!loading&&!timeline.length&&<p className="empty">هنوز پیامی در این گفت‌وگو نیست.</p>}
      {timeline.map(({m,d},i)=>{
       const own=m.author===d.me,day=formatDate(m.created),read=own?(m.sentRevision!==undefined?d.peerReadRevision>=m.sentRevision:d.peerReadRevision>=d.thread.revision?true:null):null;
       const file=m.mode==='attachment'?d.files.find(f=>m.id==='inbox-upload:'+f.id):null;
       return <div key={m.id} className={'direct-chat-row'+(own?' own':'')}>{(!i||formatDate(timeline[i-1].m.created)!==day)&&<time className="direct-chat-day">{day}</time>}<article className={'inbox-message'+(own?' own':'')}>{file?<a href={'/api/inbox/files?thread='+encodeURIComponent(d.thread.id)+'&id='+encodeURIComponent(file.id)}>{file.filename}</a>:<p>{m.body}</p>}<small><time dateTime={m.created}>{clock.format(new Date(m.created))}</time>{read!==null&&(read?' · خوانده شده ✓✓':' · خوانده نشده ✓')}</small></article></div>;
      })}
     </div>
     {contact.active&&<form className="inbox-compose direct-chat-compose" onSubmit={event=>{event.preventDefault();void send()}}>
      <textarea aria-label="متن پیام" rows={2} placeholder="پیام بنویسید…" value={body} maxLength={12000} onChange={event=>setBody(event.target.value)}
       onKeyDown={event=>{
        if(event.key!=='Enter'||event.shiftKey||event.nativeEvent.isComposing||event.keyCode===229)return;
        event.preventDefault();
        if(!busy&&body.trim())event.currentTarget.form?.requestSubmit();
       }}/>
      {target&&<label className="btn"><Paperclip size={17} aria-hidden="true"/>پیوست<input type="file" aria-label="پیوست" disabled={busy} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.docx,.zip" onChange={event=>{const file=event.target.files?.[0];if(file)attach(file);event.target.value=''}}/></label>}
      <button type="submit" className="btn primary" disabled={busy||!body.trim()}><Send size={17} aria-hidden="true"/>ارسال</button>
     </form>}
    </>}
   </section>
  </div>
 </div>;
}
