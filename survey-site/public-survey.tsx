import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HospitalOxygenCapacity} from '@/components/trace/hospital-oxygen-capacity';
import type {SurveyAnswers} from '@/lib/hospital-gas-survey-contract';

const id=location.pathname.split('/').pop();
const token=location.hash.slice(1);
const valid=/^[0-9a-f-]{36}$/i.test(id||'')&&/^[a-f0-9]{64}$/.test(token);
async function send(mode:'open'|'submit',answers?:SurveyAnswers){
 const response=await fetch('/survey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token,mode,answers})});
 const result=await response.json() as {center:string;submitted:boolean;error?:string};
 if(!response.ok)throw Error(result.error);
 return result;
}
function PublicSurvey(){
 const [state,setState]=useState<{center:string;submitted:boolean}>();
 const [error,setError]=useState(valid?'':'برای باز کردن فرم، لینک کامل پرسش‌نامه را دوباره باز کنید.');
 useEffect(()=>{if(valid)void send('open').then(setState).catch(error=>setError(error.message));},[]);
 async function submit(answers:SurveyAnswers){await send('submit',answers);setState(current=>current&&({...current,submitted:true}));window.scrollTo(0,0);}
 return <main dir="rtl"><header><strong>نفس‌یار</strong><h1>پرسش‌نامهٔ گازهای بیمارستانی</h1>{state&&<p>{state.center}</p>}</header>
  {error?<p className="notice error" role="alert">{error}</p>:!state?<p role="status">در حال دریافت پرسش‌نامه…</p>:state.submitted?<p className="notice" role="status">پاسخ ثبت شد و برای بررسی در اختیار کارشناس قرار گرفت.</p>:<>
   <p>اطلاعات فنی مرکز را وارد کنید. این فرم برای ثبت پاسخ به درخواست ظرفیت‌سنجی است.</p>
   <HospitalOxygenCapacity onSubmit={submit}/>
  </>}
 </main>;
}
createRoot(document.getElementById('app')!).render(<PublicSurvey/>);
