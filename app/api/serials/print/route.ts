import {formatDate} from '@/lib/persian-date';
import {requireAccess,accessResponse,AccessError} from '@/lib/authorization';
import {trainingContext} from '@/lib/training-context';
import {storage} from '@/lib/storage';
import {listLabelTemplates} from '@/lib/label-templates';
import {printEsc as esc,labelTemplateManager,readRoll,readLabelSize,labelContentCss,rollCss,rollInputs,rollPitch,rollRows,templatePicker,selectRollScript,printOnLoad} from '@/lib/label-roll';

export async function GET(request:Request){
 try{
  const user=await requireAccess('device'),url=new URL(request.url),q=url.searchParams,id=q.get('id')||'';
  const layout=q.get('layout')??'a4',small=q.get('label')==='small',onlySerial=q.get('serial')||null;
  if(!['a4','thermal','roll'].includes(layout))throw new AccessError('قالب چاپ معتبر نیست.',400);
  const db=storage(),run=await db.prepare('SELECT day,payload FROM serial_runs WHERE id=?').bind(id).first<{day:string;payload:string}>();
  if(!run)throw new AccessError('نوبت تولید سریال پیدا نشد.',404);
  const {results}=await db.prepare('SELECT serial FROM serial_reservations WHERE run_id=? ORDER BY serial').bind(id).all<{serial:string}>();
  const serials=results.filter(r=>onlySerial===null||r.serial===onlySerial).map(r=>r.serial);
  if(!serials.length)throw new AccessError('سریال ثبت‌شده در این نوبت پیدا نشد.',404);
  const product=JSON.parse(run.payload);
  const rawCopies=q.get('copies')??String(small?Math.max(1,Math.min(20,Math.trunc(Number(product.smallLabels)||1))):1);
  const copies=Number(rawCopies);
  if(!/^\d+$/.test(rawCopies)||copies<1||copies>100||copies*serials.length>2000)
   throw new AccessError('تعداد نسخه برای هر سریال ۱ تا ۱۰۰ و مجموع لیبل‌ها حداکثر ۲۰۰۰ است.',400);
  const size={width:small?35:layout==='a4'?62:60,height:small?15:30};
  const roll=layout==='roll'?readRoll(q,size):null,geometry=roll??readRoll(new URLSearchParams(),readLabelSize(q,size));
  const test=q.get('print')==='test',total=copies*serials.length,compact=small||(roll!==null&&(roll.height<25||roll.width<45));
  const design=compact?{width:35,height:15}:size;
  const labels=Array.from({length:test&&roll?Math.min(total,roll.columns):total},(_,i)=>{
   const serial=serials[Math.floor(i/copies)];
   return `<article class="label"><div class="label-content"><div class="brand"><img src="/brand/nafasyar-logo.png" alt="نفس‌یار"><span>با من نفس بکش</span></div><div class="product">${esc(product.name)} · ${esc(product.model)}</div><div class="serial" dir="ltr">${esc(serial)}</div><small>تاریخ تخصیص سریال: ${esc(formatDate(run.day))}</small></div></article>`;
  });
  const templates=await listLabelTemplates();
  const serialOptions=[['','همهٔ سریال‌های این نوبت'],...results.map(({serial})=>[serial,serial])].map(([v,title])=>`<option value="${esc(v)}"${v===(onlySerial??'')?' selected':''}>${esc(title)}</option>`).join('');
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>چاپ سریال‌های ${esc(product.name)}</title><style>
  @font-face{font-family:Vazirmatn;src:url('/fonts/Vazirmatn.woff2')}*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#111;font-family:Vazirmatn,Tahoma,sans-serif}header{max-width:900px;margin:16px auto;padding:16px;background:white;border-radius:12px}h1{font-size:20px;margin:0}form,fieldset>div{display:flex;gap:12px;flex-wrap:wrap;align-items:end}label{display:flex;flex-direction:column;font-size:13px}fieldset{flex-basis:100%}input,select,button{font:inherit;padding:7px;border:1px solid #bbc7d4;border-radius:6px}input[type=number]{width:100px}button{cursor:pointer}.print{background:#177a4c;color:#fff}.sheet{display:grid;grid-template-columns:repeat(${layout==='a4'?Math.max(1,Math.floor(196/(geometry.width+2))):1},${geometry.width}mm);gap:${layout==='a4'?2:0}mm;width:max-content;margin:16px auto}.label{width:${geometry.width}mm;height:${geometry.height}mm;background:white;break-inside:avoid;border:1px dashed #aaa;direction:rtl;overflow:hidden}.label-content{padding:${compact?1:2}mm;display:flex;flex-direction:column;justify-content:${compact?'center':'space-between'}}${labelContentCss(geometry,design)}.brand{display:flex;align-items:center;justify-content:space-between;gap:2mm}.brand img{width:19mm;height:8mm;object-fit:contain}.brand span,.product{font-size:8pt}.product{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.serial{font:bold ${compact?7:9}pt Vazirmatn,sans-serif;line-height:1.2;overflow-wrap:anywhere;text-align:center}small{font-size:7pt;text-align:center}${compact?'.brand,.product,.label small{display:none}':''}${roll?rollCss(roll):''}
  @page{size:${roll?`${roll.rollWidth}mm ${rollPitch(roll)}mm`:layout==='thermal'?`${geometry.width}mm ${geometry.height}mm`:'A4'};margin:${layout==='a4'?8:0}mm}@media print{body{background:white}header{display:none}.sheet{margin:0;${layout==='thermal'?'display:block':''}}.label{border:0;${layout==='thermal'?'break-after:page':''}}.label:last-child{break-after:auto}}
  </style></head><body><header><h1>چاپ لیبل سریال دستگاه</h1><p>${esc(product.name)} · ${total} لیبل${test?' · یک ردیف آزمایشی':''}</p>
  <form id="label-options" method="get"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="label" value="${small?'small':'large'}">
  <label>سریال<select name="serial">${serialOptions}</select></label><label>تعداد نسخه از هر سریال<input name="copies" type="number" min="1" max="100" value="${copies}" required></label>
  <label>نوع کاغذ<select name="layout">${[['a4','برگه A4'],['thermal','لیبل تکی'],['roll','رول قابل تنظیم']].map(([key,title])=>`<option value="${key}"${key===layout?' selected':''}>${title}</option>`).join('')}</select></label>
  ${templatePicker(templates,labelTemplateManager,user.isAdmin&&!trainingContext.getStore(),q.get('template')??'',!trainingContext.getStore())}
  <div>${rollInputs(geometry,['rollWidth','columns','gapX','gapY','left','top'])}</div>
  <fieldset id="roll-settings" ${roll?'':'hidden disabled'}><legend>تنظیمات رول</legend><div>${rollInputs(geometry,['width','height'])}</div></fieldset>
  <button type="submit" id="label-preview">پیش‌نمایش</button><button type="submit" name="print" value="test" id="test-roll" ${roll?'':'hidden'}>چاپ یک ردیف آزمایشی</button><button class="print" type="submit" name="print" value="1">چاپ / ذخیره PDF</button></form>
  <p>مقیاس چاپ ۱۰۰٪ باشد. چاپ مجدد از همان شماره‌ها استفاده می‌کند.</p></header><main class="sheet">${roll?rollRows(labels,roll):labels.join('')}</main>
  <script>
  const form=document.getElementById('label-options'),layout=form.elements.namedItem('layout');
  function updateRoll(){
   const show=layout.value==='roll',settings=document.getElementById('roll-settings');
   settings.hidden=settings.disabled=!show;document.getElementById('test-roll').hidden=!show;
  }
  layout.addEventListener('change',updateRoll);
  ${selectRollScript}
  ${printOnLoad(test||q.get('print')==='1')}
  </script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src 'self'; font-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'"}});
 }catch(e){return accessResponse(e)||Response.json({error:'آماده‌سازی چاپ انجام نشد؛ دوباره تلاش کنید.'},{status:503});}
}
