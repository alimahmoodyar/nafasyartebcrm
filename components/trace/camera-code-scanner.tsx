'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera} from 'lucide-react';
export function CameraCodeScanner({onScan,disabled=false,autoStart=false}:{onScan:(code:string)=>void;disabled?:boolean;autoStart?:boolean}){
 const video=useRef<HTMLVideoElement|null>(null),stream=useRef<MediaStream|null>(null),controls=useRef<{stop:()=>void}|null>(null),epoch=useRef(0),callback=useRef(onScan),last=useRef({code:'',at:0});callback.current=onScan;
 const [open,setOpen]=useState(autoStart),[starting,setStarting]=useState(autoStart),[error,setError]=useState('');
 function release(){epoch.current++;controls.current?.stop();controls.current=null;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null}
 function close(){release();setOpen(false);setStarting(false)}
 useEffect(()=>release,[]);
 useEffect(()=>{if(disabled)close()},[disabled]);
 useEffect(()=>{const hide=()=>{if(document.hidden)close()};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide)},[]);
 useEffect(()=>{if(!open)return;const token=epoch.current;void (async()=>{try{
  const {BrowserMultiFormatReader}=await import('@zxing/browser');if(token!==epoch.current)return;
  const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(token!==epoch.current){media.getTracks().forEach(track=>track.stop());return}stream.current=media;
  if(!video.current){close();return}const reader=new BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:250,delayBetweenScanSuccess:500});
  const scanner=await reader.decodeFromStream(media,video.current,(result)=>{if(token!==epoch.current||!result)return;const code=result.getText(),now=Date.now();if(code===last.current.code&&now-last.current.at<1800){last.current.at=now;return}last.current={code,at:now};callback.current(code)});
  if(token!==epoch.current){scanner.stop();return}controls.current=scanner;setStarting(false);
 }catch(e){if(token!==epoch.current)return;close();setError((e as Error).name==='NotAllowedError'?'اجازهٔ دوربین داده نشد؛ دسترسی دوربین این سایت را در مرورگر فعال کنید.':'اسکنر دوربین باز نشد؛ دوربین را بررسی کنید یا کد را دستی وارد کنید.')}})();return()=>release()},[open]);
 function start(){if(disabled)return;close();setError('');if(!navigator.mediaDevices?.getUserMedia){setError('این مرورگر به دوربین دسترسی ندارد؛ کد را دستی وارد کنید.');return}last.current={code:'',at:0};setStarting(true);setOpen(true)}
 return <div className="wide"><button type="button" className="btn" disabled={disabled||open} onClick={start}><Camera size={18}/>اسکن با دوربین</button>{error&&<p className="notice error" role="alert">{error}</p>}{open&&<section className="notice" aria-label="اسکن QR و بارکد"><p>{starting?'در حال بازکردن دوربین…':'کد را مقابل دوربین نگه دارید.'}</p><video ref={video} autoPlay playsInline muted style={{width:'100%',maxHeight:320,objectFit:'contain'}}/><button type="button" className="btn" onClick={close}>بستن اسکنر</button></section>}</div>;
}
