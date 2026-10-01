'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
// Native recognition is feature-detected; no audio blob or provider key is stored by this app.
export function VoiceInput({value,onText,disabled,scope}:{value:string;onText:(s:string)=>void;disabled:boolean;scope:string}){
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[notice,setNotice]=useState('');
 const recognition=useRef<any>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),text=useRef(onText);text.current=onText;
 function abort(){generation.current++;const r=recognition.current;recognition.current=null;if(timer.current)clearTimeout(timer.current);r?.abort();setListening(false);}
 useEffect(()=>{setSupported(!!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition));const hidden=()=>{if(document.hidden)abort()};document.addEventListener('visibilitychange',hidden);return()=>{abort();document.removeEventListener('visibilitychange',hidden)}},[]);
 useEffect(()=>{if(disabled)abort()},[disabled]);useEffect(()=>()=>abort(),[scope]);
 function start(){if(disabled)return;if(recognition.current){recognition.current.stop();return;}const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Constructor)return;
 const r=new Constructor(),g=++generation.current,base=value.trim();recognition.current=r;r.lang='fa-IR';r.continuous=false;r.interimResults=true;r.maxAlternatives=1;setNotice('در حال شنیدن… پس از پایان، متن را بررسی و ارسال کنید.');setListening(true);
 r.onresult=(event:any)=>{if(g!==generation.current)return;let heard='';for(let i=0;i<event.results.length;i++)heard+=event.results[i][0].transcript+' ';text.current((base+(base?' ':'')+heard.trim()).slice(0,4000));};
 r.onerror=(event:any)=>{if(g!==generation.current)return;setNotice(({ 'not-allowed':'مجوز میکروفن داده نشده؛ از تنظیمات مرورگر اجازه دهید.', 'audio-capture':'میکروفن در دسترس نیست.',network:'سرویس تشخیص صدا در دسترس نیست؛ دوباره تلاش کنید یا تایپ کنید.','no-speech':'صدایی تشخیص داده نشد؛ دوباره میکروفن را بزنید.','language-not-supported':'تشخیص فارسی در این مرورگر پشتیبانی نمی‌شود؛ تایپ کنید.'} as Record<string,string>)[event.error]||'دریافت صدا متوقف شد؛ متن را بررسی کنید.');};
 r.onend=()=>{if(g!==generation.current)return;recognition.current=null;if(timer.current)clearTimeout(timer.current);setListening(false);setNotice(n=>n.startsWith('در حال')?'متن شنیده‌شده آماده ویرایش و ارسال است.':n)};
 try{r.start();timer.current=setTimeout(()=>r.stop(),60000)}catch{abort();setNotice('میکروفن شروع نشد؛ دوباره تلاش کنید یا متن را تایپ کنید.')}
 }
 return <div className="assistant-voice"><button type="button" className={'btn '+(listening?'voice-active':'')} disabled={!supported||disabled} aria-pressed={listening} onClick={start}>{listening?<Square size={18}/>:<Mic size={18}/>} {listening?'پایان صحبت':'فرمان صوتی'}</button><span role="status">{!supported?'ورودی صوتی در این مرورگر فعال نیست؛ می‌توانید تایپ کنید.':notice||'فارسی صحبت کنید؛ متن قبل از ارسال قابل اصلاح است.'}</span></div>;
}
