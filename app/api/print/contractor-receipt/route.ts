import {env} from 'cloudflare:workers';

export function GET(){
 let sender:string;
 try{
  const configured=new URL(String((env as any).CARGO_PUBLIC_ORIGIN||''));
  if(configured.protocol!=='https:'||configured.username||configured.password||configured.pathname!=='/'||configured.search||configured.hash)throw Error();
  sender=configured.origin;
 }catch{return new Response('نشانی سامانهٔ تحویل بار تنظیم نشده است.',{status:503});}
 return new Response(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self' http://127.0.0.1:18743; base-uri 'none'">
<title>رسید دریافت مواد امانی</title>
<style>body{font:16px/1.8 Tahoma,sans-serif;max-width:175mm;margin:2rem auto}pre{font:inherit;white-space:pre-wrap}button{font:inherit}@page{size:A4;margin:14mm}@media print{button{display:none}}</style></head>
<body data-sender="${sender}"><h1>رسید دریافت مواد امانی نفس‌یار</h1><pre id="receipt">در انتظار دریافت اطلاعات رسید…</pre>
<button data-office-print data-width="210" data-height="297" hidden>چاپ مستقیم / دریافت PDF</button>
<script src="/label-printer/documents.js"></script><script src="/label-printer/receipt.js"></script></body></html>
`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}});
}
