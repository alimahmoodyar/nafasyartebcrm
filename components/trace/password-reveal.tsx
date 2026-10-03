'use client';
import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {PasswordField} from './password-field';
import type {Member,Session} from '@/lib/permissions';
export function PasswordReveal({member,owner,onClose}:{member:Member;owner:Session;onClose:()=>void}){
 const [proof,setProof]=useState(''),[revealed,setRevealed]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 useEffect(()=>{const hide=()=>{pending.current?.abort();setProof('');setRevealed('');setBusy(false)};const visibility=()=>{if(document.hidden)hide()};const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('nafasyar-account'):null;if(channel)channel.onmessage=hide;window.addEventListener('blur',hide);document.addEventListener('visibilitychange',visibility);return()=>{channel?.close();window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{if(!revealed)return;const timer=setTimeout(()=>setRevealed(''),30000);return()=>clearTimeout(timer)},[revealed]);
 return <Dialog open onOpenChange={v=>{if(!v){pending.current?.abort();setProof('');setRevealed('');onClose()}}}><DialogContent dir="rtl"><DialogTitle>نمایش رمز «{member.name}»</DialogTitle><DialogDescription>برای مشاهده، رمز ورود مدیر محلی را وارد کنید. این مشاهده در سابقه امنیتی ثبت می‌شود. رمز پس از ۳۰ ثانیه یا خروج از این پنجره پنهان می‌شود.</DialogDescription>
 <p dir="ltr" className="subtle">{member.username}</p>
 {revealed?<><label className="field">رمز فعلی کاربر<input readOnly type="text" dir="ltr" autoComplete="off" value={revealed}/></label><button type="button" className="btn" onClick={()=>setRevealed('')}>پنهان کردن رمز</button></>:<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');const controller=new AbortController();pending.current=controller;try{const r=await fetch('/api/users/password',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','x-assistant-account':owner.userId},body:JSON.stringify({id:member.id,revision:member.revision,adminPassword:proof,confirmed:true})});const d=await r.json() as {password?:string;error?:string};if(controller.signal.aborted)return;if(!r.ok)throw new Error(d.error||'نمایش رمز انجام نشد.');setProof('');setRevealed(d.password||'');}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'نمایش رمز انجام نشد.');}finally{if(!controller.signal.aborted)setBusy(false)}}}><fieldset disabled={busy} className="password-form-fields"><PasswordField label="رمز ورود مدیر محلی" required autoComplete="off" maxLength={128} value={proof} onChange={e=>setProof(e.target.value)}/>{error&&<p className="notice error" role="alert">{error}</p>}<button className="btn primary">{busy?'در حال بررسی…':'تأیید هویت و نمایش رمز'}</button></fieldset></form>}
 </DialogContent></Dialog>;
}
