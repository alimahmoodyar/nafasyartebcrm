'use client';
import {useEffect,useRef,useState,type ButtonHTMLAttributes} from 'react';
import {RefreshCw} from 'lucide-react';

type Props=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'onClick'|'children'> & {onRefresh:()=>unknown;retry?:boolean;quiet?:boolean;pauseAuto?:boolean;label?:string;catalogUpdates?:boolean};

// Entry/save loading stays with each page. This only repeats its read operation
// when returning to an idle, visible page, never while an entry form is open.
export function RefreshButton({onRefresh,disabled,className='',retry=false,quiet=false,pauseAuto=false,label='',catalogUpdates=false,...props}:Props){
 const anchor=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null),latest=useRef(onRefresh),blocked=useRef(disabled),autoBlocked=useRef(pauseAuto),running=useRef(false),last=useRef(0),alive=useRef(true);
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
 latest.current=onRefresh;blocked.current=disabled;autoBlocked.current=pauseAuto;
 async function refresh(){
  if(blocked.current||running.current)return;
  running.current=true;last.current=Date.now();setBusy(true);setFailed(false);
  try{await latest.current();}catch{if(alive.current)setFailed(true);}finally{running.current=false;if(alive.current)setBusy(false);}
 }
 const run=useRef(refresh);run.current=refresh;
 useEffect(()=>{
  alive.current=true;let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{
   clearTimeout(timer);
   timer=setTimeout(()=>{
    const el=button.current||anchor.current;
    if(autoBlocked.current||document.visibilityState!=='visible'||!el||el.closest('[hidden]')||!el.getClientRects().length||Date.now()-last.current<1500)return;
    // Do not reload behind an editor, confirmation dialog or any visible form.
    if([...document.querySelectorAll('form,[role="dialog"],[role="alertdialog"],dialog[open]')].some(node=>node.getClientRects().length>0))return;
    void run.current();
   },200);
  };
  const changed=(e:StorageEvent)=>{if(e.key==='nafasyar-catalog-change')schedule()};
  window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',schedule);if(catalogUpdates){window.addEventListener('nafasyar-materials-changed',schedule);window.addEventListener('storage',changed);}
  return()=>{alive.current=false;clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',schedule);if(catalogUpdates){window.removeEventListener('nafasyar-materials-changed',schedule);window.removeEventListener('storage',changed);}};
 },[catalogUpdates]);
 const control=<button {...props} ref={button} type="button" className={'btn refresh-button '+className} disabled={disabled||busy} aria-label={failed||retry?'تلاش دوباره':'تازه‌سازی اطلاعات'} title={failed||retry?'تلاش دوباره':'تازه‌سازی اطلاعات'} aria-busy={busy} onClick={()=>void refresh()}><RefreshCw size={17} aria-hidden="true"/>{failed||retry?<span>تلاش دوباره</span>:label?<span>{label}</span>:null}</button>;
 return quiet?<span ref={anchor} className="refresh-retry-anchor">{failed||retry?control:null}</span>:control;
}
