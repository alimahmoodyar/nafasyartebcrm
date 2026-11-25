'use client';
import {useState,type FormEvent} from 'react';

type Fields={hasKey:boolean;line:string;mobile:string};
async function requestFields(mode:string,values?:{apiKey:string;line:string;mobile:string}){
 const response=await fetch('/api/public-warranty',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,...values})});
 const data=await response.json() as Fields & {error?:string};
 if(!response.ok)throw new Error(data.error||'دسترسی به تنظیمات پنل ممکن نشد.');
 return data;
}
export function PanelSettings(){
 const [fields,setFields]=useState<Fields|null>(null);
 const [apiKey,setKey]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function open(){
  setMessage('');
  setBusy(true);
  try{setFields(await requestFields('panel-settings'));}
  catch(e){setMessage(e instanceof Error?e.message:'خواندن تنظیمات ممکن نشد.');}
  finally{setBusy(false);}
 }
 async function save(event:FormEvent){
  event.preventDefault();
  if(!fields||busy)return;
  setBusy(true);
  try{
   await requestFields('save-panel',{apiKey,line:fields.line,mobile:fields.mobile});
   setKey('');setFields(null);setMessage('تنظیمات ذخیره شد. برای بررسی ارسال، «تست پیامک» را بزنید.');
  }catch(e){setMessage(e instanceof Error?e.message:'ذخیره نشد.');}
  finally{setBusy(false);}
 }
 return <><button type="button" className="btn" disabled={busy} aria-expanded={!!fields} onClick={()=>{if(fields){setFields(null);setKey('');setMessage('');}else void open();}}>تنظیمات پنل</button>
 {fields&&<form className="card" onSubmit={save}><fieldset disabled={busy}><legend>تنظیمات پنل پیامک</legend>
 <label>کلید پنل SMS.ir<input type="password" autoComplete="new-password" dir="ltr" required={!fields.hasKey} value={apiKey} placeholder={fields.hasKey?'برای حفظ کلید فعلی خالی بگذارید':''} onChange={e=>setKey(e.target.value)}/></label>
 <label>خط فرستنده<input dir="ltr" inputMode="numeric" required value={fields.line} onChange={e=>setFields({...fields,line:e.target.value})}/></label>
 <label>شمارهٔ همراه تست<input dir="ltr" inputMode="tel" required value={fields.mobile} onChange={e=>setFields({...fields,mobile:e.target.value})}/></label>
 <button className="btn" type="submit">ذخیرهٔ تنظیمات</button></fieldset></form>}
 {message&&<p role="status">{message}</p>}</>;
}
