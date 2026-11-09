import {signSurveyTicket,verifySurveyTicket,surveyUuid} from '@/lib/hospital-gas-survey-ticket';
import {normalizeSurvey} from '@/lib/hospital-gas-survey-contract';
import browserScript from './browser-source.js';
const page=`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>پرسش‌نامهٔ گازهای بیمارستانی</title><style>
*{box-sizing:border-box}body{font:16px/1.7 system-ui,sans-serif;margin:0;background:#eff5f5;color:#142c34}main{max-width:950px;margin:auto;padding:22px}header,.panel,.notice,fieldset{background:#fff;border:1px solid #cbdcdb;border-radius:12px;padding:16px;margin-block:12px}header{border-top:5px solid #176859}h1{font-size:1.45rem;margin:6px 0}h2{font-size:1.2rem}h3,p{margin-block:8px}fieldset{min-width:0}legend{font-weight:700;padding:0 6px}.field{display:flex;flex-direction:column;gap:4px;margin-block:7px}.form-grid,.hospital-network-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:10px}.tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px}input,select,button{font:inherit}input:not([type=checkbox]),select{width:100%;min-height:42px;padding:7px;border:1px solid #9db7b4;border-radius:7px;background:white}button{color:#174237;background:#fff;border:1px solid #9db7b4;border-radius:8px;padding:8px 12px;cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #176859;outline-offset:2px}.primary,.is-active,[aria-pressed=true]{background:#176859;color:white}.hospital-network-option{display:grid;justify-items:center;gap:4px;min-height:95px;padding:8px;border:1px solid #9db7b4;border-radius:8px}.hospital-network-check{display:inline-flex;align-items:center;gap:8px}.error{border-color:#a33;color:#8a2020}.space-y-4>*+*{margin-top:12px}[hidden]{display:none!important}summary{cursor:pointer}small{font-size:.82rem}
</style><script defer src="/survey.js"></script></head><body><div id="app"></div></body></html>`;
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"};
const error=(message,status,extra={})=>Response.json({error:message},{status,headers:{...headers,...extra}});
const reply=(value,extra={})=>Response.json(value,{headers:{...headers,...extra}});
const missing='لینک معتبر نیست یا دیگر فعال نیست.';
async function readBody(request){
 const reader=request.body?.getReader();
 if(!reader)throw Error('empty');
 const decoder=new TextDecoder();
 let text='',length=0;
 while(true){
  const {done,value}=await reader.read();
  if(done)break;
  length+=value.byteLength;
  if(length>56000){await reader.cancel();throw Error('too-large');}
  text+=decoder.decode(value,{stream:true});
 }
 return JSON.parse(text+decoder.decode());
}

export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/survey.js')return new Response(browserScript,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8'}});
 if(request.method==='GET'&&(/^\/q\/[a-f0-9-]{36}$/i.test(url.pathname)||url.pathname==='/'))return new Response(page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 const manage=url.pathname==='/manage';
 if(!manage&&url.pathname!=='/survey')return error('صفحه پیدا نشد.',404);
 const origin=request.headers.get('origin');
 const cross=manage?{'Access-Control-Allow-Origin':env.NAFASYAR_ORIGIN,'Vary':'Origin'}:{};
 if(origin!==(manage?env.NAFASYAR_ORIGIN:url.origin))return error('درخواست معتبر نیست.',403);
 if(manage&&request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,...cross,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
 if(request.method!=='POST'||!request.headers.get('content-type')?.startsWith('application/json'))return error('درخواست معتبر نیست.',403,cross);
 const secret=env.GAS_SURVEY_BRIDGE_SECRET;
 if(!secret||!env.DB)return error('فرم موقتاً در دسترس نیست.',503,cross);
 let body;
 try{body=await readBody(request);}catch{return error('درخواست معتبر نیست.',400,cross);}
 if(!body||!surveyUuid.test(body.id||''))return error(missing,404,cross);
 try{
  const db=env.DB,read=()=>db.prepare('SELECT data FROM gas_survey_state WHERE id=?').bind(body.id).first();
  const persist=receipt=>db.prepare('INSERT OR IGNORE INTO gas_survey_state(id,data) VALUES(?,?)').bind(body.id,JSON.stringify(receipt)).run();
  if(manage){
   if(body.mode!=='read'&&body.mode!=='revoke')return error(missing,404,cross);
   const ticket=await verifySurveyTicket(secret,body.mode,body.ticket);
   if(!ticket||ticket.id!==body.id||!Number.isFinite(ticket.until)||ticket.until<=Date.now())return error(missing,404,cross);
   if(body.mode==='revoke')await persist({id:body.id,status:'revoked',at:new Date().toISOString()});
   const row=await read();
   return reply({receipt:row?await signSurveyTicket(secret,'receipt',JSON.parse(row.data)):null},cross);
  }
  const invite=await verifySurveyTicket(secret,'invite',body.token);
  const now=new Date().toISOString();
  if(!invite||invite.id!==body.id||invite.expires<=now)return error(missing,404,cross);
  const existing=await read();
  const status=existing?JSON.parse(existing.data).status:null;
  if(status==='revoked')return error(missing,404,cross);
  if(body.mode==='open')return reply({center:invite.center,submitted:status==='submitted'},cross);
  if(body.mode!=='submit'||status)return error(missing,404,cross);
  let answers;
  try{answers=normalizeSurvey(body.answers);}catch(e){return error(e.message,400,cross);}
  const receipt={id:body.id,status:'submitted',at:now,answers};
  const result=await persist(receipt);
  return result.meta.changes===1?reply({ok:true},cross):error('این لینک دیگر برای ثبت پاسخ فعال نیست.',409,cross);
 }catch{return error('فرم موقتاً در دسترس نیست.',503,cross);}
}};
