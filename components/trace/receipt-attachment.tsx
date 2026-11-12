'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera} from 'lucide-react';
import {ReceiptPhotoEditor} from './receipt-photo-editor';

export function ReceiptAttachment({file,onChange,disabled=false,allowPdf=false,onEditingChange}:{file:File|null;onChange:(file:File|null)=>void;disabled?:boolean;allowPdf?:boolean;onEditingChange?:(editing:boolean)=>void}){
 const video=useRef<HTMLVideoElement|null>(null),stream=useRef<MediaStream|null>(null),request=useRef(0);
 const [photo,setPhoto]=useState<File|null>(null);
 function candidate(next:File|null){setPhoto(next);onEditingChange?.(!!next)}
 useEffect(()=>()=>onEditingChange?.(false),[onEditingChange]);
 const [open,setOpen]=useState(false),[waiting,setWaiting]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState('');
 function stop(){request.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;setOpen(false);setWaiting(false);setReady(false)}
 useEffect(()=>()=>{request.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null},[]);
 useEffect(()=>{if(!file||!file.type.startsWith('image/')){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 useEffect(()=>{if(disabled)stop()},[disabled]);
 useEffect(()=>{const hidden=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden)},[]);
 useEffect(()=>{if(open&&stream.current&&video.current){video.current.srcObject=stream.current;void video.current.play().catch(()=>{stop();setError('پیش‌نمایش دوربین باز نشد؛ دوباره تلاش کنید.')})}},[open,waiting]);
 async function start(){
  if(disabled)return;candidate(null);stop();setError('');
  if(!navigator.mediaDevices?.getUserMedia){setError('دوربین در این مرورگر در دسترس نیست؛ از مرورگر به‌روز و نشانی امن سایت استفاده کنید. انتخاب فایل هم در دسترس است.');return}
  const id=++request.current;setOpen(true);setWaiting(true);
  try{const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(request.current!==id){media.getTracks().forEach(track=>track.stop());return}stream.current=media;setWaiting(false)}catch(e){if(request.current!==id)return;stop();const name=(e as Error).name;setError(name==='NotAllowedError'?'اجازهٔ دوربین داده نشد؛ دسترسی دوربین را در تنظیمات مرورگر برای این سایت فعال کنید.':name==='NotFoundError'?'دوربینی روی این دستگاه پیدا نشد.':'دوربین باز نشد؛ برنامه‌های دیگری را که از دوربین استفاده می‌کنند ببندید و دوباره تلاش کنید.')}
 }
 function take(){
  if(disabled||!ready||!video.current||!stream.current)return;
  const frame=video.current;if(!frame.videoWidth||!frame.videoHeight)return;const id=request.current,canvas=document.createElement('canvas');canvas.width=frame.videoWidth;canvas.height=frame.videoHeight;const context=canvas.getContext('2d');if(!context){setError('ثبت عکس در این مرورگر ممکن نشد.');return}context.drawImage(frame,0,0);setReady(false);
  canvas.toBlob(blob=>{if(request.current!==id)return;if(!blob){setReady(true);setError('عکس ثبت نشد؛ دوباره تلاش کنید.');return}stop();candidate(new File([blob],'receipt-'+Date.now()+'.jpg',{type:'image/jpeg'}))},'image/jpeg',0.9);
 }
 return <div className="wide"><p>عکس رسید (اختیاری)</p><div className="tools"><label className="btn">{allowPdf?'انتخاب عکس یا فایل رسید':'انتخاب عکس رسید'}<input className="sr-only" type="file" accept={allowPdf?'image/*,application/pdf,.pdf':'image/*'} disabled={disabled} onChange={e=>{const selected=e.target.files?.[0];if(selected){stop();candidate(null);setError('');onChange(selected)}e.target.value=''}}/></label><button type="button" className="btn" disabled={disabled||waiting} onClick={()=>void start()}><Camera size={18} aria-hidden="true"/>عکس گرفتن از رسید</button></div>
 {error&&<p className="notice error" role="alert">{error}</p>}
 {open&&<div role="region" aria-label="دوربین رسید" className="notice"><p>{waiting?'در انتظار اجازهٔ دوربین…':'رسید را داخل تصویر قرار دهید و «گرفتن عکس» را بزنید.'}</p><video ref={video} autoPlay muted playsInline onCanPlay={()=>setReady(true)} style={{width:'100%',maxHeight:360,objectFit:'contain',display:waiting?'none':'block'}}/><div className="tools"><button type="button" className="btn primary" disabled={disabled||!ready} onClick={take}>گرفتن عکس</button><button type="button" className="btn" onClick={stop}>بستن دوربین</button></div></div>}
 {photo&&<ReceiptPhotoEditor key={photo.name+':'+photo.lastModified} source={photo} disabled={disabled} onConfirm={confirmed=>{onChange(confirmed);candidate(null)}} onRetake={()=>void start()} onCancel={()=>candidate(null)}/>}
 {file&&!photo&&<div><p>رسید انتخاب‌شده: {file.name}</p>{preview&&<img src={preview} alt="پیش‌نمایش عکس رسید" style={{maxWidth:'100%',maxHeight:280,objectFit:'contain'}}/>}<p className="subtle">پیوست هنگام ثبت پرداخت ارسال می‌شود.</p></div>}
 </div>;
}
