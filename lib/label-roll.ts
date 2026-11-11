import {AccessError} from './authorization';

export const rollFields=[
 ['width','عرض لیبل',0.01,Infinity,60],
 ['height','ارتفاع لیبل',0.01,Infinity,30],
 ['rollWidth','عرض کل رول',0.01,Infinity,60],
 ['columns','تعداد لیبل در هر ردیف',1,12,1],
 ['gapX','فاصلهٔ افقی',0,Infinity,2],
 ['gapY','فاصلهٔ عمودی',0,Infinity,2],
 ['left','حاشیهٔ چپ رول',0,Infinity,0],
 ['top','جابه‌جایی چاپ از بالای ردیف',0,Infinity,0],
] as const;
export type RollField=typeof rollFields[number][0];
export type RollLayout=Record<RollField,number>;
export const labelTemplateManager='/api/label-templates?view=manage';
export type LabelTemplate={id:string;name:string;revision:number;roll:RollLayout;layout?:'roll'|'thermal'|'a4'};
export const printEsc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function readRoll(q:URLSearchParams,size={width:60,height:30}):RollLayout{
 const values={} as RollLayout;
 for(const [key,,min,max,fallback] of rollFields){
  const defaultValue=key==='width'||key==='height'?size[key]:fallback;
  const raw=q.get(key)??String(defaultValue),value=Number(raw);
  if(!(key==='columns'?/^\d+$/:/^\d+(?:\.\d{1,2})?$/).test(raw)||!Number.isFinite(value)||value<min||value>max)
   throw new AccessError('اندازهٔ رول، فاصله یا حاشیه معتبر نیست.',400);
  values[key]=value;
 }
 const used=values.left+values.columns*values.width+(values.columns-1)*values.gapX;
 if(!q.has('rollWidth'))values.rollWidth=Number(used.toFixed(2));
 if(!Number.isFinite(used)||!Number.isFinite(values.height+values.gapY)||used-values.rollWidth>0.00001||values.top>values.gapY)
  throw new AccessError('لیبل‌ها باید در عرض رول جا شوند و جابه‌جایی بالا نباید از فاصلهٔ عمودی بیشتر باشد.',400);
 return values;
}

export function rollPitch(roll:RollLayout){return Number((roll.height+roll.gapY).toFixed(2));}
export function rollRows(labels:string[],roll:RollLayout){
 const rows=[];
 for(let i=0;i<labels.length;i+=roll.columns)rows.push('<div class="roll-row">'+labels.slice(i,i+roll.columns).join('')+'</div>');
 return rows.join('');
}
export function rollCss(roll:RollLayout){
 return '.sheet{display:block;width:'+roll.rollWidth+'mm}.roll-row{display:grid;direction:ltr;grid-template-columns:repeat('+roll.columns+','+roll.width+'mm);column-gap:'+roll.gapX+'mm;width:'+roll.rollWidth+'mm;height:'+rollPitch(roll)+'mm;padding-left:'+roll.left+'mm;padding-top:'+roll.top+'mm;break-inside:avoid;background:#ddd}.roll-row:not(:last-child){break-after:page}@media print{.roll-row{background:transparent}}';
}

export function rollInputs(roll:RollLayout,omit:RollField[]=[]){
 return rollFields.filter(([key])=>!omit.includes(key)).map(([key,title,min,max])=>'<label>'+title+(key==='columns'?'':'، میلی‌متر')+'<input name="'+key+'" type="number" step="'+(key==='columns'?1:0.01)+'" min="'+min+'"'+(Number.isFinite(max)?' max="'+max+'"':'')+' value="'+roll[key]+'" required></label>').join('');
}

export function readLabelSize(q:URLSearchParams,size:{width:number;height:number}){
 const dimensions=new URLSearchParams();
 for(const key of ['width','height'])if(q.has(key))dimensions.set(key,q.get(key)!);
 const {width,height}=readRoll(dimensions,size);
 return {width,height};
}

// Scale the complete design uniformly; small labels must not clip their code.
export function labelContentCss(size:{width:number;height:number},design:{width:number;height:number}){
 const scale=Math.min(1,size.width/design.width,size.height/design.height);
 return '.label{position:relative}.label-content{position:absolute;left:50%;top:50%;width:'+design.width+'mm;height:'+design.height+'mm;transform:translate(-50%,-50%) scale('+scale+');transform-origin:center}';
}

export function templatePicker(templates:LabelTemplate[],manageUrl:string,admin:boolean,selected='',canSave=true){
 return '<label>قالب ذخیره‌شدهٔ چاپ<select id="roll-template" name="template"><option value="">تنظیم دستی</option>'+templates.map(t=>'<option value="'+printEsc(t.id)+'" data-layout="'+printEsc(t.layout||'roll')+'" data-roll="'+printEsc(JSON.stringify(t.roll))+'"'+(selected===t.id?' selected':'')+'>'+printEsc(t.name)+'</option>').join('')+'</select></label>'+(canSave?'<label>نام قالب جدید<input id="roll-preset-name" type="text" maxlength="80" style="width:240px;max-width:100%" placeholder="مثلاً پرینتر انبار ـ لیبل ۳۲ در ۱۵"></label><button type="button" id="save-roll-preset">ذخیرهٔ تنظیمات فعلی با نام</button><small>قالب برای کاربران دارای دسترسی چاپ قابل انتخاب است. تنظیمات داخل همین صفحه ذخیره می‌شوند؛ انتخاب پرینتر و تنظیمات پنجرهٔ چاپ مرورگر جداست.</small><p id="roll-preset-feedback" role="status" aria-live="polite"></p>':'<small>ذخیرهٔ قالب مشترک را از بخش اطلاعات شرکت انجام دهید.</small>')+(admin?'<a href="'+printEsc(manageUrl)+'" target="_blank" rel="noopener">مدیریت قالب‌های چاپ</a>':'');
}

export const selectRollScript=String.raw`
const preset=document.getElementById('roll-template');
preset.addEventListener('change',()=>{
 const data=preset.selectedOptions[0]?.dataset.roll;
 if(!data)return;
 layout.value=preset.selectedOptions[0].dataset.layout||'roll';
 updateRoll();
 for(const [key,value] of Object.entries(JSON.parse(data)))form.elements.namedItem(key).value=value;
 form.requestSubmit(document.getElementById('label-preview'));
});
layout.addEventListener('change',()=>{preset.value='';});
for(const key of ['width','height','rollWidth','columns','gapX','gapY','left','top']){
 form.elements.namedItem(key)?.addEventListener('input',()=>{preset.value='';});
}
const savePreset=document.getElementById('save-roll-preset');let pendingPreset=null;
savePreset?.addEventListener('click',async()=>{
 const nameInput=document.getElementById('roll-preset-name'),message=document.getElementById('roll-preset-feedback'),name=nameInput.value.trim();
 if(!name){message.textContent='برای تنظیمات فعلی یک نام وارد کنید.';nameInput.focus();return;}
 if(!form.reportValidity())return;
 const read=key=>Number(form.elements.namedItem(key).value),kind=layout.value;
 const roll=kind==='roll'?Object.fromEntries(['width','height','rollWidth','columns','gapX','gapY','left','top'].map(key=>[key,read(key)])):{width:read('width'),height:read('height'),rollWidth:read('width'),columns:1,gapX:0,gapY:0,left:0,top:0};
 const payload={name,revision:0,roll,layout:kind,confirmed:true},key=JSON.stringify(payload);if(pendingPreset?.key!==key)pendingPreset={key,requestId:crypto.randomUUID()};
 savePreset.disabled=true;message.textContent='در حال ذخیرهٔ قالب…';
 try{
  const response=await fetch('/api/label-templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:pendingPreset.requestId})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'ذخیرهٔ قالب انجام نشد.');
  let option=Array.from(preset.options).find(o=>o.value===data.id);if(!option){option=new Option(data.name,data.id);preset.add(option);}
  option.textContent=data.name;option.dataset.roll=JSON.stringify(data.roll);option.dataset.layout=data.layout||'roll';preset.value=data.id;
  pendingPreset=null;nameInput.value='';message.textContent='قالب «'+data.name+'» ذخیره شد و از فهرست قالب‌های چاپ قابل انتخاب است.';
 }catch(error){message.textContent=error.message;}finally{savePreset.disabled=false;}
});
`;

export function printOnLoad(requested:boolean){
 return requested?"window.addEventListener('load',()=>{const url=new URL(window.location.href);url.searchParams.delete('print');window.history.replaceState(null,'',url);document.fonts.ready.then(()=>window.print());});":"";
}
