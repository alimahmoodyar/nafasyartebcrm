'use client';
import {PasskeyLogin} from './passkeys';
import {PasswordRecoveryForm} from './password-recovery';
import {NumberInput} from '@/components/trace/number-input';
import {notifyAccountChange} from '@/lib/account-change';
import {useState,type FormEvent} from 'react';

export function PasswordLogin({onLogin}:{onLogin:()=>void}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[recovering,setRecovering]=useState(false);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'ورود انجام نشد.');
   setPassword('');notifyAccountChange();onLogin();
  }catch(error){setError(error instanceof Error?error.message:'ورود انجام نشد.');}finally{setBusy(false);}
 }
 if(recovering)return <PasswordRecoveryForm initialUsername={username} onBack={()=>setRecovering(false)}/>;
 return <form style={{width:'100%',maxWidth:420,margin:'20px auto',textAlign:'right'}} onSubmit={submit}>
  <label className="field">نام کاربری<NumberInput fieldKey="username" autoComplete="username" required dir="auto" maxLength={100} value={username} onChange={e=>setUsername(e.target.value)}/></label>
  <label className="field" style={{marginTop:12}}>رمز عبور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {error&&<p className="notice error" role="alert">{error}</p>}
  <button className="btn primary" style={{marginTop:16,width:'100%'}} disabled={busy}>{busy?'در حال ورود…':'ورود به سامانه'}</button>
  <button type="button" className="btn" style={{marginTop:8,width:'100%'}} disabled={busy} onClick={()=>{setPassword('');setError('');setRecovering(true);}}>رمز عبور را فراموش کرده‌ام</button>
  <PasskeyLogin onLogin={onLogin}/>
 </form>;
}