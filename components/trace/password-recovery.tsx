'use client';
import {useEffect,useState,type FormEvent} from 'react';

const endpoint='/api/auth/recovery';
const panel={display:'grid',gap:12};
const actions={display:'flex',gap:8,flexWrap:'wrap'} as const;
type Result={saved?:boolean;token?:string;backupCode?:string;mobileLast4?:string|null;requiresBackup?:boolean;error?:string};
async function request(input?:Record<string,string>,accountId?:string):Promise<Result>{
 const response=await fetch(endpoint,{
  cache:'no-store',method:input?'POST':'GET',
  headers:{...(input?{'Content-Type':'application/json'}:{}),...(accountId?{'x-profile-account':accountId}:{})},
  body:input?JSON.stringify(input):undefined,
 });
 const result=await response.json().catch(()=>({})) as Result;
 if(!response.ok)throw new Error(result.error||'بازیابی حساب در دسترس نیست. دوباره تلاش کنید.');
 return result;
}
const errorText=(error:unknown)=>error instanceof Error?error.message:'درخواست انجام نشد. دوباره تلاش کنید.';

function BackupCode({code}:{code:string}){
 const [copied,setCopied]=useState(false);
 return <div className="notice" style={panel}>
  <strong>کد پشتیبان مدیر اصلی</strong>
  <span>این کد فقط همین‌جا نمایش داده می‌شود. آن را در جای امن نگه دارید تا همراه کد پیامکی بتوانید رمز را بازیابی کنید.</span>
  <code dir="ltr" style={{overflowWrap:'anywhere'}}>{code}</code>
  <div><button type="button" className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setCopied(false);}}}>{copied?'کپی شد':'کپی کد پشتیبان'}</button></div>
 </div>;
}

export function PasswordRecoveryForm({initialUsername,onBack}:{initialUsername:string;onBack:()=>void}){
 const [username,setUsername]=useState(initialUsername),[mobile,setMobile]=useState(''),[token,setToken]=useState('');
 const [code,setCode]=useState(''),[backup,setBackup]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState('');
 const [done,setDone]=useState(false),[nextBackup,setNextBackup]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy)return;
  if(token&&password!==repeat){setError('تکرار رمز با رمز تازه یکسان نیست.');return;}
  setBusy(true);setError('');
  try{
   if(!token){
    const result=await request({action:'reset_start',username,mobile});
    if(!result.token)throw new Error('درخواست بازیابی آماده نشد. دوباره تلاش کنید.');
    setToken(result.token);
   }else{
    const result=await request({action:'reset_confirm',token,code,backupCode:backup,newPassword:password});
    if(!result.saved)throw new Error('ذخیرهٔ رمز تازه تأیید نشد.');
    setDone(true);setNextBackup(result.backupCode||'');
    setCode('');setBackup('');setPassword('');setRepeat('');setToken('');
   }
  }catch(error){setError(errorText(error));}finally{setBusy(false);}
 }
 return <form style={{...panel,width:'100%',maxWidth:420,margin:'20px auto',textAlign:'right'}} onSubmit={submit}>
  <h2>بازیابی رمز عبور</h2>
  {done?<><p role="status">رمز تازه ذخیره شد. با همین رمز وارد شوید.</p>{nextBackup&&<BackupCode code={nextBackup}/>}</>:token?<>
   <p role="status">اگر نام کاربری و شمارهٔ تأییدشده مطابق باشند، کد بازیابی پیامک می‌شود. کد ۵ دقیقه اعتبار دارد.</p>
   <label className="field">کد ۶رقمی پیامک<input dir="ltr" autoComplete="one-time-code" inputMode="numeric" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label>
   <label className="field">رمز تازه<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label className="field">تکرار رمز تازه<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
   <label className="field">کد پشتیبان (فقط برای مدیر اصلی)<input dir="ltr" type="password" autoComplete="off" maxLength={48} value={backup} onChange={e=>setBackup(e.target.value)}/></label>
  </>:<>
   <label className="field">نام کاربری<input autoComplete="username" dir="auto" maxLength={100} required value={username} onChange={e=>setUsername(e.target.value)}/></label>
   <label className="field">شمارهٔ همراه تأییدشده<input type="tel" dir="ltr" maxLength={20} required value={mobile} onChange={e=>setMobile(e.target.value)}/></label>
   <small>اگر قبلاً شمارهٔ بازیابی را تأیید نکرده‌اید، برای تعیین رمز با مدیر سامانه هماهنگ کنید.</small>
  </>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  <div style={actions}>
   {!done&&<button className="btn primary" disabled={busy}>{busy?'در حال انجام…':token?'ذخیرهٔ رمز تازه':'ارسال کد بازیابی'}</button>}
   {token&&<button type="button" className="btn" disabled={busy} onClick={()=>{setToken('');setCode('');setBackup('');setPassword('');setRepeat('');setError('');}}>تغییر شماره یا درخواست دوباره</button>}
   <button type="button" className="btn" disabled={busy} onClick={onBack}>بازگشت به ورود</button>
  </div>
 </form>;
}

export function RecoverySettings({accountId}:{accountId:string}){
 const [status,setStatus]=useState<Result|null>(null),[opened,setOpened]=useState(false);
 const [mobile,setMobile]=useState(''),[current,setCurrent]=useState(''),[backup,setBackup]=useState('');
 const [token,setToken]=useState(''),[code,setCode]=useState(''),[nextBackup,setNextBackup]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  request(undefined,accountId).then(result=>{if(active)setStatus(result);}).catch(error=>{if(active)setError(errorText(error));});
  return ()=>{active=false;};
 },[accountId]);
 function clearForm(){setMobile('');setCurrent('');setBackup('');setToken('');setCode('');}
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');
  try{
   if(!token){
    const result=await request({action:'enroll_start',mobile,currentPassword:current,backupCode:backup},accountId);
    if(!result.token)throw new Error('درخواست تأیید آماده نشد. دوباره تلاش کنید.');
    setToken(result.token);setCurrent('');setBackup('');
   }else{
    const result=await request({action:'enroll_confirm',token,code},accountId);
    if(!result.mobileLast4)throw new Error('تأیید شمارهٔ بازیابی انجام نشد.');
    setStatus({...status,mobileLast4:result.mobileLast4});
    setNextBackup(result.backupCode||'');clearForm();setOpened(false);
   }
  }catch(error){setError(errorText(error));}finally{setBusy(false);}
 }
 return <section style={{...panel,marginTop:16}}>
  <strong>بازیابی رمز عبور</strong>
  {status&&<span role="status">{status.mobileLast4?<>شمارهٔ بازیابی تأییدشده با پایان <bdi>{status.mobileLast4}</bdi></>:'شمارهٔ بازیابی هنوز تأیید نشده است.'}</span>}
  {status?.requiresBackup&&<small>برای بازیابی حساب مدیر اصلی، کد پیامکی و کد پشتیبان لازم است.</small>}
  {nextBackup&&<BackupCode code={nextBackup}/>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {!opened&&status&&<div><button className="btn" type="button" onClick={()=>{setNextBackup('');setError('');setOpened(true);}}>{status.mobileLast4?'مدیریت شمارهٔ بازیابی':'ثبت شمارهٔ بازیابی'}</button></div>}
  {opened&&<form style={panel} onSubmit={submit}>
   {token?<label className="field">کد ۶رقمی پیامک<input dir="ltr" autoComplete="one-time-code" inputMode="numeric" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label>:<>
    <label className="field">شمارهٔ همراه بازیابی<input type="tel" dir="ltr" maxLength={20} required value={mobile} onChange={e=>setMobile(e.target.value)}/></label>
    <label className="field">رمز فعلی<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
    {status?.requiresBackup&&status.mobileLast4&&<label className="field">کد پشتیبان فعلی (برای تغییر به شماره‌ای دیگر)<input dir="ltr" type="password" autoComplete="off" maxLength={48} value={backup} onChange={e=>setBackup(e.target.value)}/></label>}
   </>}
   <div style={actions}>
    <button className="btn primary" disabled={busy}>{busy?'در حال انجام…':token?'تأیید و ذخیرهٔ شماره':'ارسال کد تأیید'}</button>
    <button type="button" className="btn" disabled={busy} onClick={()=>{clearForm();setError('');setOpened(false);}}>انصراف</button>
   </div>
  </form>}
 </section>;
}