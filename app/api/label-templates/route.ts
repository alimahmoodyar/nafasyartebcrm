import {AccessError,accessResponse,checkOrigin} from '@/lib/authorization';
import {labelTemplateAccess,listLabelTemplates,saveLabelTemplate} from '@/lib/label-templates';
import {printEsc,readRoll,rollInputs} from '@/lib/label-roll';

const json=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'private, no-store'}});
function failed(e:unknown){return accessResponse(e)||Response.json({error:'خواندن یا ذخیرهٔ قالب چاپ انجام نشد.'},{status:503});}
export async function GET(request:Request){
 try{
  const user=await labelTemplateAccess(),templates=await listLabelTemplates();
  if(new URL(request.url).searchParams.get('view')!=='manage')return json({templates});
  if(!user.isAdmin)throw new AccessError('مدیریت قالب‌های چاپ فقط برای مدیر سامانه مجاز است.',403);
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مدیریت قالب‌های چاپ</title><style>
  @font-face{font-family:Vazirmatn;src:url('/fonts/Vazirmatn.woff2')}body{background:#eef2f7;margin:0;font-family:Vazirmatn,Tahoma,sans-serif;color:#172635}main{max-width:760px;margin:24px auto;padding:24px;background:#fff;border-radius:12px}form>div{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}label{display:flex;flex-direction:column;gap:4px}input,select,button{font:inherit;padding:7px;border:1px solid #bbc7d4;border-radius:6px}input[type=number]{width:95px}button{background:#177a4c;color:#fff;cursor:pointer}
  </style><main><h1>مدیریت قالب‌های چاپ</h1><p>برای هر چاپگر و اندازهٔ لیبل یک قالب نام‌دار بسازید. قالب‌های ذخیره‌شده در چاپ سریال دستگاه و لیبل بچ برای کاربران دارای دسترسی چاپ قابل انتخاب‌اند.</p>
  <form id="templates"><label>قالب<select id="saved"><option value="">ساخت قالب جدید</option>${templates.map(t=>`<option value="${printEsc(t.id)}" data-revision="${t.revision}" data-layout="${printEsc(t.layout||'roll')}" data-roll="${printEsc(JSON.stringify(t.roll))}">${printEsc(t.name)}</option>`).join('')}</select></label>
  <div><label>نوع کاغذ<select name="layout"><option value="roll">رول چندستونه</option><option value="thermal">لیبل تکی</option><option value="a4">برگه A4</option></select></label><label>نام قالب<input name="name" maxlength="80" required placeholder="مثلاً رول سه‌ستونهٔ کوچک"></label></div><div>${rollInputs(readRoll(new URLSearchParams()))}</div>
  <button type="submit">ذخیرهٔ قالب</button><p id="feedback" role="status"></p></form><p>برای تطبیق با رول، قالب را در صفحهٔ چاپ انتخاب کنید و یک ردیف آزمایشی بگیرید. فاصله‌ها و حاشیه‌ها را می‌توانید همین‌جا ویرایش کنید.</p></main>
  <script>
  const form=document.getElementById('templates'),saved=document.getElementById('saved'),feedback=document.getElementById('feedback');
  const keys=['width','height','rollWidth','columns','gapX','gapY','left','top'];
  saved.onchange=()=>{
   const option=saved.selectedOptions[0];
   if(!option.value){form.reset();return;}
   form.elements.namedItem('name').value=option.textContent;form.elements.namedItem('layout').value=option.dataset.layout||'roll';
   for(const [key,value] of Object.entries(JSON.parse(option.dataset.roll)))form.elements.namedItem(key).value=value;
  };
  form.onsubmit=async event=>{
   event.preventDefault();
   const button=form.querySelector('button'),option=saved.selectedOptions[0];
   button.disabled=true;
   try{
    const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     id:option.value,revision:Number(option.dataset.revision||0),name:form.elements.namedItem('name').value,layout:form.elements.namedItem('layout').value,confirmed:true,
     roll:Object.fromEntries(keys.map(key=>[key,Number(form.elements.namedItem(key).value)]))
    })});
    const data=await response.json();
    if(!response.ok)throw Error(data.error);
    let next=Array.from(saved.options).find(item=>item.value===data.id);
    if(!next){next=new Option(data.name,data.id);saved.add(next);}
    next.textContent=data.name;next.dataset.revision=data.revision;next.dataset.layout=data.layout||'roll';next.dataset.roll=JSON.stringify(data.roll);
    saved.value=data.id;
    feedback.textContent='قالب ذخیره شد. برای دیدن قالب جدید، صفحهٔ چاپ را دوباره باز کنید.';
   }catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
  };
  </script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'"}});
 }catch(e){return failed(e);}
}

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await labelTemplateAccess();
  const body:any=await request.json().catch(()=>null);
  if(!user.isAdmin&&(body?.id||body?.revision!==0))throw new AccessError('ویرایش قالب‌های موجود فقط برای مدیر سامانه مجاز است؛ قالب تازه را با نام جدید ذخیره کنید.',403);
  return json(await saveLabelTemplate(user.userId,body));
 }catch(e){return failed(e);}
}
