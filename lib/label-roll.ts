import {AccessError} from './authorization';

export const rollFields=[
 ['width','عرض لیبل',18,150,60],
 ['height','ارتفاع لیبل',12,160,30],
 ['rollWidth','عرض کل رول',35,330,60],
 ['columns','تعداد لیبل در هر ردیف',1,12,1],
 ['gapX','فاصلهٔ افقی',0,30,2],
 ['gapY','فاصلهٔ عمودی',0,30,2],
 ['left','حاشیهٔ چپ رول',0,30,0],
 ['top','جابه‌جایی چاپ از بالای ردیف',0,30,0],
] as const;
export type RollField=typeof rollFields[number][0];
export type RollLayout=Record<RollField,number>;
export const labelTemplateManager='/api/label-templates?view=manage';
export type LabelTemplate={id:string;name:string;revision:number;roll:RollLayout};
export const printEsc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function readRoll(q:URLSearchParams,size={width:60,height:30}):RollLayout{
 const values={} as RollLayout;
 for(const [key,,min,max,fallback] of rollFields){
  const defaultValue=key==='width'||key==='height'?size[key]:fallback;
  const raw=q.get(key)??String(defaultValue),value=Number(raw);
  if(!(key==='columns'?/^\d+$/:/^\d+(?:\.\d{1,2})?$/).test(raw)||value<min||value>max)
   throw new AccessError('اندازهٔ رول، فاصله یا حاشیه معتبر نیست.',400);
  values[key]=value;
 }
 const used=values.left+values.columns*values.width+(values.columns-1)*values.gapX;
 if(!q.has('rollWidth'))values.rollWidth=Math.max(35,Math.ceil(used*100-0.00001)/100);
 if(values.rollWidth>330||used-values.rollWidth>0.00001||values.top>values.gapY)
  throw new AccessError('لیبل‌ها باید در عرض رول جا شوند و جابه‌جایی بالا نباید از فاصلهٔ عمودی بیشتر باشد.',400);
 return values;
}

export function rollPitch(roll:RollLayout){return Math.round((roll.height+roll.gapY)*100)/100;}
export function rollRows(labels:string[],roll:RollLayout){
 const rows=[];
 for(let i=0;i<labels.length;i+=roll.columns)rows.push('<div class="roll-row">'+labels.slice(i,i+roll.columns).join('')+'</div>');
 return rows.join('');
}
export function rollCss(roll:RollLayout){
 return '.sheet{display:block;width:'+roll.rollWidth+'mm}.roll-row{display:grid;direction:ltr;grid-template-columns:repeat('+roll.columns+','+roll.width+'mm);column-gap:'+roll.gapX+'mm;width:'+roll.rollWidth+'mm;height:'+rollPitch(roll)+'mm;padding-left:'+roll.left+'mm;padding-top:'+roll.top+'mm;break-inside:avoid;background:#ddd}.roll-row:not(:last-child){break-after:page}@media print{.roll-row{background:transparent}}';
}

export function rollInputs(roll:RollLayout,omit:RollField[]=[]){
 return rollFields.filter(([key])=>!omit.includes(key)).map(([key,title,min,max])=>'<label>'+title+(key==='columns'?'':'، میلی‌متر')+'<input name="'+key+'" type="number" step="'+(key==='columns'?1:0.01)+'" min="'+min+'" max="'+max+'" value="'+roll[key]+'" required></label>').join('');
}

export function templatePicker(templates:LabelTemplate[],manageUrl:string,admin:boolean,selected=''){
 return '<label>قالب ذخیره‌شدهٔ رول<select id="roll-template" name="template"><option value="">تنظیم دستی</option>'+templates.map(t=>'<option value="'+printEsc(t.id)+'" data-roll="'+printEsc(JSON.stringify(t.roll))+'"'+(selected===t.id?' selected':'')+'>'+printEsc(t.name)+'</option>').join('')+'</select></label>'+(admin?'<a href="'+printEsc(manageUrl)+'" target="_blank" rel="noopener">مدیریت قالب‌های چاپ</a>':'');
}

export const selectRollScript=String.raw`
const preset=document.getElementById('roll-template');
preset.addEventListener('change',()=>{
 const data=preset.selectedOptions[0]?.dataset.roll;
 if(!data)return;
 layout.value='roll';
 updateRoll();
 for(const [key,value] of Object.entries(JSON.parse(data)))form.elements.namedItem(key).value=value;
 form.requestSubmit(document.getElementById('label-preview'));
});
layout.addEventListener('change',()=>{if(layout.value!=='roll')preset.value='';});
for(const key of ['width','height','rollWidth','columns','gapX','gapY','left','top']){
 form.elements.namedItem(key)?.addEventListener('input',()=>{preset.value='';});
}
`;

export function printOnLoad(requested:boolean){
 return requested?"window.addEventListener('load',()=>{const url=new URL(window.location.href);url.searchParams.delete('print');window.history.replaceState(null,'',url);document.fonts.ready.then(()=>window.print());});":"";
}
