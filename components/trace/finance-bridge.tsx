"use client";
import {IconActions} from "./program-workspace";
import {formatDateTime} from '@/lib/persian-date';
import {useEffect,useRef,useState} from "react";
import {Download,Link2,Monitor,Unplug} from "lucide-react";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";

type WindowItem={id:string;title:string;exe:string};
type ReadError={stage:string;type:string;code:number|null;count:number};
type Discovery={backend:string;status:string;seen:number;accepted:number;skipped:number;unnamed:number;errors:ReadError[];limited:boolean};
type Snapshot={version:string;capturedAt:string;title:string;backend:string;controls:{name:string;automationId:string;type:string;className:string;text:string}[];image:string|null;truncated:boolean;skipped:number;scope:string;readOnly:boolean;errors?:ReadError[]};
const compatibleVersions=["0.2.0","0.2.1","0.2.2","0.2.3","0.2.4"];
export function FinanceBridge(){
 const [token,setToken]=useState(""),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[backend,setBackend]=useState("uia"),[windows,setWindows]=useState<WindowItem[]>([]),[selected,setSelected]=useState(""),[screenshot,setScreenshot]=useState(false),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const request=useRef<AbortController|null>(null),generation=useRef(0);
 const [bridgeVersion,setBridgeVersion]=useState(""),[listed,setListed]=useState(false),[discovery,setDiscovery]=useState<Discovery|null>(null);
 useEffect(()=>()=>{generation.current++;request.current?.abort()},[]);
 function reset(){generation.current++;request.current?.abort();request.current=null;setBusy(false);setConnected(false);setWindows([]);setSelected("");setSnapshot(null);setError("");setListed(false);setDiscovery(null);setBridgeVersion("");}
 async function call<T,>(path:string,body:Record<string,unknown>,accept:(value:T)=>void){
  if(busy)return;const serial=generation.current,controller=new AbortController();request.current=controller;setBusy(true);setError("");
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch("http://127.0.0.1:8765"+path,{method:"POST",headers:{"Content-Type":"application/json","X-Nafasyar-Token":token.trim()},body:JSON.stringify(body),signal:controller.signal,cache:"no-store",credentials:"omit"});const result=await response.json() as T & {error?:string};if(!response.ok)throw new Error(result.error||"رابط درخواست را نپذیرفت.");if(generation.current===serial)accept(result as T);}
  catch(e){if(generation.current===serial){setError(e instanceof TypeError||e instanceof DOMException?"ارتباط برقرار نشد یا زمان پاسخ تمام شد. رابط باید روی همین رایانه روشن باشد؛ کد اتصال و اجازه دسترسی محلی مرورگر را بررسی کنید.":e instanceof Error?e.message:"ارتباط برقرار نشد.");setConnected(false);setWindows([]);setSelected("");setSnapshot(null);}}
  finally{clearTimeout(timeout);if(generation.current===serial){setBusy(false);request.current=null;}}
 }
 function connect(){void call<{version:string;readOnly:boolean}>("/health",{},value=>{if(!compatibleVersions.includes(value.version)||value.readOnly!==true)throw new Error("نسخه رابط با سامانه هماهنگ نیست؛ بسته ۰٫۲٫۴ را نصب کنید.");setConnected(true);setBridgeVersion(value.version);setSnapshot(null);setWindows([]);setSelected("");setListed(false);setDiscovery(null);});}
 function list(){setSnapshot(null);setSelected("");setWindows([]);setListed(false);setDiscovery(null);void call<{windows:WindowItem[];diagnostics?:Discovery}>("/windows",{backend},value=>{setWindows(value.windows);setListed(true);setDiscovery(value.diagnostics||null)});}
 function inspect(){setSnapshot(null);void call<Snapshot>("/inspect",{backend,id:selected,screenshot},setSnapshot);}
 function exportTechnical(){if(!snapshot)return;const report={bridgeVersion:snapshot.version,capturedAt:snapshot.capturedAt,backend:snapshot.backend,scope:snapshot.scope,truncated:snapshot.truncated,skipped:snapshot.skipped,errors:snapshot.errors||[],controls:snapshot.controls.map(c=>({type:c.type,className:c.className}))};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="nafasyar-bridge-technical.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportDiscovery(){const report={bridgeVersion,backend,diagnostics:discovery,scope:"window-discovery-only; no titles, text, images or tokens"};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="nafasyar-window-diagnostics.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div style={{display:"grid",gap:20}}>
  <section className="panel"><div className="panelhead"><div><h2><Monitor size={21} style={{display:"inline",marginLeft:8}}/>اتصال حسابداری</h2><p className="subtle">رابط ویندوز ۰٫۲٫۴ · فقط مشاهده · دسترسی مدیر</p></div></div><div className="inside" style={{display:"grid",gap:16}}>
   <p>ابتدا رابط را روی رایانه ویندوزیِ دارای نرم‌افزار حسابداری نصب کنید. این صفحه را نیز در مرورگر همان رایانه باز کنید؛ اتصال از گوشی به رایانه انجام نمی‌شود.</p>
   <div className="tools"><a className="btn primary" href="/downloads/nafasyar-windows-bridge-0.2.4.zip" download><Download size={17}/>دانلود بسته نصب ویندوز</a><a className="btn" href="/downloads/nafasyar-bridge-guide.html" target="_blank" rel="noreferrer">راهنمای نصب</a></div>
   <ol style={{listStyle:"decimal",paddingInlineStart:24,lineHeight:2}}><li>فایل ZIP را از حالت فشرده خارج کنید و INSTALL.cmd را اجرا کنید. نصب به Python 3.11 یا 3.12 و اینترنت نیاز دارد.</li><li>از میان‌بر Nafasyar Bridge روی دسکتاپ، «شروع اتصال» و سپس «کپی کد» را بزنید.</li><li>کد را اینجا وارد کنید و پنجره نرم‌افزار حسابداری را انتخاب کنید.</li></ol>
   <p className="notice">این نسخه برای بررسی امکان خواندن صفحه حسابداری است. گزارش کامل، بررسی اسناد، نتیجه‌گیری درباره عملکرد کارکنان و اجرای روزانه هنوز پیاده‌سازی نشده‌اند.</p>
   <div className="formgrid"><label className="field"><span>کد اتصال همین نشست</span><input type="password" dir="ltr" autoComplete="off" spellCheck={false} value={token} disabled={busy} onChange={e=>{reset();setToken(e.target.value)}} placeholder="کد را از رابط ویندوز کپی کنید"/></label><label className="field"><span>روش خواندن پنجره</span><Select dir="rtl" disabled={busy} value={backend} onValueChange={v=>{reset();setBackend(v)}}><SelectTrigger aria-label="روش خواندن پنجره"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="uia">استاندارد (UIA)</SelectItem><SelectItem value="win32">برنامه‌های قدیمی (Win32)</SelectItem></SelectContent></Select></label></div>
   <IconActions scope="finance-bridge-actions-453ff56ee5"><button className="btn primary" disabled={busy||!token.trim()} onClick={connect}><Link2 size={16}/>{connected?"بررسی دوباره اتصال":"برقراری اتصال"}</button><button className="btn" disabled={!token&&!connected&&!busy} onClick={()=>{reset();setToken("")}}><Unplug size={16}/>قطع و پاک‌کردن</button><span role="status" className="subtle">{busy?"در حال ارتباط…":connected?`رابط پاسخ می‌دهد · نسخه ${bridgeVersion}`:"قطع"}</span></IconActions>
   {connected&&<p className="subtle">ارتباط با رابط برقرار است؛ خواندن حسابداری تنها پس از انتخاب پنجره و مشاهده نتیجه بررسی می‌شود.</p>}
   <p className="subtle">برای بررسی بدون نصب مجدد، بسته جدید را استخراج و CHECK.cmd را اجرا کنید. اگر نسخه ۰٫۲٫۴ نصب است، در برنامه ویندوز روی «عیب‌یابی پنجره‌ها» و سپس «کپی گزارش عیب‌یابی» بزنید. این آزمون به اتصال مرورگر نیاز ندارد.</p>
   {error&&<p className="notice error" role="alert">{error}</p>}
  </div></section>
  {connected&&<section className="panel"><div className="panelhead"><h2>انتخاب پنجره حسابداری</h2><button className="btn" disabled={busy} onClick={list}>دریافت پنجره‌های باز</button></div><div className="inside" style={{display:"grid",gap:16}}>
   {listed&&<div role="status" className={windows.length?"notice":"notice error"}><p>{windows.length?`${windows.length.toLocaleString("fa-IR")} پنجره قابل انتخاب پیدا شد؛ پنجره حسابداری را انتخاب کنید.`:"هیچ پنجره قابل انتخابی دریافت نشد؛ خواندن حسابداری هنوز تأیید نشده است."}</p>{discovery&&<p>پنجره‌های بررسی‌شده: {discovery.seen.toLocaleString("fa-IR")} · موارد ناموفق: {discovery.skipped.toLocaleString("fa-IR")}</p>}{discovery?.errors.map((e,i)=><p dir="ltr" key={i}>{e.stage}: {e.type}{e.code!==null?` (${e.code})`:""} × {e.count}</p>)}{!discovery&&<p>این نسخه رابط جزئیات خطا را گزارش نمی‌کند؛ بسته ۰٫۲٫۴ را دانلود و استخراج کنید، سپس CHECK.cmd را بدون نصب مجدد اجرا کنید.</p>}<button className="btn" onClick={exportDiscovery}>دانلود گزارش شناسایی بدون اطلاعات مالی</button></div>}
   <label className="field"><span>پنجره مورد نظر</span><Select dir="rtl" disabled={busy||!windows.length} value={selected||"__none"} onValueChange={v=>{setSelected(v==="__none"?"":v);setSnapshot(null)}}><SelectTrigger className="full" aria-label="پنجره حسابداری"><SelectValue placeholder="ابتدا پنجره‌ها را دریافت کنید"/></SelectTrigger><SelectContent><SelectItem value="__none">انتخاب کنید</SelectItem>{windows.map(w=><SelectItem key={w.id} value={w.id}>{w.title} · {w.exe}</SelectItem>)}</SelectContent></Select></label>
   <label style={{display:"flex",gap:10,alignItems:"center"}}><Checkbox checked={screenshot} disabled={busy} onCheckedChange={v=>setScreenshot(v===true)}/>تصویر پنجره انتخاب‌شده هم نمایش داده شود</label>
   <IconActions scope="finance-bridge-actions-89bbbd87ff"><button className="btn primary" disabled={busy||!selected} onClick={inspect}>خواندن همین پنجره</button></IconActions>
   <p className="subtle">متن و تصویر فقط در همین مرورگر نمایش داده می‌شوند و به سرور سامانه فرستاده نمی‌شوند. کد اتصال ذخیره نمی‌شود. خروج از این بخش، اطلاعات نمایش‌داده‌شده را پاک می‌کند.</p>
  </div></section>}
  {snapshot&&<section className="panel"><div className="panelhead"><div><h2>نتیجه خواندن پنجره</h2><p className="subtle">{snapshot.title} · {formatDateTime(snapshot.capturedAt)}</p></div><button className="btn" onClick={exportTechnical}><Download size={16}/>دانلود مشخصات فنی بدون متن و تصویر</button></div><div className="inside" style={{display:"grid",gap:16}}>
   <p className="notice">این فهرست متن‌های قابل خواندنِ صفحه است؛ کامل‌بودن گزارش یا داده‌های مالی را نشان نمی‌دهد. {snapshot.controls.length.toLocaleString("fa-IR")} جزء خوانده شد.{snapshot.truncated?" حد خواندن ۶۰۰ جزء رسیده؛ نتیجه ناقص است.":""}{snapshot.skipped?` ${snapshot.skipped.toLocaleString("fa-IR")} جزء قابل خواندن نبود.`:""}</p>
   {snapshot.controls.length===0&&<p className="notice error">هیچ جزء قابل خواندنی از پنجره دریافت نشد. از دکمه عیب‌یابی در برنامه ویندوز استفاده کنید.</p>}
   {screenshot&&!snapshot.image&&<p className="notice error">تصویر پنجره دریافت نشد.</p>}
   {snapshot.errors?.map((e,i)=><p className="subtle" dir="ltr" key={i}>{e.stage}: {e.type}{e.code!==null?` (${e.code})`:""} × {e.count}</p>)}
   {snapshot.image&&<img src={snapshot.image} alt="تصویر پنجره انتخاب‌شده حسابداری" style={{maxWidth:"100%",height:"auto",borderRadius:12}}/>}
   <div style={{overflow:"auto",maxHeight:450}}><table style={{width:"100%",minWidth:500,textAlign:"right"}}><thead><tr><th className="tablehead">نوع</th><th className="tablehead">عنوان</th><th className="tablehead">متن قابل خواندن</th></tr></thead><tbody>{snapshot.controls.map((c,i)=><tr key={i}><td className="tablecell" dir="ltr">{c.type}</td><td className="tablecell">{c.name||"—"}</td><td className="tablecell" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxWidth:600}}>{c.text||"—"}</td></tr>)}</tbody></table></div>
  </div></section>}
 </div>;
}
