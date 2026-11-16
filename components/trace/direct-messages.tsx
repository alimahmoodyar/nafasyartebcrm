'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Paperclip,Search,ArrowRight,FileText,MessageCircle} from 'lucide-react';
import {VoiceMessageRecorder} from './voice-message-recorder';
import {formatDate} from '@/lib/persian-date';

type Contact={id:string;name:string;active:boolean;positions?:string[];avatarUrl?:string|null};
type Thread={id:string;title:string;kind:string;recipientType:string;sender:string;senderName:string;recipientId:string;recipientName:string;isSender:boolean;state:string;updated:string;revision:number;unread:boolean;lastMessage?:string;link?:unknown};
type Message={id:string;author:string;created:string;body:string;mode:string;sentRevision?:number};
type Conversation={me:string;thread:Thread;messages:Message[];nextOffset:number|null;peerReadRevision:number;files:{id:string;filename:string;purpose?:string;audioMime?:string;byteSize?:number;durationMs?:number}[]};
type Mailbox={me:string;threads:Thread[];limited:boolean};
const clock=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit'});
const direct=(t:Thread)=>t.kind==='message'&&t.recipientType==='person';
const peer=(t:Thread)=>t.isSender?t.recipientId:t.sender;
const open=(t:Thread)=>!['closed','cancelled','completed'].includes(t.state);
const searchKey=(value:string)=>value.replace(/ي/g,'ی').replace(/ك/g,'ک').toLocaleLowerCase('fa').trim();
async function request<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...options});
 const result:unknown=await response.json();
 if(!response.ok){
  const message=result&&typeof result==='object'&&'error' in result&&typeof result.error==='string'?result.error:'';
  throw Error(message||'ارتباط با صندوق پیام انجام نشد.');
 }
 return result as T;
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
 const [voiceActive,setVoiceActive]=useState(false),[messageQuery,setMessageQuery]=useState(''),[showSearch,setShowSearch]=useState(false);
 const voiceChange=useCallback((active:boolean)=>setVoiceActive(active),[]);
 const uploadOperation=useRef<{file:File;recipient:string;mailbox:string;id:string;query:Record<string,string>}|null>(null);
 const composer=useRef<HTMLTextAreaElement>(null),list=useRef<HTMLDivElement>(null),contactRef=useRef(''),operation=useRef(false),refreshVersion=useRef(0);
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
  setMessageQuery('');setShowSearch(false);setVoiceActive(false);setContactId(id);setBody('');setDetails([]);setLimit(8);setError('');
 }
 const timeline=details.flatMap(d=>d.messages.map(m=>({m,d}))).sort((a,b)=>a.m.created.localeCompare(b.m.created)||a.m.id.localeCompare(b.m.id));
 const shownTimeline=messageQuery.trim()?timeline.filter(({m,d})=>searchKey(m.body+' '+(d.files.find(f=>m.id==='inbox-upload:'+f.id)?.filename||'')).includes(searchKey(messageQuery))):timeline;
 const lastMessage=timeline.at(-1)?.m.id;
 useEffect(()=>{const input=composer.current;if(input){input.style.height='auto';input.style.height=Math.min(140,input.scrollHeight)+'px';}},[body,contactId]);
 useEffect(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight},[contactId,lastMessage]);
 const target=threads.find(t=>open(t)&&!t.link);
 async function act(run:()=>Promise<void>){
  if(operation.current)return;
  operation.current=true;setBusy(true);setError('');
  try{await run();await refresh();window.dispatchEvent(new Event('nafasyar-tasks-changed'));return true;}
  catch(e){setError((e as Error).message);void refresh().catch(()=>{});return false;}
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
 async function attach(file:File,durationMs?:number){
  if(!contact?.active||!box)throw Error('مخاطب فعال انتخاب کنید.');
  const recipient=contact.id,mailbox=box.me;
  if(uploadOperation.current?.file!==file||uploadOperation.current.recipient!==recipient||uploadOperation.current.mailbox!==mailbox)uploadOperation.current={file,recipient,mailbox,id:crypto.randomUUID(),query:target?{thread:target.id}:{recipientId:recipient}};
  const operation=uploadOperation.current,voice=durationMs!==undefined,form=new FormData();form.set('file',file);if(voice)form.set('durationMs',String(durationMs));
  const q=new URLSearchParams({...operation.query,requestId:operation.id,...(voice?{purpose:'voice',confirmed:'true'}:{})});
  const saved=await act(async()=>{await request('/api/inbox/files?'+q,{method:'POST',headers:{'x-inbox-mailbox':mailbox},body:form})});
  if(!saved)throw Error('ارسال انجام نشد؛ فایل محفوظ است و می‌توانید دوباره ارسال کنید.');
  if(uploadOperation.current===operation)uploadOperation.current=null;
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
 return <div dir="rtl" className={'direct-messenger'+(contact?' has-thread':'')}>
  <div className="direct-chat-brand"><img src="/brand/nafasyar-icon.svg" alt=""/><strong>نفس‌یار</strong><span>پیام‌ها</span></div>
  {error&&<p className="notice error" role="alert">{error} <button type="button" className="btn" onClick={()=>void refresh().catch(e=>setError(e.message))}>تلاش دوباره</button></p>}
  <div className={'inbox-layout direct-chat'+(contact?' has-thread':'')}>
   <aside className="inbox-list"><h3>گفت‌وگوها</h3><label className="field">جست‌وجوی نام یا سمت<input placeholder="جست‌وجوی همکار…" type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    {ordered.map(c=>{
     const items=grouped.get(c.id)||[],unread=items.filter(t=>t.unread).length;
     return <button data-pair-open="direct-messages:397ee31dba32" data-pair-item={JSON.stringify([c.id])} type="button" key={c.id} className={'inbox-thread '+(c.id===contactId?'selected ':'')+(unread?'unread':'')} aria-pressed={c.id===contactId} onClick={()=>select(c.id)}><ContactIdentity contact={c}/>{items[0]?.lastMessage&&<span className="direct-chat-preview">{items[0].lastMessage}</span>}{items[0]&&<small>{formatDate(items[0].updated)} · {clock.format(new Date(items[0].updated))}</small>}{unread>0&&<small><span className="direct-chat-unread">{unread.toLocaleString('fa-IR')}</span> گفت‌وگوی خوانده‌نشده</small>}</button>;
    })}
    {!ordered.length&&<p>{box?'مخاطبی پیدا نشد.':'در حال دریافت مخاطب‌ها…'}</p>}
    {box?.limited&&<small>فهرست شامل ۳۰۰ گفت‌وگوی اخیر است.</small>}
   </aside>
   <section className="inbox-conversation" aria-label="گفت‌وگوی مستقیم">
    {!contact?<div className="empty direct-chat-empty"><MessageCircle size={52}/><h3>گفت‌وگو با همکاران</h3><p>برای شروع، یک مخاطب انتخاب کنید.</p></div>:<>
     <header><button data-pair-open="direct-messages:47b176ac5e26" type="button" className="btn inbox-back" aria-label="بازگشت به مخاطب‌ها" onClick={()=>select('')}><ArrowRight size={22}/></button><h3><ContactIdentity contact={contact}/></h3><button type="button" className="btn chat-icon direct-chat-search-toggle" aria-label="جست‌وجو در پیام‌ها" aria-expanded={showSearch} onClick={()=>{setShowSearch(!showSearch);setMessageQuery('')}}><Search size={20}/></button></header>{showSearch&&<label className="direct-message-search">جست‌وجو در پیام‌های بارگذاری‌شده<input type="search" value={messageQuery} placeholder="متن پیام یا نام فایل…" onChange={e=>setMessageQuery(e.target.value)}/></label>}
     <div className="inbox-messages" ref={list}>
      {(threads.length>limit||details.some(d=>d.nextOffset!==null))&&<button type="button" className="btn" disabled={busy||loading} onClick={()=>void older()}>پیام‌های قدیمی‌تر</button>}
      {loading&&!timeline.length&&<p role="status">در حال دریافت پیام‌ها…</p>}
      {!loading&&!timeline.length&&<p className="empty">هنوز پیامی در این گفت‌وگو نیست.</p>}
      {shownTimeline.map(({m,d},i)=>{
       const own=m.author===d.me,day=formatDate(m.created),read=own?(m.sentRevision!==undefined?d.peerReadRevision>=m.sentRevision:d.peerReadRevision>=d.thread.revision?true:null):null;
       const file=m.mode==='attachment'?d.files.find(f=>m.id==='inbox-upload:'+f.id):null;
       return <div data-pair-row={JSON.stringify(m.id)} key={m.id} className={'direct-chat-row'+(own?' own':'')}>{(!i||formatDate(shownTimeline[i-1].m.created)!==day)&&<time className="direct-chat-day">{day}</time>}<article className={'inbox-message'+(own?' own':'')}>{file?<div className="direct-chat-file">{file.purpose==='voice'?<><audio controls preload="none" src={'/api/inbox/files?thread='+encodeURIComponent(d.thread.id)+'&id='+encodeURIComponent(file.id)+'&view=play'} aria-label="پیام صوتی"/><a href={'/api/inbox/files?thread='+encodeURIComponent(d.thread.id)+'&id='+encodeURIComponent(file.id)}>دریافت پیام صوتی</a></>:<a href={'/api/inbox/files?thread='+encodeURIComponent(d.thread.id)+'&id='+encodeURIComponent(file.id)}><FileText size={28}/><span>{file.filename}{file.byteSize&&<small>{Math.ceil(file.byteSize/1024).toLocaleString('fa-IR')} کیلوبایت</small>}</span></a>}</div>:<p>{m.body}</p>}<small><time dateTime={m.created}>{clock.format(new Date(m.created))}</time>{read!==null&&(read?' · خوانده شده ✓✓':' · خوانده نشده ✓')}</small></article></div>;
      })}
     </div>
     {showSearch&&!shownTimeline.length&&<p className="direct-search-empty">در پیام‌های بارگذاری‌شده نتیجه‌ای پیدا نشد.</p>}
     {contact.active&&<div className={'direct-chat-composer'+(voiceActive?' voice-active':'')}>
      <form className="inbox-compose direct-chat-compose" onSubmit={event=>{event.preventDefault();if(!voiceActive)void send()}}>
       <button type="submit" title="ارسال پیام" aria-label="ارسال پیام" className="btn direct-chat-send" disabled={busy||voiceActive||!body.trim()}><img src="/brand/nafasyar-icon.svg" alt=""/></button>
       <div className="direct-chat-input"><textarea ref={composer} aria-label="متن پیام" rows={1} placeholder="پیام بنویسید…" value={body} maxLength={12000} disabled={busy||voiceActive} onChange={event=>setBody(event.target.value)} onKeyDown={event=>{if(event.key!=='Enter'||event.shiftKey||event.nativeEvent.isComposing||event.keyCode===229)return;event.preventDefault();if(!busy&&!voiceActive&&body.trim())event.currentTarget.form?.requestSubmit();}}/>
        <label className="btn chat-icon" title="پیوست فایل"><Paperclip size={22} aria-hidden="true"/><span className="sr-only">پیوست</span><input className="sr-only" type="file" aria-label="پیوست" disabled={busy||voiceActive} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.docx,.zip" onChange={event=>{const file=event.target.files?.[0];if(file)void attach(file).catch(()=>{});event.target.value=''}}/></label>
       </div>
      </form>
      <VoiceMessageRecorder key={box?.me+':'+contact.id} disabled={busy} onSend={attach} onActiveChange={voiceChange}/>
      {!voiceActive&&<small className="direct-chat-compose-help">Enter برای ارسال · Shift + Enter برای خط جدید</small>}
     </div>}

    </>}
   </section>
  </div>
 </div>;
}
