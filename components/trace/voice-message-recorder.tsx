'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Trash2} from 'lucide-react';
type Draft={file:File;durationMs:number;url:string};
export function VoiceMessageRecorder({disabled,onSend,onActiveChange}:{disabled:boolean;onSend:(file:File,durationMs:number)=>Promise<void>;onActiveChange:(active:boolean)=>void}){
 const [state,setState]=useState<'idle'|'requesting'|'recording'|'preview'|'sending'>('idle'),[draft,setDraft]=useState<Draft|null>(null),[seconds,setSeconds]=useState(0),[error,setError]=useState('');
 const stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),generation=useRef(0),started=useRef(0),timer=useRef<ReturnType<typeof setInterval>|null>(null),preview=useRef(''),alive=useRef(true),requesting=useRef(false),sending=useRef(false);
 function stopTracks(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearInterval(timer.current);timer.current=null;}
 function discard(){generation.current++;requesting.current=false;const r=recorder.current;recorder.current=null;if(r&&r.state!=='inactive')r.stop();stopTracks();if(preview.current)URL.revokeObjectURL(preview.current);preview.current='';setDraft(null);setState('idle');setSeconds(0);onActiveChange(false);}
 useEffect(()=>{alive.current=true;const hide=()=>{if(document.hidden&&(recorder.current||requesting.current))discard();};document.addEventListener('visibilitychange',hide);return()=>{alive.current=false;generation.current++;const r=recorder.current;recorder.current=null;if(r&&r.state!=='inactive')r.stop();stopTracks();if(preview.current)URL.revokeObjectURL(preview.current);document.removeEventListener('visibilitychange',hide);onActiveChange(false);}},[onActiveChange]);
 async function start(){
  if(disabled||requesting.current||recorder.current)return;setError('');if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('ضبط صدا در این مرورگر در دسترس نیست؛ از مرورگر به‌روز و نشانی امن استفاده کنید.');return;}
  const token=++generation.current;requesting.current=true;setState('requesting');onActiveChange(true);
  try{const media=await navigator.mediaDevices.getUserMedia({audio:true,video:false});if(!alive.current||token!==generation.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m)),r=new MediaRecorder(media,mime?{mimeType:mime}:undefined),chunks:BlobPart[]=[];let size=0;recorder.current=r;started.current=Date.now();requesting.current=false;
   r.ondataavailable=e=>{if(token!==generation.current||!e.data.size)return;size+=e.data.size;if(size>20*1024*1024){discard();setError('حجم صدا بیش از ۲۰ مگابایت شد؛ پیام کوتاه‌تری ضبط کنید.');return;}chunks.push(e.data);};
   r.onerror=()=>{if(token===generation.current){discard();setError('ضبط صدا انجام نشد؛ دوباره تلاش کنید.');}};
   r.onstop=()=>{if(!alive.current||token!==generation.current)return;stopTracks();recorder.current=null;const type=(r.mimeType||mime||'').split(';')[0],ext=type==='audio/webm'?'webm':type==='audio/ogg'?'ogg':type==='audio/mp4'?'m4a':'';if(!ext||!size){discard();setError('فایل صوتی قابل ارسال ساخته نشد.');return;}const durationMs=Math.max(1,Math.min(300000,Date.now()-started.current)),file=new File(chunks,'voice-'+Date.now()+'.'+ext,{type});const url=URL.createObjectURL(file);preview.current=url;setDraft({file,durationMs,url});setState('preview');};
   r.start(1000);setState('recording');timer.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-started.current)/1000);setSeconds(elapsed);if(elapsed>=300&&r.state==='recording')r.stop();},250);
  }catch(e){if(token!==generation.current||!alive.current)return;discard();setError((e as Error).name==='NotAllowedError'?'اجازه میکروفون داده نشد؛ دسترسی میکروفون را برای این سایت فعال کنید.':'میکروفون باز نشد؛ دوباره تلاش کنید.');}
 }
 async function send(){if(!draft||disabled||sending.current)return;sending.current=true;setError('');setState('sending');try{await onSend(draft.file,draft.durationMs);if(alive.current)discard();}catch(e){if(alive.current){setError((e as Error).message);setState('preview');}}finally{sending.current=false;}}
 return <div data-no-pair className={'voice-message-recorder voice-'+state}>
 {state==='idle'&&<button type="button" className="btn chat-icon" title="ضبط پیام صوتی" aria-label="ضبط پیام صوتی" disabled={disabled} onClick={()=>void start()}><Mic size={22}/></button>}
 {state==='requesting'&&<><span role="status">در انتظار اجازه میکروفون…</span><button type="button" className="btn" onClick={discard}>لغو ضبط</button></>}
 {state==='recording'&&<><span className="voice-recording-dot" aria-hidden="true"/><time>{Math.floor(seconds/60).toString().padStart(2,'0')}:{(seconds%60).toString().padStart(2,'0')}</time><button type="button" className="btn" onClick={()=>{if(recorder.current?.state==='recording')recorder.current.stop();}}><Square size={18}/>پایان ضبط</button><button type="button" className="btn" onClick={discard}>لغو ضبط</button><small>حداکثر ۵ دقیقه؛ هنوز ارسال نشده</small></>}
 {draft&&<><audio controls preload="metadata" src={draft.url} aria-label="پیش‌شنوی پیام صوتی"/><button type="button" className="btn direct-chat-send" aria-label="ارسال پیام صوتی" disabled={disabled||state==='sending'} onClick={()=>void send()}><img src="/brand/nafasyar-icon.svg" alt=""/>{state==='sending'?'در حال ارسال…':'ارسال صوت'}</button><button type="button" className="btn" disabled={state==='sending'} onClick={discard}><Trash2 size={18}/>حذف ضبط</button><small>قبل از ارسال می‌توانید گوش بدهید.</small></>}
 {error&&<p className="voice-message-error" role="alert">{error}</p>}
 </div>;
}
