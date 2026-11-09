import browserScript from './browser-source.js';
const page=`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>پرسش‌نامهٔ گازهای بیمارستانی</title><style>
*{box-sizing:border-box}body{font:16px/1.7 system-ui,sans-serif;margin:0;background:#eff5f5;color:#142c34}main{max-width:950px;margin:auto;padding:22px}header,.panel,.notice,fieldset{background:#fff;border:1px solid #cbdcdb;border-radius:12px;padding:16px;margin-block:12px}header{border-top:5px solid #176859}h1{font-size:1.45rem;margin:6px 0}h2{font-size:1.2rem}h3,p{margin-block:8px}fieldset{min-width:0}legend{font-weight:700;padding:0 6px}.field{display:flex;flex-direction:column;gap:4px;margin-block:7px}.form-grid,.hospital-network-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:10px}.tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px}input,select,button{font:inherit}input:not([type=checkbox]),select{width:100%;min-height:42px;padding:7px;border:1px solid #9db7b4;border-radius:7px;background:white}button{color:#174237;background:#fff;border:1px solid #9db7b4;border-radius:8px;padding:8px 12px;cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #176859;outline-offset:2px}.primary,.is-active,[aria-pressed=true]{background:#176859;color:white}.hospital-network-option{display:grid;justify-items:center;gap:4px;min-height:95px;padding:8px;border:1px solid #9db7b4;border-radius:8px}.hospital-network-check{display:inline-flex;align-items:center;gap:8px}.error{border-color:#a33;color:#8a2020}.space-y-4>*+*{margin-top:12px}[hidden]{display:none!important}summary{cursor:pointer}small{font-size:.82rem}
</style><script defer src="/survey.js"></script></head><body><div id="app"></div></body></html>`;
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"};
const error=(message,status)=>Response.json({error:message},{status,headers});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/survey.js')return new Response(browserScript,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8'}});
 if(request.method==='GET'&&(/^\/q\/[a-f0-9-]{36}$/i.test(url.pathname)||url.pathname==='/'))return new Response(page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(request.method!=='POST'||url.pathname!=='/survey')return error('صفحه پیدا نشد.',404);
 if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return error('درخواست معتبر نیست.',403);
 if(!env.GAS_SURVEY_BRIDGE_SECRET||!env.NAFASYAR_SITES_SERVICE||!env.NAFASYAR_ORIGIN)return error('فرم موقتاً در دسترس نیست.',503);
 try{
  const reader=request.body?.getReader();
  if(!reader)return error('درخواست معتبر نیست.',400);
  const chunks=[];
  let length=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   length+=value.byteLength;
   if(length>36000){await reader.cancel();return error('پاسخ بیش از اندازه بزرگ است.',413);}
   chunks.push(value);
  }
  const upstream=await fetch(new URL('/api/hospital-gas-survey/bridge',env.NAFASYAR_ORIGIN),{
   method:'POST',redirect:'error',
   headers:{'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+env.NAFASYAR_SITES_SERVICE,'X-Nafasyar-Survey-Bridge':env.GAS_SURVEY_BRIDGE_SECRET},
   body:await new Blob(chunks).text()
  });
  if(!upstream.headers.get('content-type')?.includes('application/json'))return error('فرم موقتاً در دسترس نیست.',503);
  return new Response(upstream.body,{status:upstream.status,headers:{...headers,'Content-Type':'application/json'}});
 }catch{return error('ارتباط برقرار نشد. دوباره تلاش کنید.',503);}
}};
