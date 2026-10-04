"use client";
import {createContext,useContext,useEffect,useState,useRef,type ReactNode} from 'react';
import {Smartphone,Download,CheckCircle2,WifiOff,Copy} from 'lucide-react';
interface InstallEvent extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type State={ready:boolean;installed:boolean;online:boolean;secure:boolean;workerError:boolean;install:()=>Promise<boolean>;installing:boolean;message:string};
const MobileContext=createContext<State|null>(null);
export function MobileAppProvider({children}:{children:ReactNode}){
 const pending=useRef<InstallEvent|null>(null);
 const [ready,setReady]=useState(false),[installed,setInstalled]=useState(false),[online,setOnline]=useState(true),[secure,setSecure]=useState(true),[workerError,setWorkerError]=useState(false),[message,setMessage]=useState(''),[installing,setInstalling]=useState(false);
 const prompting=useRef(false);
 useEffect(()=>{
  const mode=window.matchMedia('(display-mode: standalone)');
  const syncInstalled=()=>setInstalled(mode.matches||!!(navigator as Navigator & {standalone?:boolean}).standalone);
  const syncOnline=()=>setOnline(navigator.onLine);
  const before=(event:Event)=>{event.preventDefault();pending.current=event as InstallEvent;setReady(true)};
  const done=()=>{pending.current=null;setReady(false);setInstalled(true);setMessage('نصب انجام شد؛ از آیکون هم‌نفس روی گوشی وارد شوید.')};
  syncInstalled();syncOnline();setSecure(window.isSecureContext);
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);
  window.addEventListener('online',syncOnline);window.addEventListener('offline',syncOnline);mode.addEventListener('change',syncInstalled);
  let active=true;
  if(window.isSecureContext&&'serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{if(active)setWorkerError(true)});}
  return()=>{active=false;window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);window.removeEventListener('online',syncOnline);window.removeEventListener('offline',syncOnline);mode.removeEventListener('change',syncInstalled)};
 },[]);
 async function install(){
  if(prompting.current)return false;
  if(!window.isSecureContext){setMessage('نصب به آدرس HTTPS نیاز دارد. آدرس امن سامانه را باز کنید.');return false;}
  if(!navigator.onLine){setMessage('برای نصب ابتدا به اینترنت متصل شوید.');return false;}
  const event=pending.current;
  if(!event){setMessage('مرورگر هنوز پنجرهٔ نصب را آماده نکرده است. روش نصب از منوی مرورگر را در راهنمای زیر ببینید.');return false;}
  pending.current=null;setReady(false);prompting.current=true;setInstalling(true);
  try{await event.prompt();const result=await event.userChoice;setMessage(result.outcome==='accepted'?'درخواست نصب پذیرفته شد؛ منتظر تکمیل نصب توسط مرورگر بمانید.':'نصب لغو شد؛ می‌توانید از منوی مرورگر دوباره نصب کنید.');return result.outcome==='accepted';}
  catch{setMessage('پنجرهٔ نصب باز نشد؛ راهنمای نصب از منوی مرورگر را در پایین ببینید.');return false;}
  finally{prompting.current=false;setInstalling(false);}
 }
 return <MobileContext.Provider value={{ready,installed,online,secure,workerError,install,installing,message}}>{!online&&<div className="mobile-offline" role="alert"><WifiOff size={18}/>اینترنت قطع است؛ ثبت اطلاعات و دریافت سوابق تا اتصال دوباره انجام نمی‌شود.</div>}{children}</MobileContext.Provider>;
}
export function MobileInstall(){
 const state=useContext(MobileContext);const [url,setUrl]=useState(''),[copied,setCopied]=useState(false),[showGuide,setShowGuide]=useState(false),[ios,setIos]=useState(false);
 const guide=useRef<HTMLDivElement>(null);
 useEffect(()=>{setUrl(window.location.origin+'/');setIos(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));},[]);
 useEffect(()=>{if(showGuide){guide.current?.scrollIntoView?.({behavior:'smooth',block:'nearest'});guide.current?.focus({preventScroll:true});}},[showGuide]);
 if(!state)return null;
 return <section className="panel mobile-install" aria-labelledby="mobile-title">
  <div className="mobile-install-heading"><img src="/brand/hamnafas-192.png" width="76" height="76" alt="نشان هم‌نفس"/><div><h2 id="mobile-title">هم‌نفس روی گوشی</h2><p>با حساب خودتان وارد شوید و کارهای روزانه را انجام دهید.</p></div></div>
  <div className="mobile-install-status" role="status">{state.installed?<><CheckCircle2 size={22}/>هم‌نفس در حالت برنامه باز است یا نصب آن در این نشست تأیید شده است.</>:<><Smartphone size={22}/>نصب هم‌نفس از مرورگر</>}</div>
  <p>این نسخه مستقیماً از مرورگر نصب می‌شود؛ فایل APK برای دانلود ندارد.</p>
  {!state.secure&&<p role="alert">برای نصب، این سامانه باید با آدرس امن HTTPS باز شود.</p>}
  {state.workerError&&<p role="alert">آماده‌سازی نسخهٔ نصب‌شدنی کامل نشد. اتصال را بررسی و صفحه را دوباره باز کنید.</p>}
  {!state.installed&&<button className="btn primary" type="button" disabled={state.installing} aria-controls="mobile-install-guide" onClick={async()=>{if(!await state.install())setShowGuide(true)}}><Download size={20}/>{state.installing?'در انتظار پاسخ به پنجره نصب…':state.ready?'نصب هم‌نفس روی گوشی':'راهنمای نصب روی گوشی'}</button>}
  {state.message&&<p role="status">{state.message}</p>}
  {!state.installed&&<><button type="button" className="btn" aria-expanded={showGuide} aria-controls="mobile-install-guide" onClick={()=>setShowGuide(v=>!v)}>{showGuide?'بستن راهنما':'روش نصب از منوی مرورگر'}</button>{showGuide&&<div id="mobile-install-guide" ref={guide} tabIndex={-1} className="mobile-install-guide"><h3>{ios?'روش نصب در آیفون و آیپد':'روش نصب در اندروید'}</h3>{ios?<ol><li>آدرس همین سامانه را مستقیم در Safari باز کنید.</li><li>دکمهٔ اشتراک‌گذاری را بزنید و <b>Add to Home Screen / افزودن به صفحه اصلی</b> را انتخاب کنید.</li><li>افزودن را تأیید کنید و از آیکون هم‌نفس وارد شوید.</li></ol>:<ol><li>آدرس سامانه شرکت را مستقیم در <b>Chrome</b> گوشی اندروید باز کنید؛ اگر داخل پیام‌رسان هستید، آدرس پایین را کپی و در Chrome باز کنید.</li><li>منوی سه‌نقطهٔ مرورگر را بزنید و <b>افزودن به صفحه اصلی / Add to Home screen</b> یا <b>نصب برنامه / Install app</b> را انتخاب کنید.</li><li>نصب یا افزودن را تأیید کنید؛ سپس آیکون <b>هم‌نفس</b> را روی گوشی باز کنید.</li></ol>}<p>اگر برنامه قبلاً نصب شده، از آیکون آن وارد شوید. اگر روی رایانه هستید، آدرس پایین را روی گوشی باز کنید. اگر گزینه نصب وجود ندارد، نام مرورگر و تصویر منوی آن را برای پشتیبانی بفرستید.</p></div>}</>}

  <div className="mobile-install-guide"><h3>همان حساب، همان کارتابل</h3><p>کارتابل، پیام‌ها، مأموریت‌های تدارکات، ثبت بارنامه و امور خدمات در حد دسترسی حساب شما در دسترس‌اند. نصب برنامه دسترسی جدیدی ایجاد نمی‌کند.</p><p>برای مشاهده و ثبت اطلاعات اینترنت لازم است. فرم‌ها برای ارسال خودکار در حالت آفلاین ذخیره نمی‌شوند. پس از قطع ارتباط هنگام ارسال، ابتدا سوابق را بررسی کنید تا دوباره ثبت نکنید.</p><p>این نسخه برنامهٔ وب قابل نصب است و فایل APK ندارد. اعلان‌های فعلی داخل برنامه نمایش داده می‌شوند؛ اعلان گوشی هنگام بسته‌بودن برنامه در این نسخه فعال نیست.</p></div>
  <div className="mobile-install-link"><label htmlFor="mobile-address">آدرس همین سامانه برای بازکردن روی گوشی</label><input id="mobile-address" readOnly value={url} dir="ltr" onFocus={e=>e.target.select()}/><button className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setCopied(false);document.getElementById('mobile-address')?.focus()}}}><Copy size={18}/>{copied?'آدرس کپی شد':'کپی آدرس'}</button><p>از آدرس سرور شرکت استفاده کنید. نصب، محدودیت ورود یا دسترسی شبکهٔ سرور را تغییر نمی‌دهد.</p></div>
 </section>;
}
