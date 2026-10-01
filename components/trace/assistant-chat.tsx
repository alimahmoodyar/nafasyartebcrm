'use client';
import {useEffect,useRef,useState} from 'react';
import {Bot,MessageCircle,Send,X,LoaderCircle} from 'lucide-react';
type Message={role:'user'|'assistant';text:string};
export function AssistantChat({admin,onSettings,accountId,accountName,onAccountChanged}:{admin:boolean;onSettings:()=>void;accountId:string;accountName:string;onAccountChanged:()=>void}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[profiles,setProfiles]=useState<{id:string;name:string;model:string}[]>([]),[profile,setProfile]=useState(''),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const bottom=useRef<HTMLDivElement>(null),editor=useRef<HTMLTextAreaElement>(null),launcher=useRef<HTMLButtonElement>(null),pending=useRef<{id:string;text:string}|null>(null);
 const epoch=useRef(0),changed=useRef(onAccountChanged);changed.current=onAccountChanged;
 useEffect(()=>{setMessages([]);setInput('');pending.current=null;return()=>{epoch.current++}},[accountId]);
 useEffect(()=>{if(!open)return;let active=true;let controller:AbortController;
  function clear(){epoch.current++;controller?.abort();setMessages([]);setInput('');pending.current=null;setBusy(false);}
  async function refresh(){clear();const generation=epoch.current;controller=new AbortController();setLoading(true);setError('');try{
   const r=await fetch('/api/assistant',{cache:'no-store',headers:{'x-assistant-account':accountId},signal:controller.signal}),d=await r.json() as any;
   if(!active||generation!==epoch.current)return;
   if(r.status===401||r.status===409){changed.current();return;}if(!r.ok)throw new Error(d.error);
   if(d.accountId!==accountId){changed.current();return;}
   setProfiles(d.profiles);setProfile(p=>d.profiles.some((v:any)=>v.id===p)?p:d.profiles[0]?.id||'');setMessages(d.history.flatMap((h:any)=>[{role:'user',text:h.question},{role:'assistant',text:h.answer}]));
  }catch(e){if(active&&generation===epoch.current)setError((e as Error).message)}finally{if(active&&generation===epoch.current)setLoading(false)}}
  const visibility=()=>{if(document.visibilityState==='hidden')clear();else void refresh()};
  const switchAccount=()=>{clear();changed.current()};
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('nafasyar-account'):null;if(channel)channel.onmessage=switchAccount;
  const focus=()=>void refresh();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
  void refresh();return()=>{active=false;epoch.current++;controller?.abort();channel?.close();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility)};
 },[open,accountId]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:'nearest'})},[messages,busy,open]);
 useEffect(()=>{if(open)editor.current?.focus()},[open,loading]);
 function close(){epoch.current++;setMessages([]);setInput('');pending.current=null;setBusy(false);setOpen(false);launcher.current?.focus();}
 async function send(){const question=input.trim();if(!question||busy||!profile||loading)return;const generation=epoch.current;setBusy(true);setError('');if(pending.current?.text!==question)pending.current={id:crypto.randomUUID(),text:question};try{
 const r=await fetch('/api/assistant',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','x-assistant-account':accountId},body:JSON.stringify({requestId:pending.current.id,profileId:profile,message:question})});const d=await r.json() as any;
 if(generation!==epoch.current)return;
 if(r.status===401||r.status===409&&d.error?.includes('حساب ورود')){setMessages([]);changed.current();return;}if(!r.ok)throw new Error(d.error);
 const check=await fetch('/api/session',{cache:'no-store'}),current=await check.json() as any;if(generation!==epoch.current)return;
 if(!check.ok||current.userId!==accountId||d.accountId!==accountId){setMessages([]);changed.current();return;}
 setMessages(m=>[...m,{role:'user',text:question},{role:'assistant',text:d.answer}]);setInput('');pending.current=null;
 }catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'ارسال انجام نشد.')}finally{if(generation===epoch.current)setBusy(false)}}
 return <div className="assistant-widget" dir="rtl">{open&&<section className="assistant-window" role="dialog" aria-label="گفتگو با دستیار نفس‌یار" onKeyDown={e=>{if(e.key==='Escape')close()}}><header className="assistant-header"><Bot size={24}/><div><strong>دستیار نفس‌یار</strong><p>گفتگوی خصوصی · {accountName}</p></div><button type="button" aria-label="بستن گفتگو" onClick={close}><X size={20}/></button></header><div className="assistant-model"><label htmlFor="assistant-profile">مدل</label><select id="assistant-profile" value={profile} disabled={busy||loading} onChange={e=>setProfile(e.target.value)}>{!profiles.length&&<option value="">هنوز مدلی تنظیم نشده</option>}{profiles.map(p=><option value={p.id} key={p.id}>{p.name} · {p.model}</option>)}</select>{admin&&<button className="link" onClick={()=>{close();onSettings()}}>تنظیمات</button>}</div><div className="assistant-messages" role="log" aria-live="polite" aria-busy={busy||loading}>{loading?<p className="subtle">در حال دریافت گفتگو…</p>:!messages.length&&<div className="assistant-welcome"><Bot size={36}/><h3>چطور کمک کنم؟</h3><p>دربارهٔ بخش‌های سامانه سؤال بپرس یا بررسی اطلاعات قابل‌دسترست را بخواه.</p><button className="btn" onClick={()=>setInput('برای ثبت تولید و انتقال محصول به انبار چه کار کنم؟')}>راهنمای ثبت تولید</button><button className="btn" onClick={()=>setInput('موجودی انبارها را بررسی کن و خلاصه بده.')}>بررسی موجودی انبار</button></div>}{!loading&&messages.map((m,i)=><div className={'assistant-message '+m.role} key={i}><span>{m.role==='user'?'شما':'دستیار'}</span><p>{m.text}</p></div>)}{busy&&<p className="assistant-thinking"><LoaderCircle size={16} className="animate-spin"/>در حال بررسی و آماده‌کردن پاسخ…</p>}<div ref={bottom}/></div>{error&&<p className="assistant-error" role="alert">{error}</p>}{!loading&&!profiles.length&&<p className="assistant-error">{admin?'ابتدا در تنظیمات LLM مدل، Base URL و کلید API را وارد کن.':'مدیر باید ابتدا مدل دستیار را تنظیم کند.'}</p>}<form className="assistant-compose" onSubmit={e=>{e.preventDefault();void send()}}><textarea ref={editor} aria-label="پیام به دستیار" placeholder="پیامت را بنویس…" rows={2} maxLength={4000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/><button className="btn primary" aria-label="ارسال پیام" disabled={busy||loading||!profile||!input.trim()}><Send size={19}/></button></form><p className="assistant-disclosure">چت و داده‌های لازم برای پاسخ به ارائه‌دهندهٔ مدل ارسال می‌شوند. دستیار فعلاً اطلاعات را بررسی می‌کند و چیزی را تغییر نمی‌دهد.</p></section>}<button ref={launcher} type="button" className="assistant-launcher" aria-label={open?'بستن دستیار':'باز کردن دستیار'} aria-expanded={open} onClick={()=>open?close():setOpen(true)}>{open?<X size={25}/>:<MessageCircle size={26}/>}<span>دستیار</span></button></div>;
}
