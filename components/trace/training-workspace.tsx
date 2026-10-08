'use client';
import {IconActions} from "./program-workspace";
import {useEffect,useState} from 'react';
import {trainingRoles,trainingScenarios} from '@/lib/training-contract';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
export function trainingURL(input:string,role:string){const u=new URL(input,window.location.origin);if(u.origin===window.location.origin&&u.pathname.startsWith('/api/')&&!u.pathname.startsWith('/api/training')){u.pathname='/api/training/'+u.pathname.slice(5);u.searchParams.set('_role',role);}return u.toString();}
export function installTrainingTransport(role:string){
 const original=window.fetch.bind(window),open=window.open.bind(window);
 window.fetch=(input,init)=>{const raw=input instanceof Request?input.url:String(input),url=trainingURL(raw,role);return original(input instanceof Request?new Request(url,input):url,init);};
 window.open=((url?:string|URL,target?:string,features?:string)=>open(url?trainingURL(String(url),role):url,target,features)) as typeof window.open;
 const link=(event:Event)=>{const a=(event.target as Element)?.closest?.('a');if(a?.href)a.href=trainingURL(a.href,role);};
 document.addEventListener('click',link,true);document.addEventListener('pointerdown',link,true);
 return ()=>{window.fetch=original;window.open=open;document.removeEventListener('click',link,true);document.removeEventListener('pointerdown',link,true);};
}
export function TrainingWorkspace({role,onNavigate}:{role:string;onNavigate:(s:string)=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(role||trainingRoles.find(r=>r.name==='انبار')!.id);
 async function enter(){setBusy(true);setError('');try{const r=await fetch('/api/training',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})}),d=await r.json() as any;if(!r.ok)throw Error(d.error);window.location.assign('/?training='+selected);}catch(e){setError((e as Error).message);setBusy(false);}}
 return <section className="notice" style={{display:'block',border:role?'2px solid #b7791f':undefined}}>
 {role?<><strong>محیط آزمایش — داده‌ها و نقش فعلی فرضی‌اند</strong><p>ثبت‌ها در محیط آزمایشی مشترک ذخیره می‌شوند. تغییر نقش، اطلاعات را پاک نمی‌کند.</p><IconActions scope="training-workspace-actions-55125aa4f6"><Select value={role} onValueChange={v=>window.location.assign('/?training='+v)}><SelectTrigger aria-label="تعویض نقش آزمایشی" style={{minWidth:230}}><SelectValue/></SelectTrigger><SelectContent>{trainingRoles.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><button className="btn" onClick={()=>setOpen(true)}>راهنمای تست فرایندها</button><button className="btn" onClick={()=>onNavigate('tasks')}>کارتابل این نقش</button><button className="btn" onClick={()=>window.location.assign('/')}>خروج از آزمایش و ورود به شرکت</button></IconActions></>:<><span>اطلاعات شرکت — ثبت‌ها ذخیره می‌شوند.</span><button className="btn" style={{marginInlineStart:12}} onClick={()=>setOpen(true)}>اطلاعات نمونه و آزمایش نقش‌ها</button></>}
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="modal sm:max-w-3xl"><DialogTitle>آزمایش کامل با داده‌های فرضی</DialogTitle><DialogDescription>۸ کالا، ۳ محصول با BOM و فرم کیفیت، ۱۲ بچ با موجودی، دستگاه‌های نمونه، تأمین‌کنندگان داخلی و خارجی و نمایندگان فروش و خدمات. معیارهای کیفیت و قیمت‌ها فقط آموزشی‌اند.</DialogDescription>
 {!role&&<><p>بار اول داده‌ها ساخته می‌شوند؛ دفعات بعد همان محیط و ادامه کار قبلی باز می‌شود. هر کارمند با حساب خودش وارد می‌شود و فقط در این محیط نقش عوض می‌کند.</p><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="نقش شروع تست"><SelectValue/></SelectTrigger><SelectContent>{trainingRoles.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><button disabled={busy} className="btn primary" onClick={enter}>{busy?'در حال آماده‌سازی…':'آماده‌سازی و ورود به آزمایش'}</button></>}
 {error&&<p className="notice error" role="alert">{error}</p>}
 {trainingScenarios.map(s=><details key={s.title}><summary style={{padding:'12px 0',fontWeight:600}}>{s.title}</summary><ol style={{paddingInlineStart:24}}>{s.steps.map(t=><li key={t} style={{marginBottom:10}}>{t}</li>)}</ol></details>)}
 <p className="subtle">پروفایل‌های آزمایشی رمز مشترک یا ورود مستقل ندارند. ارسال خارجی و تنظیمات اتصال، مدیریت حساب واقعی و پاک‌سازی شرکت از این محیط قابل اجرا نیست.</p>
 </DialogContent></Dialog>
 </section>;
}
