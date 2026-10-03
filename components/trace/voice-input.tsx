'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
import {createVoiceRecognition,type VoiceState} from '@/lib/voice-recognition';
// No audio blob or provider key is stored by this app; text is never auto-submitted.
export function VoiceInput({value,onText,disabled,scope}:{value:string;onText:(s:string)=>void;disabled:boolean;scope:string}){
 const [state,setState]=useState<VoiceState>('idle'),[notice,setNotice]=useState('فارسی صحبت کنید؛ متن قبل از ارسال قابل اصلاح است.');
 const controller=useRef<ReturnType<typeof createVoiceRecognition>|null>(null),text=useRef(onText);text.current=onText;
 function cancel(message=''){controller.current?.cancel(message)}
 useEffect(()=>{const hidden=()=>{if(document.hidden)cancel('با خروج از صفحه، دریافت صدا متوقف شد؛ دوباره میکروفن را بزنید.')};document.addEventListener('visibilitychange',hidden);return()=>{cancel();controller.current=null;document.removeEventListener('visibilitychange',hidden)}},[]);
 useEffect(()=>{if(disabled)cancel()},[disabled]);useEffect(()=>()=>cancel(),[scope]);
 function start(){if(disabled){setNotice('دستیار در حال پاسخ‌دادن است؛ پس از پایان پاسخ دوباره میکروفن را بزنید.');return;}if(!window.isSecureContext){setNotice('میکروفن به اتصال امن نیاز دارد؛ سایت را با آدرس https باز کنید.');return}const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Constructor){setNotice('این مرورگر ورودی صوتی را پشتیبانی نمی‌کند. سایت را مستقیم در مرورگر اصلی باز کنید یا از میکروفن صفحه‌کلید داخل کادر پیام استفاده کنید.');return}
 if(!controller.current)controller.current=createVoiceRecognition({create:()=>new Constructor(),onState:setState,onNotice:setNotice,onText:s=>text.current(s)});controller.current.start(value);
 }
 const active=state!=='idle';
 return <div className="assistant-voice"><button type="button" className={'btn '+(active?'voice-active':'')} aria-disabled={disabled} aria-pressed={active} onClick={start}>{active?<Square size={18}/>:<Mic size={18}/>} {state==='starting'?'لغو راه‌اندازی':state==='stopping'?'پایان دریافت':active?'پایان صحبت':'فرمان صوتی'}</button><span role="status" aria-live="polite">{notice}</span></div>;
}
