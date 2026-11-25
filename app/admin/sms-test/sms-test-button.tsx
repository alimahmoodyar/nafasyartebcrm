'use client';
import {useRef,useState} from 'react';

export function SmsTestButton(){
 const sending=useRef(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function send(){
  if(sending.current)return;
  sending.current=true;
  setBusy(true);
  setMessage('');
  try{
   const response=await fetch('/api/public-warranty',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'test-sms'})});
   const result=await response.json();
   if(!response.ok || !result.accepted)throw new Error(result.error || 'ارسال پیامک تأیید نشد.');
   setMessage('پنل ارسال پیامک به شمارهٔ منتهی به '+result.mobileLast4+' را پذیرفت.');
  }catch(error){
   setMessage(error instanceof SyntaxError?'پاسخ سرور قابل خواندن نبود.':error instanceof Error?error.message:'ارتباط با سرور برقرار نشد.');
  }finally{
   sending.current=false;
   setBusy(false);
  }
 }
 return <><button className="btn" type="button" disabled={busy} onClick={send}>{busy?'در حال ارسال…':'تست پیامک'}</button>{message && <p className="notice" role="status">{message}</p>}</>;
}
