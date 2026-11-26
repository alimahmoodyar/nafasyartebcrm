'use client';

import {useEffect,useState} from 'react';
import {startRegistration,startAuthentication,browserSupportsWebAuthn,platformAuthenticatorIsAvailable} from '@simplewebauthn/browser';
import type {PublicKeyCredentialCreationOptionsJSON,PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser';
import {notifyAccountChange} from '@/lib/account-change';

const entryLabel='ورود با فیس‌آیدی یا اثر انگشت';
const endpoint='/api/auth/passkeys';

async function readResponse(response:Response){
 const data=await response.json() as any;
 if(!response.ok)throw new Error((data.error||'درخواست ورود با گوشی انجام نشد.')+(data.reference?' کد پیگیری: '+data.reference:''));
 return data;
}

async function post(body:unknown){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return readResponse(response);
}

function deviceErrorName(error:unknown){
 if(!(error instanceof Error))return '';
 if(error.cause instanceof Error)return error.cause.name;
 return error.name;
}

function message(error:unknown){
 const name=deviceErrorName(error);
 if(name==='InvalidStateError')return 'ورود با این دستگاه قبلاً ثبت شده است. از صفحهٔ ورود آن را امتحان کنید.';
 if(name==='NotAllowedError')return 'گوشی تأیید را انجام نداد یا مهلت تمام شد. دوباره تلاش کنید یا با رمز وارد شوید.';
 if(name==='SecurityError')return 'نشانی هم‌نفس را مستقیم در Safari یا Chrome روی گوشی باز کنید و دوباره تلاش کنید.';
 return error instanceof Error?error.message:'عملیات انجام نشد.';
}

export function PasskeyLogin({onLogin}:{onLogin:()=>void}){
 const [supported,setSupported]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [retryOptions,setRetryOptions]=useState<PublicKeyCredentialRequestOptionsJSON|null>(null);
 useEffect(()=>setSupported(browserSupportsWebAuthn()&&window.isSecureContext),[]);
 if(!supported)return null;

 async function login(){
  if(busy)return;
  setBusy(true);setError('');
  let options=retryOptions;
  try{
   if(!options)options=(await post({mode:'login_options'})).options;
   if(!options)throw new Error('درخواست ورود با گوشی آماده نشد.');
   const response=await startAuthentication({optionsJSON:options});
   options=null;setRetryOptions(null);
   await post({mode:'login_verify',response});
   notifyAccountChange();onLogin();
  }catch(error){
   const retry=options&&!retryOptions&&deviceErrorName(error)==='NotAllowedError';
   setRetryOptions(retry?options:null);
   setError(message(error));
  }finally{setBusy(false);}
 }

 return <div>
  <button type="button" className="btn" disabled={busy} style={{width:'100%',marginTop:12}} onClick={login}>
   {busy?'در حال تأیید…':retryOptions?'تأیید ورود روی همین گوشی':entryLabel}
  </button>
  {error&&<p className="notice error" role="alert">{error}</p>}
 </div>;
}

type DeviceKey={id:string;name:string;rp_id:string};

function DeviceSetup(){
 const [available,setAvailable]=useState<boolean|null>(null);
 const [keys,setKeys]=useState<DeviceKey[]|null>(null);
 const [password,setPassword]=useState('');
 const [registration,setRegistration]=useState<PublicKeyCredentialCreationOptionsJSON|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');

 async function refresh(){
  const response=await fetch(endpoint,{cache:'no-store'});
  const data=await readResponse(response) as {keys:DeviceKey[]};
  return data.keys.filter(key=>key.rp_id===window.location.hostname);
 }

 useEffect(()=>{
  let active=true;
  if(!window.isSecureContext||!browserSupportsWebAuthn()){setAvailable(false);return;}
  void platformAuthenticatorIsAvailable().then(value=>{if(active)setAvailable(value);},()=>{if(active)setAvailable(false);});
  void refresh().then(value=>{if(active)setKeys(value);},error=>{if(active)setError(message(error));});
  return ()=>{active=false;};
 },[]);

 async function prepare(){
  if(busy||!password)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {options}=await post({mode:'register_options',password});
   setPassword('');setRegistration(options);
  }catch(error){setError(message(error));}finally{setBusy(false);}
 }

 async function activate(){
  if(busy||!registration)return;
  setBusy(true);setError('');
  try{
   // Start WebAuthn from this tap, before any network request or other await.
   const response=await startRegistration({optionsJSON:registration});
   const result=await post({mode:'register_verify',response,name:'ورود با دستگاه'});
   if(!result.saved)throw new Error('ذخیرهٔ روش ورود تأیید نشد.');
   setNotice('ورود با گوشی فعال شد. در صفحهٔ ورود همین گزینه را بزنید.');
   await refresh().then(setKeys,()=>{});
  }catch(error){setError(message(error));}
  finally{setRegistration(null);setBusy(false);}
 }

 async function remove(id:string){
  if(busy||!password||!window.confirm('ورود با این دستگاه حذف شود؟'))return;
  setBusy(true);setError('');setNotice('');
  try{
   await post({mode:'remove',credentialId:id,password,confirmed:true});
   setKeys(current=>current?.filter(key=>key.id!==id)||[]);
   setPassword('');setNotice('این روش ورود حذف شد.');
  }catch(error){setError(message(error));}finally{setBusy(false);}
 }

 return <>
  <p>یک‌بار روی گوشی فعالش کنید. بعد از آن، گوشی هنگام ورود از فیس‌آیدی، اثر انگشت یا رمز قفل دستگاه استفاده می‌کند.</p>
  {available===false&&<p role="status">برای راه‌اندازی، همین نشانی را مستقیم در Safari یا Chrome گوشی باز کنید و قفل صفحه را فعال کنید.</p>}
  {available===null&&!error&&<p role="status">در حال بررسی امکان ورود با دستگاه…</p>}
  {registration?<div className="tools">
   <button type="button" className="btn primary" disabled={busy} onClick={activate}>{busy?'در حال تأیید…':'تأیید روی همین گوشی'}</button>
   <button type="button" className="btn" disabled={busy} onClick={()=>setRegistration(null)}>انصراف</button>
  </div>:<>
   {(available||!!keys?.length)&&<label className="field">رمز فعلی هم‌نفس
    <input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/>
   </label>}
   {available&&<button type="button" className="btn primary" disabled={busy||!password} onClick={prepare}>
    {busy?'در حال آماده‌سازی…':'آماده‌سازی ورود با گوشی'}
   </button>}
   {keys?.map(key=><div key={key.id}><span>{key.name}</span>
    <button type="button" className="btn" disabled={busy||!password} onClick={()=>void remove(key.id)}>حذف این روش ورود</button>
   </div>)}
  </>}
  {notice&&<p role="status">{notice}</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
 </>;
}

export function PasskeySettings(){
 const [open,setOpen]=useState(false);
 return <section>
  <button type="button" className="btn" aria-expanded={open} onClick={()=>setOpen(!open)}>{entryLabel}</button>
  {open&&<DeviceSetup/>}
 </section>;
}