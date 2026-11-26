'use client';

import {useEffect,useState,type FormEvent} from 'react';

const endpoint='/api/integrations/bale/safir';
type Settings={botId:number|null;hasKey:boolean;enabled:boolean};

async function readResponse(response:Response){
 const data=await response.json() as Settings&{error?:string};
 if(!response.ok)throw new Error(data.error||'تنظیمات سفیر بله در دسترس نیست.');
 return data;
}

export function BaleSafirSettings(){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [botId,setBotId]=useState(''),[apiKey,setApiKey]=useState(''),[enabled,setEnabled]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');

 function apply(data:Settings){setSettings(data);setBotId(data.botId===null?'':String(data.botId));setEnabled(data.hasKey?data.enabled:true);}
 useEffect(()=>{
  let active=true;
  void fetch(endpoint,{cache:'no-store'}).then(readResponse).then(data=>{if(active)apply(data);},error=>{if(active)setError(error.message);});
  return ()=>{active=false;};
 },[]);

 async function save(event:FormEvent){
  event.preventDefault();
  if(busy||!settings)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId,apiKey,enabled})});
   apply(await readResponse(response));setApiKey('');setMessage('تنظیمات سفیر بله ذخیره شد.');
  }catch(error){setError(error instanceof Error?error.message:'ذخیره انجام نشد.');}finally{setBusy(false);}
 }

 return <section className="panel inside" aria-label="ارسال همراه پیامک در بله">
  <h2>ارسال همراه پیامک در بله</h2>
  <p>پس از فعال‌سازی، هم‌نفس برای شمارهٔ دریافت‌کنندهٔ پیامک در بله هم پیام می‌فرستد.</p>
  {!settings&&!error&&<p role="status">در حال دریافت تنظیمات…</p>}
  {settings&&<form onSubmit={save}>
   <div className="formgrid">
    <label className="field">شناسهٔ عددی بازو<input required dir="ltr" inputMode="numeric" maxLength={16} value={botId} onChange={event=>setBotId(event.target.value)}/></label>
    <label className="field">کلید دسترسی سفیر بله<input type="password" autoComplete="new-password" required={!settings.hasKey} dir="ltr" maxLength={2048} value={apiKey} placeholder={settings.hasKey?'کلید ذخیره شده است':'کلید را از پنل کسب‌وکار بله بگیرید'} onChange={event=>setApiKey(event.target.value)}/></label>
    <label><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> ارسال در بله همراه پیامک فعال باشد</label>
   </div>
   <button className="btn primary" disabled={busy}>{busy?'در حال ذخیره…':'ذخیرهٔ تنظیمات بله'}</button>
  </form>}
  {error&&<p role="alert" className="notice error">{error}</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}