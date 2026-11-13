'use client';
import {findPairedOpenAction,openActionIdentity,type PairedOpenAction} from '@/lib/paired-open-actions';
import {useEffect,useRef,useState} from 'react';
import {Smartphone,Link2,Unlink} from 'lucide-react';
import {CameraCodeScanner} from './camera-code-scanner';
import {pairInviteFromCode,pairInviteUrl,unsharedSections,type SharedPair,type SharedWork,type SharedField} from '@/lib/device-pair-contract';
import {applySharedValue,controlKeys,shareableControl,sharedControls,sharedControlLabel,sharedControlValue} from '@/lib/shared-form-dom';
type Pending={value:SharedField['value'];version:number;label:string;epoch:number};
export function DevicePairWorkspace({accountKey,section,target,onNavigate,profileWorkspace=false}:{accountKey:string;section:string;target:string;profileWorkspace?:boolean;onNavigate:(s:string,t?:string)=>void|boolean}){
 const [view,setView]=useState<SharedPair|null>(null),[open,setOpen]=useState(false),[joinText,setJoinText]=useState(''),[qr,setQr]=useState(''),[inviteLink,setInviteLink]=useState(''),[error,setError]=useState(''),[pendingCount,setPendingCount]=useState(0),[conflicts,setConflicts]=useState<string[]>([]);
 const state=useRef<SharedPair|null>(null),pending=useRef(new Map<string,Pending>()),muted=useRef(false),busy=useRef(false),dead=useRef(false),clock=useRef(0),keys=useRef(new Map<string,any>()),lastWork=useRef(''),applied=useRef(new Map<string,number>()),originalFetch=useRef<typeof fetch|null>(null),apiRef=useRef<(mode:string,extra?:any)=>Promise<any>>(async()=>{}),navigate=useRef(onNavigate),current=useRef({section,target});navigate.current=onNavigate;current.current={section,target};
 const connecting=useRef(false),connectionGeneration=useRef(0);
 const sessionKey='nafasyar-device-pair:'+accountKey;const isUnshared=(s:string)=>unsharedSections.has(s)&&!(s==='role-testing'&&profileWorkspace);
 const conflictKeys=useRef<string[]>([]),suspended=useRef(false),localWork=useRef<SharedWork|null>(null),remoteMutationBlocked=useRef(false);conflictKeys.current=conflicts;
 const deliveredActions=useRef(new Set<string>()),uiOutbox=useRef<any[]>([]),sendingUi=useRef(false),applyingUi=useRef(false);
 const actionContext=(d:SharedPair)=>JSON.stringify(d.work)+'@'+(d.actions?.at(-1)?.id||'initial');
 function display(d:SharedPair|null){state.current=d;setView(d);}
 async function api(mode:string,extra:any={},binding?:{id?:string;deviceKey:string}){
  const stored=sessionStorage.getItem(sessionKey),handle=binding||JSON.parse(stored||'null'),deviceKey=handle?.deviceKey,generation=connectionGeneration.current;
  const current=state.current?.id===handle?.id?state.current:null;
  if(!deviceKey)throw Error('شناسهٔ این دستگاه در دسترس نیست.');
  const response=await (originalFetch.current||fetch)('/api/device-pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:2,id:handle?.id,deviceKey,revision:current?.revision,epoch:current?.epoch,mode,...extra})});const d:any=await response.json();
  if(!response.ok){if(!binding&&!connecting.current&&generation===connectionGeneration.current&&sessionStorage.getItem(sessionKey)===stored&&[401,403,404,410].includes(response.status)){sessionStorage.removeItem(sessionKey);display(null);}throw Object.assign(Error(d.error||'ارتباط برقرار نشد.'),{status:response.status})}return d;
 }
 apiRef.current=api;
 async function accept(d:SharedPair){
  if(dead.current)return;const handle=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(!handle?.id||handle.id!==d.id)return;const old=state.current;if(old?.id===d.id&&old.revision>d.revision)return;display(d);clock.current=Date.now();
  if(old&&(d.epoch!==old.epoch||(d.actions?.at(-1)?.id||'')!==(old.actions?.at(-1)?.id||''))){
   // Never discard an unsent edit just because a peer opened another record.
   if(pending.current.size){suspended.current=true;setError('کار در دستگاه دیگر عوض شد؛ تغییرات ارسال‌نشدهٔ این فرم را بررسی کنید.');setConflicts([...pending.current.keys()]);return;}
   applied.current.clear();if(d.epoch!==old.epoch&&old.work&&JSON.stringify(old.work)===JSON.stringify(d.work)){location.reload();return;}
  }
  if(suspended.current)return;const workKey=JSON.stringify(d.work)+'@'+d.epoch;
  if(d.connected&&d.work&&workKey!==lastWork.current){lastWork.current=workKey;localWork.current=d.work;muted.current=true;try{if(d.work.kind==='scan')window.dispatchEvent(new CustomEvent('nafasyar-workflow-scan',{detail:{code:d.work.code,remote:true}}));else navigate.current(d.work.section!,d.work.target)}finally{muted.current=false}}
  if(old?.commit?.state!==d.commit?.state&&d.commit?.state==='done')window.dispatchEvent(new Event('nafasyar-tasks-changed'));
  await replayActions(d);await replay(d);
 }
 async function replay(d=state.current){if(suspended.current||applyingUi.current||!d?.connected||!d.work||d.actions?.some(a=>!deliveredActions.current.has(a.id))||isUnshared(current.current.section))return;const epoch=d.epoch,map=await controlKeys(sharedControls(),actionContext(d));if(dead.current||state.current?.epoch!==epoch||state.current.revision>d.revision)return;keys.current=map;muted.current=true;try{for(const [key,c]of map){const f=d.fields[key];if(c.disabled||('readOnly' in c&&c.readOnly))continue;if(!f||pending.current.has(key)||(applied.current.get(key)||0)>=f.version)continue;remoteMutationBlocked.current=true;applySharedValue(c,f.value);applied.current.set(key,f.version)}}finally{muted.current=false}}
 async function replayActions(d=state.current){
  if(!d?.connected||suspended.current||applyingUi.current)return;applyingUi.current=true;
  try{const actions=d.actions||[];for(let i=0;i<actions.length;i++){const action=actions[i];if(deliveredActions.current.has(action.id))continue;
   const beforeContext=JSON.stringify(d.work)+'@'+(actions[i-1]?.id||'initial'),beforeMap=await controlKeys(sharedControls(),beforeContext);
   muted.current=true;remoteMutationBlocked.current=true;try{for(const [key,control]of beforeMap){const field=action.beforeFields?.[key];if(field)applySharedValue(control,field.value);}}finally{muted.current=false}
   await new Promise(resolve=>setTimeout(resolve,0));
   const button=findPairedOpenAction(action);if(!button){setError('در انتظار بازشدن همان صفحه و فرم روی این دستگاه؛ اگر نسخهٔ صفحه قدیمی است تازه‌سازی کنید.');break;}
   muted.current=true;remoteMutationBlocked.current=true;try{if(button.tagName==='FORM')(button as HTMLFormElement).requestSubmit();else(button as HTMLButtonElement).click();deliveredActions.current.add(action.id);applied.current.clear();}finally{muted.current=false}
   await new Promise(resolve=>setTimeout(resolve,0));
   if(state.current?.epoch!==d.epoch)break;
  }}finally{applyingUi.current=false}
 }
 async function snapshotCurrentForm(){
  const d=state.current;if(!d?.work)return;const context=actionContext(d),map=await controlKeys(sharedControls(),context);
  if(!state.current||actionContext(state.current)!==context)return;
  for(const [key,c]of map){if(c.disabled||('readOnly' in c&&c.readOnly))continue;pending.current.set(key,{value:sharedControlValue(c),version:d.fields[key]?.version||0,label:sharedControlLabel(c),epoch:d.epoch});}setPendingCount(pending.current.size);
 }
 async function sendUi(){
  if(sendingUi.current||!uiOutbox.current.length||!state.current?.connected)return;sendingUi.current=true;
  try{while(uiOutbox.current.length){
   while(pending.current.size){const before=pending.current.size;await handlers.current.flush();if(pending.current.size>=before)throw Error('ابتدا تغییرات فرم قبلی را همگام کنید.');}
   const action=uiOutbox.current[0];let next;
   try{next=await apiRef.current('ui',{actionId:action.id,key:action.key,item:action.item,label:action.label});}catch(e){if((e as any).status!==409)throw e;await accept(await apiRef.current('poll'));next=await apiRef.current('ui',{actionId:action.id,key:action.key,item:action.item,label:action.label});}
   deliveredActions.current.add(action.id);uiOutbox.current.shift();await accept(next);
  }
  await new Promise(resolve=>setTimeout(resolve,0));await snapshotCurrentForm();setError('');
  }catch(e){setError((e as Error).message)}finally{sendingUi.current=false}
 }
 async function flush(){
  const d=state.current;if(suspended.current||busy.current||!d?.connected||!pending.current.size||conflictKeys.current.length)return false;busy.current=true;
  const list=[...pending.current].slice(0,40);
  try{const next=await apiRef.current('fields',{changes:list.map(([key,v])=>({key,value:v.value,version:v.version}))});for(const [key,v]of list){const latest=pending.current.get(key);if(latest===v){pending.current.delete(key);applied.current.set(key,next.fields[key].version)}else if(latest)latest.version=next.fields[key].version;}setPendingCount(pending.current.size);await accept(next);setError('');return !pending.current.size;}
  catch(e){const problem=e as Error;setError(problem.message);try{const next=await apiRef.current('poll');await accept(next);const changed=list.filter(([k,v])=>(next.fields[k]?.version||0)!==v.version).map(([k])=>k);if(changed.length){conflictKeys.current=changed;setConflicts(changed);}}catch{}return false;}finally{busy.current=false}
 }
 async function publishWork(work:SharedWork){
  if(muted.current||!state.current?.connected)return;
  if(work.kind==='navigate'&&isUnshared(work.section!))return;
  if(pending.current.size){setError('ابتدا تغییرات فرم فعلی را همگام کنید؛ کار جدید هنوز مشترک نشده است.');return;}
  if(JSON.stringify(state.current.work)===JSON.stringify(work)&&!state.current.commit)return;
  try{const next=await apiRef.current('work',{work});lastWork.current=JSON.stringify(work)+'@'+next.epoch;localWork.current=work;applied.current.clear();await accept(next);setError('');}catch(e){setError((e as Error).message)}
 }
 function newDeviceKey(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('')}
 async function establish(invite?:{id:string;invite:string}){
  // Keep the capability private in this transaction until the server accepts it.
  // Heartbeats and duplicate scanner callbacks must not race an unfinished join.
  if(connecting.current)return;
  if(invite&&state.current?.id===invite.id&&state.current.paired){setOpen(false);return;}
  if(pending.current.size){setError('تغییرات ارسال‌نشده را بررسی کنید؛ اتصال تازه نساختیم.');return;}
  connecting.current=true;const generation=++connectionGeneration.current;
  const binding={deviceKey:newDeviceKey(),...(invite?{id:invite.id}:{})};
  try{
   if(state.current)await api('close');
   if(generation!==connectionGeneration.current||dead.current)return;
   sessionStorage.removeItem(sessionKey);display(null);deliveredActions.current.clear();uiOutbox.current=[];lastWork.current='';localWork.current=null;applied.current.clear();
   const next=await api(invite?'join':'create',invite||{},binding);
   if(generation!==connectionGeneration.current||dead.current){void api('close',{}, {...binding,id:next.id}).catch(()=>{});return;}
   sessionStorage.setItem(sessionKey,JSON.stringify({...binding,id:next.id}));await accept(next);setError('');
   if(invite){setQr('');setOpen(false);return;}
   const code=pairInviteUrl(location.origin,next.id,next.invite);setInviteLink(code);const {qrcode,drawingSVG}=await import('@bwip-js/generic');
   if(generation!==connectionGeneration.current||dead.current)return;
   setQr('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qrcode({bcid:'qrcode',text:code,scale:3,padding:4,backgroundcolor:'FFFFFF'},drawingSVG()) as string));setOpen(true);
  }catch(e){if(generation===connectionGeneration.current&&!dead.current)setError((e as Error).message)}finally{if(generation===connectionGeneration.current)connecting.current=false;}
 }
 async function create(){await establish()}
 async function join(code:string){if(connecting.current)return;const invite=pairInviteFromCode(code,location.origin);if(!invite){setError('QR اتصال همین سامانه را اسکن کنید.');return;}await establish(invite)}
 async function disconnect(){if(pending.current.size){setError('تغییرات ارسال‌نشده دارید؛ ابتدا آن‌ها را همگام یا کپی کنید.');return}try{await api('close');pending.current.clear();setPendingCount(0);setConflicts([]);sessionStorage.removeItem(sessionKey);display(null);setQr('');setError('');}catch(e){setError((e as Error).message)}}
 useEffect(()=>{
  dead.current=false;const native=window.fetch.bind(window);originalFetch.current=native;
  let pollRunning=false,stopped=false;const pulse=async()=>{if(stopped||connecting.current||pollRunning||busy.current||!sessionStorage.getItem(sessionKey))return;pollRunning=true;const generation=connectionGeneration.current;try{const next=await apiRef.current('poll');if(stopped||connecting.current||generation!==connectionGeneration.current)return;await accept(next);if(!pending.current.size)setError('');}catch(e){if(stopped||connecting.current||generation!==connectionGeneration.current)return;setError((e as Error).message);if(state.current)display({...state.current,connected:false})}finally{pollRunning=false}};
  const navigation=(event:Event)=>{const d=(event as CustomEvent).detail;if(d){localWork.current={kind:'navigate',section:d.section,target:d.target||''};void publishWork(localWork.current)}};
  const scan=(event:Event)=>{const code=(event as CustomEvent).detail?.code;if(code){localWork.current={kind:'scan',code};void publishWork(localWork.current)}};
  const joinEvent=(event:Event)=>void join((event as CustomEvent).detail.code);
  const input=async(event:Event)=>{const c=event.target as Element;if(applyingUi.current||uiOutbox.current.length||sendingUi.current||suspended.current||muted.current||!state.current?.work||JSON.stringify(localWork.current)!==JSON.stringify(state.current.work)||!shareableControl(c)||isUnshared(current.current.section))return;const d=state.current,epoch=d.epoch,map=await controlKeys(sharedControls(),actionContext(d));if(muted.current||state.current?.epoch!==epoch)return;const key=[...map].find(([,v])=>v===c)?.[0];if(!key)return;const previous=pending.current.get(key);pending.current.set(key,{value:sharedControlValue(c),version:previous?.version??d.fields[key]?.version??0,label:sharedControlLabel(c),epoch});setPendingCount(pending.current.size);};
  const gesture=(e:Event)=>{if(e.isTrusted)remoteMutationBlocked.current=false;};
  const openAction=(e:Event)=>{if(!e.isTrusted||muted.current||!state.current?.connected||!state.current.work)return;
   let element=(e.target as Element)?.closest?.(e.type==='submit'?'form[data-pair-open]':'button[data-pair-open]');
   if(e.type==='keydown'){const key=(e as KeyboardEvent).key;if(key==='Escape')element=Array.from(document.querySelectorAll('button[data-slot="dialog-close"][data-pair-open]')).at(-1)||null;else if(key==='Enter'&&(e.target as Element).getAttribute('role')==='combobox'){const id=(e.target as Element).getAttribute('aria-activedescendant');element=id?document.getElementById(id):null;}else return;}if(!element||element.closest('[data-no-pair]'))return;
   const identity=openActionIdentity(element),work=JSON.stringify(state.current.work);if(!findPairedOpenAction(identity))return;
   const action={id:crypto.randomUUID(),...identity};deliveredActions.current.add(action.id);
   uiOutbox.current.push(action);queueMicrotask(()=>{if(JSON.stringify(localWork.current)!==work){uiOutbox.current=uiOutbox.current.filter(a=>a.id!==action.id);return;}void sendUi();});
  };
  const unload=(e:BeforeUnloadEvent)=>{if(pending.current.size){e.preventDefault();e.returnValue='';}};
  // Remote replay is restricted to registered view/read-only controls. All
  // business requests retain their own server validation and confirmation.
  window.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href),method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();const d=state.current;
   if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(method)||url.pathname==='/api/device-pair')return native(input,init);
   if(url.pathname.startsWith('/api/auth/')){if(d)await apiRef.current('close');return native(input,init);}
   if(!d?.work||isUnshared(current.current.section))return native(input,init);
   if(muted.current||remoteMutationBlocked.current)throw Error('تغییر دریافتی از دستگاه دیگر اجازهٔ ثبت خودکار ندارد.');
   if(!d.connected||Date.now()-clock.current>12000)throw Error('ارتباط دو دستگاه قطع است؛ ابتدا اتصال را برقرار یا قطع کنید.');
   if(sendingUi.current||uiOutbox.current.length){const started=Date.now();if(!sendingUi.current)await sendUi();while(sendingUi.current&&Date.now()-started<5000)await new Promise(resolve=>setTimeout(resolve,25));if(sendingUi.current||uiOutbox.current.length)throw Error('بازشدن همین فرم روی دستگاه دیگر هنوز در حال همگام‌سازی است؛ کمی صبر کنید.');}
   if(state.current?.actions?.some(a=>!deliveredActions.current.has(a.id)))throw Error('ابتدا بازشدن همان فرم مشترک روی این دستگاه را منتظر بمانید.');
   if(suspended.current)throw Error('کار مشترک تغییر کرده است؛ ابتدا تعارض فرم را حل کنید.');
   if(busy.current||pending.current.size){await handlers.current.flush();if(busy.current||pending.current.size)throw Error('ابتدا تغییرات فرم را همگام کنید.');}
   if(/\/(?:files|photos|material-files|material-photos)$/.test(url.pathname))return native(input,init);
   const operationId=crypto.randomUUID();let reservation:SharedPair;
   try{reservation=await apiRef.current('begin',{operationId});await accept(reservation);}catch(e){throw Error((e as Error).message)}
   try{const response=await native(input,init);try{await accept(await apiRef.current('finish',{operationId,status:response.status}));}catch{setError('پاسخ ثبت دریافت شد؛ همگام‌سازی نتیجه کامل نشد. قبل از تکرار، سابقه را بررسی کنید.');}return response;}
   catch(e){try{await accept(await apiRef.current('finish',{operationId,uncertain:true}));}catch{}setError('نتیجهٔ ثبت نامشخص است؛ درخواست را تکرار نکنید و سابقهٔ همان عملیات را بررسی کنید.');throw e;}
  };
  window.addEventListener('nafasyar-pair-navigation',navigation);window.addEventListener('nafasyar-pair-scan',scan);window.addEventListener('nafasyar-pair-join',joinEvent);document.addEventListener('click',gesture,true);document.addEventListener('click',openAction,true);document.addEventListener('submit',openAction,true);document.addEventListener('keydown',openAction,true);document.addEventListener('keydown',gesture,true);document.addEventListener('input',input,true);document.addEventListener('change',input,true);window.addEventListener('beforeunload',unload);
  const interval=setInterval(()=>{void pulse();if(pending.current.size)void handlers.current.flush();else void handlers.current.replay();if(uiOutbox.current.length)void sendUi()},1500);
  const hash=pairInviteFromCode(location.href,location.origin);if(hash){history.replaceState(null,'',location.pathname+location.search);void join(location.origin+'/#device-pair='+hash.id+'.'+hash.invite)}else void pulse();
  return()=>{stopped=true;dead.current=true;connectionGeneration.current++;connecting.current=false;clearInterval(interval);window.fetch=native;window.removeEventListener('nafasyar-pair-navigation',navigation);window.removeEventListener('nafasyar-pair-scan',scan);window.removeEventListener('nafasyar-pair-join',joinEvent);document.removeEventListener('click',gesture,true);document.removeEventListener('click',openAction,true);document.removeEventListener('submit',openAction,true);document.removeEventListener('keydown',openAction,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('input',input,true);document.removeEventListener('change',input,true);window.removeEventListener('beforeunload',unload);const handle=sessionStorage.getItem(sessionKey);if(handle){const binding=JSON.parse(handle);void native('/api/device-pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:2,mode:'close',id:binding.id,deviceKey:binding.deviceKey})}).catch(()=>{});if(sessionStorage.getItem(sessionKey)===handle)sessionStorage.removeItem(sessionKey)}pending.current.clear();state.current=null;};
 },[accountKey]);
 // The interval always calls the current handlers, including conflict state.
 const handlers=useRef({flush,replay:async()=>{await replayActions();await replay();}});handlers.current={flush,replay:async()=>{await replayActions();await replay();}};
 async function resolveConflicts(local:boolean){if(local){if(suspended.current){setError('این مقدارها متعلق به فرم قبلی‌اند؛ آن‌ها را کپی کنید و سپس نسخهٔ مشترک را بگیرید.');return}for(const key of conflicts){const v=pending.current.get(key);if(v)v.version=state.current?.fields[key]?.version||0}}else{for(const key of conflicts){pending.current.delete(key);applied.current.delete(key)}suspended.current=false;}setPendingCount(pending.current.size);setConflicts([]);setError('');if(state.current)await accept(state.current);}
 useEffect(()=>{if(view?.connected&&!view.work&&view.side==='a')void publishWork({kind:'navigate',section:current.current.section,target:current.current.target});},[view?.connected]);
 async function nextStep(){if(!state.current?.work)return;if(pending.current.size){setError('تغییرات ارسال‌نشده را ابتدا بررسی و کپی کنید؛ فرم را بازخوانی نکردیم.');return}try{const next=await api('work',{work:state.current.work});lastWork.current='';pending.current.clear();setPendingCount(0);applied.current.clear();await accept(next);}catch(e){setError((e as Error).message)}}
 return <section data-no-pair className="notice" aria-label="اتصال گوشی و کامپیوتر" style={{margin:'8px 0'}}><div className="tools"><Smartphone size={20}/><strong>گوشی و کامپیوتر</strong><span role="status">{view?(view.connected?'متصل؛ کار مشترک فعال':view.paired?'ارتباط دستگاه دیگر برقرار نیست':'منتظر اتصال گوشی'):'دو دستگاه را برای اسکن و تکمیل فرم به هم وصل کنید.'}</span><button type="button" className="btn" onClick={()=>setOpen(v=>!v)}><Link2 size={18}/>{open?'بستن راهنما':'اتصال دو دستگاه'}</button>{view&&<button className="btn" onClick={()=>void disconnect()}><Unlink size={18}/>قطع اتصال</button>}</div>{pendingCount>0&&<p role="status">{pendingCount} تغییر هنوز همگام نشده است؛ این صفحه را نبندید. <button type="button" className="btn" onClick={()=>{pending.current.clear();setPendingCount(0);setConflicts([]);suspended.current=false;applied.current.clear();setError('');if(state.current)void accept(state.current);}}>کنارگذاشتن تغییرات ارسال‌نشده و دریافت نسخهٔ مشترک</button></p>}{error&&<p className="notice error" role="alert">{error}</p>}{view?.commit&&<div className="notice"><p>{view.commit.state==='sending'?'ثبت این مرحله در حال انجام است؛ دوباره ثبت نکنید.':view.commit.state==='uncertain'?'نتیجهٔ ثبت نامشخص است؛ ابتدا سابقه را بررسی کنید.':`پاسخ ثبت این مرحله دریافت شد (${view.commit.status})؛ قبل از ادامه اطلاعات را تازه کنید.`}</p>{view.commit.state==='done'&&<button className="btn" onClick={()=>void nextStep()}>بازکردن تازهٔ مرحلهٔ بعد</button>}</div>}{conflicts.length>0&&<div className="notice error"><p>تغییر هم‌زمان یا جابه‌جایی کار رخ داده است؛ مقدار مناسب را انتخاب کنید.</p>{conflicts.slice(0,5).map(k=><p key={k}>{pending.current.get(k)?.label}: این دستگاه «{String(pending.current.get(k)?.value??'')}» / مشترک «{String(view?.fields[k]?.value??'')}»</p>)}<button className="btn" onClick={()=>void resolveConflicts(false)}>دریافت مقدار مشترک</button><button className="btn" onClick={()=>void resolveConflicts(true)}>نگه‌داشتن مقدار این دستگاه</button></div>}{open&&<div><p>هر دو دستگاه باید با یک حساب و یک نقش وارد شده باشند. دوربین و فایل انتخابیِ هر دستگاه محلی است؛ رمزها و تأییدهای تحویل فیزیکی همگام نمی‌شوند.</p><button className="btn" onClick={()=>void create()}>نمایش QR اتصال روی کامپیوتر</button>{qr&&!view?.paired&&<div><label className="field">پیوند یک‌بارمصرف اتصال<input readOnly value={inviteLink} onFocus={e=>e.target.select()}/></label><img src={qr} alt="کد یک‌بارمصرف اتصال گوشی؛ اعتبار دو دقیقه" width={240} height={240}/><p>با گوشی این کد را اسکن کنید. کد پس از دو دقیقه منقضی می‌شود.</p></div>}<CameraCodeScanner onScan={code=>void join(code)}/><label className="field">پیوند اتصال<input value={joinText} onChange={e=>setJoinText(e.target.value)}/></label><button className="btn" onClick={()=>void join(joinText)}>اتصال با پیوند</button>{view?.connected&&!view.work&&<button className="btn primary" onClick={()=>void publishWork({kind:'navigate',section:current.current.section,target:current.current.target})}>اشتراک همین صفحه</button>}</div>}</section>;
}
