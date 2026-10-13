import {partRepairForms,partRepairActions,visiblePartRepairFields} from './part-repair-contract';
import {personnelKinds} from './personnel-contract';
import {operationDataSchema,visiblePersonnelFields} from './operation-form-fields';
import {fieldTitles,toolFieldTitles,toolModeTitles,baseModeTitles} from './form-vocabulary';
import {toolOptions} from './form-options';
import {serviceForms,visibleServiceFields} from './after-sales-contract';
import {transportForms} from './transport-contract';
import {qmsKinds} from './qms-contract';
export {fieldTitles};
const technical=new Set(['requestId','confirmed','revision','contactRevision','previousVersion','previousRevision','quoteRevision','leadRevision','quoteHash','catalogSnapshot','customerTariffId','customerTariffRevision','customerPriceSource']);
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
 const forms=tool==='part_repair_apply'?partRepairForms:tool==='after_sales_apply'?serviceForms:tool==='transport_apply'?transportForms:null;
 if(forms?.[args.mode]){
  const target=contractSchema(tool==='part_repair_apply'?visiblePartRepairFields(args.mode,args.data||{}):tool==='after_sales_apply'?visibleServiceFields(args.mode,args.data||{}):forms[args.mode]);
  if(tool==='part_repair_apply'){for(const key of Object.keys(args.data||{}))if(!target.properties[key])target.properties[key]={uiHidden:true};if(target.properties.repairId&&args.data?.repairId)target.properties.repairId.uiHidden=true;}
  if(tool==='after_sales_apply'&&args.mode==='tariff'&&args.data?.kind==='labor')for(const key of ['partCode','consumerPriceRial'])target.properties[key]={uiHidden:true};
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
 if(tool==='confirm_pricing_cost_basis'){
  for(const key of ['sourceToken',...(args.method==='standard'?['unitCost']:[])])if(schema.properties?.[key])schema.properties[key].uiHidden=true;
  if(args.method==='documented')schema.required=[...new Set([...(schema.required||[]),'unitCost'])];
 }
 if(tool==='save_pricing_profit_policy'){
  const hidden=args.scope==='group'?'productId':'group',needed=args.scope==='group'?'group':'productId';if(schema.properties?.[hidden])schema.properties[hidden].uiHidden=true;
  schema.required=[...new Set([...(schema.required||[]),needed])];
 }
 if(tool==='approve_pricing_proposal'){if(schema.properties?.token)schema.properties.token.uiHidden=true;if(schema.properties?.effectiveFrom)schema.properties.effectiveFrom.format='date';}
 if(tool==='sales_network_apply'&&args.mode==='template'){
  // Hide retired fields even when a legacy template draft still carries them.
  const promotion=args.data?.templateType==='promotion';
  for(const node of [schema,schema.properties?.data])if(node){
   const hidden=['notes','months','maxMonths','minMonths','maxCashBps','effectiveTo','previousId',...(!promotion?['durationDays']:[])];
   for(const key of hidden)if(node.properties?.[key])node.properties[key].uiHidden=true;
   if(Array.isArray(node.required))node.required=node.required.filter((key:string)=>!hidden.includes(key));
  }
  const data=schema.properties?.data;if(data){data.required=[...new Set([...(data.required||[]),'effectiveFrom','productPrices','days','maxDays',...(promotion?['durationDays']:[])])];data.title='شرایط الگو';data.properties.kind.title='الگو برای';data.properties.title.title='عنوان الگو';}
  return {schema,title:'الگوی عمومی فروش'};
 }
 if(tool==='sales_apply'&&schema.properties?.requestSource){
  const source=schema.properties.requestSource;source.required=['channel','day',...(args.mode==='order'?[]:['contactName'])];
  if(args.mode==='order'&&source.properties?.contactName)source.properties.contactName.uiHidden=true;
 }
 if(tool==='sales_apply'&&args.mode==='payment'){
  const visible=new Set(['agentId','method','amount','day','reference','fileId','notes',...(args.method!=='cash'?['bank']:[]),...(args.method==='check'?['checkDue']:[]),...(args.cashOrderId?['cashOrderId']:[]),...(args.checkInvoiceId?['checkInvoiceId']:[])]);
  for(const [key,f] of Object.entries(schema.properties||{}) as [string,any][])f.uiHidden=!visible.has(key);
  if(schema.properties.agentId)schema.properties.agentId.title='خریدار';
  if(schema.properties.reference)schema.properties.reference.title=args.method==='check'?'شناسهٔ چک':'شماره پیگیری / رسید';
  schema.required=['agentId','method','amount','day','reference',...(args.method!=='cash'?['bank','fileId']:[]),...(args.method==='check'?['checkDue']:[])];
  return {schema,title:'اعلام پرداخت خریدار'};
 }
 if(tool==='sales_apply'&&args.mode==='order'){
  const visible=new Set(['agentId','items','requestSource','customerReference','notes']);
  for(const [key,f] of Object.entries(schema.properties||{}) as [string,any][])f.uiHidden=!visible.has(key);
  if(schema.properties.items){schema.properties.items.items.properties=Object.fromEntries(Object.entries(schema.properties.items.items.properties||{}).filter(([key])=>['productId','quantity'].includes(key)));schema.properties.items.items.required=['productId','quantity'];}
  schema.required=['agentId','items'];
  return {schema,title:'ثبت سفارش فروش'};
 }
 if(tool==='sales_apply'&&args.mode==='agent'){
  const visible=new Set(['mode','agentId','kind','name','contact','nationalId','mobile','phone','address','active','province','city','salesRepresentation','serviceRepresentation','serviceDomain','linkedServiceAgentId','linkedServiceRevision','serviceCode']);
  for(const [key,f] of Object.entries(schema.properties||{}) as [string,any][])f.uiHidden=!visible.has(key)||f.uiHidden;
  if(schema.properties?.mode)schema.properties.mode.uiHidden=true;
  if(!args.agentId&&schema.properties?.agentId)schema.properties.agentId.uiHidden=true;
  if(schema.properties?.kind)schema.properties.kind.title='نوع خریدار';
  if(schema.properties?.active)schema.properties.active.title='پرونده نماینده فعال است';
  if(schema.properties?.phone)schema.properties.phone.title='شماره ثابت (اختیاری)';
  if(schema.properties?.contact)schema.properties.contact.title='نام مسئول تماس (اختیاری)';
  schema.required=(schema.required||[]).filter((k:string)=>!['province','city','contractRef','ownerId','financeId','managerId','creditLimit','termDays','agentId','mode'].includes(k));
  return {schema,title:'ایجاد پرونده نماینده فروش'};
 }
 if(tool==='guarantee_apply'){if(schema.properties?.kind){schema.properties.kind.enum=[...(schema.properties.kind.enum||[]).filter((v:string)=>v!=='customs'),'customs'];schema.properties.kind.enumLabels={...schema.properties.kind.enumLabels,customs:'ضمانت‌نامه گمرکی'};}if(schema.properties?.contract)schema.properties.contract.title=args.kind==='customs'?'شماره ثبت سفارش':'شماره قرارداد یا شماره مناقصه';for(const key of ['applicant','collateral','actionDeadline']){if(schema.properties?.[key])schema.properties[key].uiHidden=true;}schema.required=(schema.required||[]).filter((key:string)=>!['applicant','collateral','actionDeadline','originalLocation'].includes(key));}
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
 if(tool==='setup_personnel_profile')return {schema,title:'ایجاد پرونده پایه پرسنلی'};
 if(tool==='save_sales_recipient'){if(schema.properties?.partyId&&!args.partyId)schema.properties.partyId.uiHidden=true;schema.required=(schema.required||[]).filter((k:string)=>k!=='partyId');return {schema,title:args.partyId?'ویرایش مقصد تحویل کالا':'ثبت مقصد تحویل کالا'};}
 if(tool==='part_repair_apply')return {schema,title:partRepairActions[args.mode]||'قطعات تعمیری نمایندگان'};
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
