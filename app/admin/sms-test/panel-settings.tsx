'use client';
import {useState,type FormEvent} from 'react';

type Fields={hasKey:boolean;line:string;mobile:string};
async function requestFields(values?:{apiKey:string;line:string;mobile:string}){
 const response=await fetch('/api/admin/sms-panel',values?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}:{cache:'no-store'});
 const data=await response.json().catch(()=>null) as (Fields & {error?:string})|null;
 if(!response.ok||!data||typeof data.hasKey!=='boolean'||typeof data.line!=='string'||typeof data.mobile!=='string'){
  throw new Error(data?.error||('سرور به درخواست تنظیمات پاسخ معتبر نداد (وضعیت '+response.status+').'));
 }
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
  setFields({hasKey:false,line:'',mobile:''});
  try{setFields(await requestFields());}
  catch(e){setMessage(e instanceof Error?e.message:'خواندن تنظیمات ممکن نشد.');}
  finally{setBusy(false);}
 }
 async function save(event:FormEvent){
  event.preventDefault();
  if(!fields||busy)return;
  setBusy(true);
  try{
   await requestFields({apiKey,line:fields.line,mobile:fields.mobile});
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
