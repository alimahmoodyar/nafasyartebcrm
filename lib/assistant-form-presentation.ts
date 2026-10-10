import {personnelKinds} from './personnel-contract';
import {operationDataSchema,visiblePersonnelFields} from './operation-form-fields';
import {fieldTitles,toolFieldTitles,toolModeTitles,baseModeTitles} from './form-vocabulary';
import {toolOptions} from './form-options';
import {serviceForms} from './after-sales-contract';
import {transportForms} from './transport-contract';
import {qmsKinds} from './qms-contract';
export {fieldTitles};
const technical=new Set(['requestId','confirmed','revision','previousVersion','previousRevision','quoteRevision','leadRevision','quoteHash','catalogSnapshot']);
export function fieldTitle(tool:string,key:string,schema?:any):string {
 return schema?.title||toolFieldTitles[tool]?.[key]||fieldTitles[key]||(/[^\x00-\x7F]/.test(key)?key:`فیلد تعریف‌نشده (${key})`);
}
export function optionTitles(tool:string,path:string[]):Record<string,string> {
 const exact=toolOptions[tool]?.[path.join('.')];
 if(path.at(-1)==='mode')return {...baseModeTitles,...exact,...toolModeTitles[tool]};
 if(exact)return exact;
 return {};
}
export function displayedValue(tool:string,path:string[],value:any,schema?:any):any {
 if(typeof value==='boolean')return value?'بله':'خیر';
 return (schema?.enumLabels||optionTitles(tool,path))[String(value)]??value;
}
function contractSchema(fs:any[]):any {
 return {type:'object',properties:Object.fromEntries(fs.map(f=>[f.key,{
  title:f.label,type:f.type==='rows'?'array':f.type==='boolean'?'boolean':['number','integer'].includes(f.type)?'number':'string',
  ...(f.type==='date'?{format:'date'}:{}),...(f.type==='textarea'?{multiline:true}:{}),
  ...(f.type==='money'?{format:'money'}:{}),
  ...(f.options?{enum:f.options.map((o:any)=>Array.isArray(o)?o[0]:o),enumLabels:Object.fromEntries(f.options.map((o:any)=>Array.isArray(o)?o:[o,o]))}:{}),
  ...(f.fields?{items:contractSchema(f.fields)}:{})
 }])),required:fs.filter(f=>!f.optional).map(f=>f.key)};
}
export function generalPresentation(tool:string,args:any,input:any,title:string){
 const schema=JSON.parse(JSON.stringify(input||{type:'object',properties:{}}));
 const dataSchema=operationDataSchema(tool,args.mode);
 if(dataSchema){schema.properties??={};schema.properties.data={...schema.properties.data,...dataSchema};}
 if(tool==='apply_qms_record'&&schema.properties?.data?.properties?.kind){schema.properties.data.properties.kind={type:'string',enum:Object.keys(qmsKinds),enumLabels:Object.fromEntries(Object.entries(qmsKinds).map(([k,v])=>[k,v.title]))};}
 const forms=tool==='after_sales_apply'?serviceForms:tool==='transport_apply'?transportForms:null;
 if(forms?.[args.mode]){
  const target=contractSchema(forms[args.mode]);
  schema.properties??={};schema.properties.data={...schema.properties.data,...target};
 }
 if(tool==='apply_qms_record'&&qmsKinds[args.data?.kind]&&args.mode==='save'){
  schema.properties??={};schema.properties.data??={type:'object'};
  schema.properties.data.properties={...schema.properties.data.properties,values:contractSchema(qmsKinds[args.data.kind].fields.map(f=>({...f,type:f.type==='number'?'text':f.type==='boolean'?'choice':f.type,options:f.type==='boolean'?[['yes','بله'],['no','خیر']]:f.options,optional:!f.required})))};
 }
 function decorate(s:any,value:any,path:string[]=[]){
  if(s.type==='object'||s.properties||value&&typeof value==='object'&&!Array.isArray(value)){
   s.properties={...s.properties};
   for(const key of Object.keys(value||{}))if(!['__proto__','constructor','prototype'].includes(key)&&!s.properties[key])s.properties[key]={};
   for(const [key,f] of Object.entries(s.properties) as [string,any][]){
    f.title=fieldTitle(tool,key,f);
    if(!path.includes('values')&&(['day','date','due','expiry','startDate','needBy','availableOn','validFrom','validUntil','invoiceDay','fxDate','nextDue','sampleDue','deliveryDay','issuedOn','expiresOn','repaymentStart'].includes(key)||(tool==='routine_production_apply'&&key==='effective')))f.format='date';
    if(['notes','body','description','instructions','interest','reason','nextAction','generalSpecs','supplierSpecs','discrepancyResolution'].includes(key))f.multiline=true;
    const p=[...path,key],options=optionTitles(tool,p);if(Object.keys(options).length)f.enumLabels={...options,...f.enumLabels};
    if(technical.has(key)||(!path.length&&key==='id'&&!['update_record','delete_record','update_user','delete_user'].includes(tool))||key==='previous')f.uiHidden=true;
    if(!path.length&&key==='id'&&['update_record','delete_record','update_user','delete_user'].includes(tool))f.uiHidden=false;
    decorate(f,value?.[key],p);
   }
  }
  if(s.items||Array.isArray(value)){
   s.items??={};decorate(s.items,Array.isArray(value)?value.find(v=>v&&typeof v==='object')||value[0]:undefined,[...path,'*']);
   const options=optionTitles(tool,[...path,'*']);if(Object.keys(options).length)s.items.enumLabels=options;
  }
 }
 decorate(schema,args);
 if(tool==='personnel_apply'){
  const visible=visiblePersonnelFields(args);
  if(visible.length)for(const [k,f] of Object.entries(schema.properties||{}) as [string,any][])f.uiHidden=!visible.includes(k)||technical.has(k);
  const props=schema.properties||{};
  const titleLabels:Record<string,string>={employee:'سمت کارمند',shift:'نام شیفت',policy:'عنوان قواعد حقوق',ruling:'عنوان حکم',document:'عنوان سند',period:'عنوان دوره'};
  if(props.recordId&&!args.recordId)props.recordId.uiHidden=true;
  if(args.mode==='request'){
   schema.required=[...new Set([...(schema.required||[]),'kind',...(['advance','loan'].includes(args.kind)?['amount','installments','repaymentStart']:[])])];
   if(props.kind)props.kind.title='نوع درخواست';
  }
  if(props.title&&titleLabels[args.mode])props.title.title=titleLabels[args.mode];
  if(props.start)props.start.title='تاریخ شروع';if(props.end)props.end.title='تاریخ پایان';
  for(const k of ['start','end','effective','deadline'])if(props[k])props[k].format='date';
  if(props.managerId)props.managerId.title=args.mode==='delegate'?'مدیر اصلی':'مدیر مستقیم';
  if(props.memberId)props.memberId.title=args.mode==='delegate'?'جانشین':args.mode==='request'?'متقاضی':'کارمند';
  if(props.amount)props.amount.title=args.mode==='pay'?'مبلغ پرداخت واقعی (ریال)':'مبلغ درخواست (ریال)';
  if(props.day)props.day.title=args.mode==='pay'?'تاریخ پرداخت':'روز کاری';
  if(args.mode==='request'&&personnelKinds[args.kind])return {schema,title:'ثبت درخواست '+personnelKinds[args.kind]};
 }
 const mode=args.mode,modeTitle=toolModeTitles[tool]?.[mode]||optionTitles(tool,['mode'])[mode];
 return {schema,title:modeTitle?title.endsWith(' — '+modeTitle)?title:`${title} — ${modeTitle}`:title};
}
// Presentation only: keep original tool arguments and validation intact.
export const leadFieldTitles:Record<string,string>={title:'نام سرنخ فروش',contactName:'نام فرد رابط',company:'نام شرکت / بیمارستان / مرکز',phone:'شماره تماس',email:'ایمیل',city:'شهر',source:'نحوه آشنایی مشتری',sourceDetail:'توضیح نحوه آشنایی',segment:'حوزه فروش',ownerId:'مسئول پیگیری',agentId:'نماینده یا عامل مرتبط',items:'محصولات موردنیاز',productId:'محصول',quantity:'تعداد موردنیاز',interest:'نیاز مشتری',estimatedAmount:'مبلغ برآوردی (ریال)',expectedDay:'تاریخ احتمالی خرید',competitor:'رقیب یا پیشنهاد جایگزین',decisionMaker:'تصمیم‌گیرنده خرید',tenderDeadline:'مهلت مناقصه',nextAction:'اقدام بعدی پیگیری',nextDue:'موعد پیگیری بعدی',stage:'مرحله فروش',activityType:'نوع ارتباط',day:'تاریخ ارتباط',lossReason:'علت ازدست‌رفتن سرنخ',orderId:'سفارش مرتبط',notes:'توضیحات ثبت / نتیجه پیگیری',leadId:'سرنخ انتخاب‌شده'};
const options:Record<string,Record<string,string>>={source:{phone:'تماس تلفنی',website:'وب‌سایت',exhibition:'نمایشگاه',referral:'معرفی',social:'شبکه اجتماعی',visit:'مراجعه حضوری',other:'سایر'},segment:{home:'خانگی',hospital:'بیمارستانی'},stage:{new:'جدید',contacted:'تماس اولیه',qualified:'نیازسنجی',proposal:'ارائه پیشنهاد',negotiation:'مذاکره',nurture:'فعلاً آماده خرید نیست'},activityType:{call:'تماس تلفنی',meeting:'جلسه',email:'ایمیل',message:'پیام',visit:'مراجعه حضوری'},lossReason:{price:'قیمت',timing:'زمان خرید',competitor:'رقیب',product:'تناسب محصول',no_response:'عدم پاسخ',other:'سایر'}};
const follow=['nextAction','nextDue','notes'];
const modeFields:Record<string,string[]>={save:['title','contactName','company','phone','email','city','source','sourceDetail','segment','ownerId','agentId','items','interest','estimatedAmount','expectedDay','competitor','decisionMaker','tenderDeadline',...follow],stage:['stage',...follow],activity:['activityType','day',...follow],assign:['ownerId',...follow],lose:['lossReason','notes'],reopen:['ownerId',...follow],link_order:['orderId','notes']};
const titles:Record<string,string>={stage:'تغییر مرحله سرنخ فروش',activity:'ثبت تماس و پیگیری سرنخ',assign:'تعیین مسئول پیگیری سرنخ',lose:'ثبت علت ازدست‌رفتن سرنخ',reopen:'بازگشایی سرنخ فروش',link_order:'اتصال سرنخ به سفارش فروش'};
export function formPresentation(tool:string,args:any,input:any,title:string){
 const general=generalPresentation(tool,args,input,title),schema=general.schema;
 if(tool!=='sales_lead_apply')return general;
 const mode=args.mode||'save',visible=modeFields[mode]||modeFields.save,required=mode==='save'?['title','contactName','phone','city','source','segment','ownerId','interest',...follow]:mode==='reopen'?follow:visible;
 const decorate=(s:any)=>{for(const [key,field] of Object.entries(s.properties||{}) as [string,any][]){if(leadFieldTitles[key])field.title=leadFieldTitles[key];if(options[key])field.enumLabels=options[key];if(['expectedDay','tenderDeadline','nextDue','day'].includes(key))field.format='date';if(['interest','nextAction','notes','sourceDetail'].includes(key))field.multiline=true;if(field.items)decorate(field.items);if(field.properties)decorate(field);}};
 decorate(schema);
 schema.properties=Object.fromEntries([...visible,...Object.keys(schema.properties||{}).filter(k=>!visible.includes(k))].filter(k=>schema.properties?.[k]).map(k=>[k,{...schema.properties[k],uiHidden:!visible.includes(k)}]));
 schema.required=[...new Set([...(schema.required||[]),...required])];
 return {schema,title:mode==='save'?(args.leadId?'ویرایش سرنخ فروش':'ایجاد سرنخ فروش'):titles[mode]||'پیگیری سرنخ فروش'};
}
