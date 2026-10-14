import {formPresentation} from './assistant-form-presentation';
import {fields,recordFields,names,type Kind} from './model';
// Shared UI draft contract. Drafts never execute a business operation.
export type OperationChoice={key:string;tool:string;title:string;section:string;args:Record<string,string>};
export type OperationForm={choices?:OperationChoice[];tool:string;section:string;title:string;args:Record<string,any>;schema:any;actionId?:string;state?:string;result?:any;preview?:any;previewError?:string};
const secret=/password|token|secret|cipher|api.?key/i;
export function cleanFormArgs(value:any,depth=0):any{
 if(depth>12)throw new Error('اطلاعات فرم بیش از حد پیچیده است.');
 if(Array.isArray(value))return value.map(v=>cleanFormArgs(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!secret.test(k)&&!['__proto__','constructor','prototype','confirmed'].includes(k)).map(([k,v])=>[k,cleanFormArgs(v,depth+1)]));
 return value;
}
export function operationForm(tool:any,args:any,section:string,title:string):OperationForm{
 if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>16000)throw new Error('اطلاعات فرم معتبر نیست.');
 if(tool.name==='save_material_master'){args={revision:0,code:'',name:'',unit:'عدد',specs:'',fields:[],...args};for(const k of ['defaultLocation','reorderPoint','targetStock','qcOwner','warehouseOwner','procurementOwner'])delete args[k];}
 if(tool.name==='sales_apply'&&args.mode==='agent'&&!args.agentId&&args.active===undefined)args={...args,active:true};
 if(tool.name==='guarantee_apply'&&args.mode==='save'&&!args.guaranteeId&&args.originalLocation===undefined)args={...args,originalLocation:'زونکن اسناد مالی'};
 const schema:any={...tool.inputSchema,properties:Object.fromEntries(Object.entries(tool.inputSchema.properties||{}).filter(([k])=>!secret.test(k)&&k!=='confirmed')),required:(tool.inputSchema.required||[]).filter((k:string)=>!secret.test(k)&&!['confirmed','id','requestId'].includes(k))};
 if(['create_record','update_record'].includes(tool.name)&&fields[args.kind as Kind]){const fs=recordFields(args.kind as Kind,args.data||{}).filter(f=>f.type!=='snapshot');schema.properties.data={type:'object',properties:Object.fromEntries(fs.map(f=>[f.key,{type:'string',title:f.label,...(f.options?{enum:f.options,...(f.optionLabels?{enumLabels:f.optionLabels}:{})}:{})}])),required:fs.filter(f=>f.required).map(f=>f.key)};}
 return {tool:tool.name,section,...formPresentation(tool.name,cleanFormArgs(args),schema,title),args:cleanFormArgs(args)};
}

export function requestsBuyerAssignment(message:string){
 const text=message.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ');
 return /(خریدار|نماینده|نمایندگی|عامل|فروش)/.test(text)&&/(تخصیص|واگذاری?|ارجاع|تعیین\s+(?:کارشناس|مسئول)|(?:تغییر|عوض)\s+(?:کارشناس|مسئول)|(?:کارشناس|مسئول).*?(?:تغییر|عوض))/.test(text)&&!/(لغو|منصرف|تخصیص نده|واگذار نکن|ارجاع نده)/.test(text);
}
// Opening a requested draft must not depend on the model calling a display tool.
export function requestsProductDefinitionForm(message:string){
 const text=message.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ');
 return /(?:فرم|صفحه|کادر|پنجره)\s*(?:تعریف|ایجاد|ثبت)\s*محصول|(?:فرم|صفحه|کادر|پنجره)\s*محصول(?:ات)?\s*جدید/.test(text)&&!/(لغو|منصرف|نساز|ایجاد نکن|ثبت نکن|حذف)/.test(text);
}
export function requestsMaterialDefinitionForm(message:string){
 const text=message.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ');
 return /(?:تعریف|ایجاد|ثبت)\s*(?:کالا|ماده\s+اولیه|مواد\s+اولیه|قطعه|قطعات\s+مصرفی)|(?:فرم|صفحه|کادر|پنجره)\s*(?:کالا|ماده\s+اولیه|مواد\s+اولیه|قطعه)\s*جدید/.test(text)&&!/(لغو|منصرف|نساز|ایجاد نکن|ثبت نکن|حذف)/.test(text);
}
export function requestsFormDisplay(message:string){
 const text=message.replace(/\u200c/g,' ');
 return (/(فرم|صفحه|کادر|پنجره)/.test(text)||requestsMaterialDefinitionForm(message))&&/(بیار|بیاور|باز کن|باز بکن|باز کنید|نمایش|نشان)/.test(text)&&!/(?:ثبت|ذخیره|اجرا|تکمیل|ویرایش|حذف|تأیید|تایید)\s*(?:کن|بکن|کنید)|تأیید اجرا|تایید اجرا/.test(text);
}
export function requestedOperationForm(message:string,previous:any,available:any[]):OperationForm|undefined{
 const text=message.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/\u200c/g,' ');
 if(requestsMaterialDefinitionForm(message)){
  const tool=available.find(t=>t.name==='save_material_master'&&t.write);if(!tool)return;
  const same=previous?.tool===tool.name&&!previous.actionId&&!previous.state&&!previous.args?.revision&&!/(جدید|از اول|خالی)/.test(text);
  return operationForm(tool,same?previous.args:{revision:0},'flow','تعریف کالا');
 }
 if(requestsProductDefinitionForm(message)){
  const tool=available.find(t=>t.name==='create_record'&&t.write&&t.inputSchema.properties?.kind?.enum?.includes('product'));
  if(!tool)return;
  const same=previous?.tool===tool.name&&previous.args?.kind==='product'&&!/(جدید|از اول|خالی)/.test(text);
  const form=operationForm(tool,same?previous.args:{kind:'product',data:{}},'product','تعریف محصول');
  form.schema.properties.kind={...form.schema.properties.kind,enum:['product'],readOnly:true,uiHidden:true};
  return form;
 }
 if(requestsBuyerAssignment(message)){const tool=available.find(t=>t.name==='assign_sales_buyer'&&t.write);return tool?operationForm(tool,previous?.tool===tool.name?previous.args:{},'sales','تخصیص خریدار به کارشناس'):undefined;}
 const cancelled=/(حذف|لغو|ثبت نکن|منصرف|نساز|ایجاد نکن)/.test(text);
 const homeProduction=/(خانگی|روتین)/.test(text)&&/(سفارش|درخواست|فرم).*(تولید|ساخت)|(تولید|ساخت).*(سفارش|درخواست|فرم)/.test(text)&&!cancelled;
 if(homeProduction){const tool=available.find(t=>t.name==='sales_apply'&&t.write);if(tool)return operationForm(tool,previous?.tool===tool.name&&previous.args?.mode==='order'?previous.args:{mode:'order',items:[]},'sales','ثبت سفارش فروش');}
 const buildIntake=/(فرم\s+(?:سفارش\s+)?ساخت|مشخصات\s+(?:سفارش|ساخت|مشتری)|سفارش\s+ساخت|درخواست\s+(?:ساخت|تولید).*بیمارستان|بیمارستان.*درخواست\s+(?:ساخت|تولید))/.test(text)&&/(فرم|جدید|ایجاد|تعریف|ثبت|بساز|باز|بیار|نمایش|سفارش|درخواست)/.test(text)&&!cancelled;
 if(buildIntake){const tool=available.find(t=>t.name==='build_intake_apply'&&t.write);if(tool)return operationForm(tool,previous?.tool===tool.name&&previous.args?.mode==='save'?previous.args:{mode:'save',revision:0,items:[]},'build-intake','فرم سفارش ساخت بیمارستانی');}
 const salesTemplate=/(الگو.*فروش|شرایط\s+عمومی\s+فروش|پروموشن)/.test(text)&&/(جدید|ایجاد|تعریف|ثبت|بساز|باز|بیار|نمایش)/.test(text)&&!/(حذف|لغو|ثبت نکن|منصرف)/.test(text);
 if(salesTemplate){const tool=available.find(t=>t.name==='sales_network_apply'&&t.write);if(tool){const args=previous?.tool===tool.name&&previous.args?.mode==='template'?previous.args:{mode:'template',data:{templateType:'fixed',productPrices:[]}};return operationForm(tool,args,'sales','الگوی عمومی فروش');}}
 const sale=/(بفروش|فروخت|سفارش\s+(?:فروش|مشتری|نماینده)|فروش\s+(?:دستگاه|محصول|کالا))/.test(text)&&!/(حذف|لغو|ثبت نکن|منصرف)/.test(text);
 if(sale){const tool=available.find(t=>t.name==='sales_apply'&&t.write);if(tool){const args=previous?.tool===tool.name&&previous.args?.mode==='order'?previous.args:{mode:'order',items:[]};return operationForm(tool,args,'sales','ثبت سفارش فروش');}}
 const representative=/(نماینده|نمایندگی|عامل فروش)/.test(text)&&/(جدید|ایجاد|بساز|ساخت|تعریف|ثبت)/.test(text)&&!/(حذف|پاک|نساز|ایجاد نکن|ثبت نکن)/.test(text)&&!/(گیرنده|مقصد|ارسال کالا)/.test(text);
 if(representative&&!/خدمات/.test(text)){const tool=available.find(t=>t.name==='sales_apply'&&t.write);if(!tool)return;const args=previous?.tool===tool.name&&previous.args?.mode==='agent'&&!previous.args.agentId?previous.args:{mode:'agent',agentId:'',kind:'representative'};return operationForm(tool,args,'sales','ثبت پرونده نماینده فروش');}
 const createUser=/(کاربر|حساب کاربری|اکانت)/.test(text)&&/(جدید|ایجاد|بساز|ساخت|تعریف)/.test(text)&&!/(حذف|پاک|نساز|ایجاد نکن)/.test(text);
 const reopen=/(فرم)/.test(text)&&/(باز|بیار|بیاور|نمایش|نشان)/.test(text);
 const continuing=!!previous?.tool&&!previous.actionId&&!previous.state&&(!/(جدید|ایجاد|بساز|تعریف|عملیات دیگر|فرم دیگر)/.test(text)||reopen)&&!/(لغو|بیخیال|بی خیال|ببند|منصرف|تمام شد)/.test(text);
 const name=createUser?'create_password_user':reopen||continuing?previous?.tool:undefined;
 const tool=available.find(t=>t.name===name&&t.write);
 if(!tool)return;
 const args=(!createUser||reopen)&&previous?.tool===name&&previous.args&&typeof previous.args==='object'?previous.args:{};
 return operationForm(tool,args,createUser?'users':previous.section||'',createUser?'ایجاد کاربر جدید':'فرم عملیات');
}

export function requestsOperation(message:string){
 const text=message.replace(/ي/g,'ی').replace(/ك/g,'ک');
 return /فرم|ثبت|ایجاد|بساز|تعریف|ویرایش|اصلاح|حذف|تنظیم|ارجاع|تحویل|درخواست|تأیید|تایید|تمدید|بستن|تخصیص|رزرو|انتقال|تولید|صدور|پرداخت|مرخصی|مساعده|یادآور|یاداوری|یادآوری|ریمایندر|مأموریت|ماموریت|پذیرش|بفروش|سفارش/.test(text)&&!/(ثبت نکن|ایجاد نکن|نساز|حذف نکن|لغو کن|منصرف شدم)/.test(text);
}
export function operationChoices(available:any[],sectionFor:(tool:string,args:any)=>string,canOpen:(section:string)=>boolean,titles:Record<string,string>):OperationChoice[]{
 const choices:OperationChoice[]=[];
 for(const t of available.filter(t=>t.write)){
  const modes=t.inputSchema.properties?.mode?.enum||[undefined];
  const kinds=['create_record','update_record','delete_record'].includes(t.name)?t.inputSchema.properties?.kind?.enum||[undefined]:[undefined];
  for(const mode of modes)for(const kind of kinds){
   if(t.name==='sales_network_apply'&&mode==='assign')continue;
   const args:Record<string,string>={...(mode?{mode}:{}),...(kind?{kind}:{})},section=sectionFor(t.name,args);
   if(!canOpen(section))continue;
   const title=[operationForm(t,args,section,titles[t.name]||t.name).title,kind?names[kind as Kind]||kind:''].filter(Boolean).join(' — ');
   choices.push({key:JSON.stringify([t.name,mode||'',kind||'']),tool:t.name,title,section,args});
  }
 }
 return choices;
}
export function operationPicker(choices:OperationChoice[],section:string):OperationForm{
 return {tool:'',section,title:'انتخاب فرم عملیات',args:{},schema:{type:'object',properties:{}},choices};
}

export function matchedOperationForm(message:string,choices:OperationChoice[],available:any[]):OperationForm|undefined{
 const norm=(s:string)=>s.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c؟،.ـ—-]/g,'');
 const text=norm(message),matched=choices.filter(c=>text.includes(norm(c.title)));
 if(matched.length!==1)return;
 const choice=matched[0],tool=available.find(t=>t.name===choice.tool);
 return tool?operationForm(tool,choice.args,choice.section,choice.title):undefined;
}
