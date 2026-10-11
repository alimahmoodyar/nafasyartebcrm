'use client';
import {NumberInput} from '@/components/trace/number-input';
import {useState} from 'react';
import {notifyAccountChange} from '@/lib/account-change';
export function AccountCredentials({accountId,username='',required=false}:{accountId:string;username?:string;required?:boolean}){
 const [login,setLogin]=useState(username),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setError('');if(next!==repeat){setError('تکرار رمز مطابقت ندارد.');return;}setBusy(true);try{const r=await fetch('/api/auth/credentials',{method:'POST',headers:{'Content-Type':'application/json','x-profile-account':accountId},body:JSON.stringify({username:login,currentPassword:current,newPassword:next,confirmed:true})}),d=await r.json() as any;if(!r.ok)throw Error(d.error);setCurrent('');setNext('');setRepeat('');notifyAccountChange();window.location.assign('/');}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>
 <h3>{required?'تغییر رمز اولیه برای ادامه ورود':'تغییر نام کاربری و رمز من'}</h3><p>پس از ذخیره، با اطلاعات تازه دوباره وارد شوید. نام کاربری را می‌توانید حفظ یا تغییر دهید.</p>
 <label className="field">نام کاربری<NumberInput fieldKey={"login"} dir="ltr" autoComplete="username" required minLength={3} maxLength={40} value={login} onChange={e=>setLogin(e.target.value)}/></label>
 <label className="field">رمز فعلی<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
 <label className="field">رمز تازه (حداقل ۱۰ نویسه)<input type="password" autoComplete="new-password" required={required} minLength={10} maxLength={128} value={next} onChange={e=>setNext(e.target.value)}/></label>
 <label className="field">تکرار رمز تازه<input type="password" autoComplete="new-password" required={required} minLength={10} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>
 {error&&<p role="alert">{error}</p>}<button className="btn primary" disabled={busy}>{busy?'در حال ذخیره…':'ذخیره اطلاعات ورود'}</button></form>;
}
export function RepresentativeCredentials({credentials,onClose}:{credentials:{username:string;mobile:string;name:string};onClose:()=>void}){
 const [message,setMessage]=useState('');
 const initial=credentials.mobile.replace(/[\s()-]/g,'').replace(/^\+98/,'0').replace(/^0098/,'0');
 const text=`${credentials.name} عزیز\nورود به هم‌نفس: ${typeof window==='undefined'?'':window.location.origin}\nنام کاربری: ${credentials.username}\nرمز اولیه: ${initial}\nدر اولین ورود، تغییر رمز اولیه الزامی است. نام کاربری را هم می‌توانید تغییر دهید.`;
 return <section className="notice" aria-label="اطلاعات ورود نماینده"><h3>حساب نماینده ساخته شد</h3><p>این متن را به‌صورت خصوصی به خود نماینده تحویل دهید.</p><textarea readOnly value={text} rows={7}/><div className="tools"><button type="button" className="btn" onClick={async()=>{try{await navigator.clipboard.writeText(text);setMessage('متن کپی شد.')}catch{setMessage('متن را انتخاب و دستی کپی کنید.')}}}>کپی متن اطلاعات ورود</button><button type="button" className="btn" onClick={onClose}>بستن اطلاعات ورود</button></div>{message&&<p role="status">{message}</p>}</section>;
}
