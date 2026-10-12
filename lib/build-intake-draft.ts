import type {Session} from './permissions';
import {buildIntakeRead} from './build-intake';
import type {OperationForm} from './assistant-workspace';
import type {QField} from './qms-contract';

const clone=(v:any)=>JSON.parse(JSON.stringify(v));
const select=(rows:any[],key:string,label:(r:any)=>string)=>({type:'string',enum:rows.map(r=>r[key]),enumLabels:Object.fromEntries(rows.map(r=>[r[key],label(r)])),readOnly:false});
const norm=(v:any)=>String(v||'').normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
function valuesSchema(fields:QField[]){
 return {type:'object',title:'مشخصات موردنیاز مشتری',additionalProperties:false,properties:Object.fromEntries(fields.map(f=>[f.key,{type:'string',title:f.label,...(f.type==='date'?{format:'date'}:{}),...(f.type==='choice'?{enum:f.options,enumLabels:Object.fromEntries((f.options||[]).map(v=>[v,v]))}:{}),...(f.type==='boolean'?{enum:['yes','no'],enumLabels:{yes:'بله',no:'خیر'}}:{})}])),required:fields.filter(f=>f.required).map(f=>f.key)};
}

// Reading a catalog and publishing an approved schema never creates an intake,
// a project, or a QMS response. Only explicit answers survive template changes.
export async function hydrateBuildIntakeForm(user:Session,form:OperationForm):Promise<OperationForm>{
 if(form.tool!=='build_intake_apply'||form.actionId||form.state)return form;
 const schema=clone(form.schema),args=clone(form.args),properties=schema.properties||{};
 try{
  const catalog=await buildIntakeRead(user);
  const orders=catalog.orders.filter((o:any)=>o.items.some((i:any)=>i.productionMode==='project'));
  properties.intakeId={...properties.intakeId,...select(catalog.intakes,'id',r=>r.data.title||r.id),title:'پرونده سفارش ساخت'};
  const current=catalog.intakes.find((r:any)=>r.id===args.intakeId);
  if(current&&args.revision===undefined){
   args.revision=current.revision;
   if(args.mode==='save')for(const key of ['title','orderId','contractId','due','items','fileIds','notes'])if(args[key]===undefined)args[key]=clone(current.data[key]??(key==='items'||key==='fileIds'?[]:''));
  }
  if(args.mode!=='save'){
   for(const [key,node] of Object.entries(properties) as [string,any][])node.uiHidden=!['mode','intakeId','notes','revision','id'].includes(key);
   return {...form,args,schema:{...schema,properties},previewError:args.intakeId&&!current?'پرونده سفارش ساخت در دسترسی شما نیست.':undefined};
  }
  args.revision??=0;args.items=Array.isArray(args.items)?args.items:[];
  args.items=args.items.map((item:any)=>Object.fromEntries(['id','lineIndex','productId','quantity','templateId','values'].filter(key=>Object.hasOwn(item||{},key)).map(key=>[key,item[key]])));
  if(!args.intakeId&&properties.intakeId)properties.intakeId.uiHidden=true;
  const order=orders.find((o:any)=>o.id===args.orderId),lines=(order?.items||[]).filter((i:any)=>i.productionMode==='project');
  const contracts=catalog.contracts.filter((c:any)=>order&&(c.agentId===order.agentId||!c.agentId&&norm(c.party)===norm(order.customer)));
  properties.orderId={...properties.orderId,...select(orders,'id',r=>[r.code,r.customer].filter(Boolean).join(' · '))};
  properties.contractId={...properties.contractId,...select(contracts,'id',r=>[r.number,r.title].filter(Boolean).join(' · '))};
  const identityLocked=!!current?.data.projectId;
  if(identityLocked){properties.orderId.readOnly=true;properties.contractId.readOnly=true;}
  const baseItem=clone(properties.items?.items||{type:'object',properties:{}});
  const itemSchema=(item:any)=>{
   const p={...(baseItem.properties||{})};
   p.id={...p.id,uiHidden:true};
   p.lineIndex={type:'integer',title:'ردیف محصول در پیش‌فاکتور',enum:lines.map((l:any)=>l.lineIndex),enumLabels:Object.fromEntries(lines.map((l:any)=>[l.lineIndex,`${l.lineIndex+1} · ${l.productName} · ${l.quantity} عدد`])),readOnly:false};
   p.productId={...p.productId,...select(lines,'productId',r=>r.productName),title:'محصول'};
   let line=lines.find((l:any)=>l.lineIndex===item.lineIndex&&(!item.productId||l.productId===item.productId));
   if(line&&!item.productId)item.productId=line.productId;
   if(!line&&item.productId&&item.lineIndex===undefined){const matches=lines.filter((l:any)=>l.productId===item.productId);if(matches.length===1){line=matches[0];item.lineIndex=line.lineIndex;}}
   const templates=order&&line?catalog.templates.filter((t:any)=>t.productId===line.productId):[];
   const template=templates.find((t:any)=>t.id===item.templateId);
   p.templateId={...p.templateId,...select(templates,'id',r=>`${r.title} · نسخه ${r.version}`),title:'فرم مصوب مشخصات محصول'};
   p.quantity={...p.quantity,title:'تعداد موردنیاز این سفارش ساخت'};
   if(identityLocked)for(const key of ['lineIndex','productId','quantity'])p[key].readOnly=true;
   p.values=valuesSchema(template?.fields||[]);
   item.values=Object.fromEntries((template?.fields||[]).filter((f:QField)=>Object.hasOwn(item.values||{},f.key)).map((f:QField)=>[f.key,item.values[f.key]]));
   item.id??=crypto.randomUUID();
   return {...baseItem,properties:p,required:['lineIndex','productId','quantity','templateId','values']};
  };
  const prefixItems=args.items.map((item:any)=>itemSchema(item));
  properties.items={...properties.items,items:itemSchema({}),prefixItems,readOnly:identityLocked};
  for(const key of ['notes','fileIds'])if(properties[key])properties[key].uiHidden=false;
  schema.required=[...new Set([...(schema.required||[]),'title','orderId','due','items'])];
  const invalid=args.orderId&&!order||args.contractId&&!contracts.some((c:any)=>c.id===args.contractId)||args.items.some((i:any)=>i.productId&&!lines.some((l:any)=>l.productId===i.productId&&l.lineIndex===i.lineIndex)||i.templateId&&!catalog.templates.some((t:any)=>t.id===i.templateId&&t.productId===i.productId));
  const missingTemplate=args.items.some((i:any)=>i.productId&&!catalog.templates.some((t:any)=>t.productId===i.productId));
  return {...form,args,schema:{...schema,properties},preview:undefined,previewError:invalid?'سفارش، قرارداد، محصول و فرم مشخصات باید از گزینه‌های مجاز همین پرونده انتخاب شوند.':missingTemplate?'برای این محصول هنوز فرم عمومی مصوب مشخصات سفارش منتشر نشده است.':undefined};
 }catch(e){
  // A forbidden or unavailable catalog must not keep stale selectable choices.
  for(const key of ['orderId','contractId','intakeId'])properties[key]={...properties[key],enum:[],enumLabels:{},readOnly:true};
  if(properties.items)properties.items={...properties.items,uiHidden:true,items:{type:'object',properties:{},additionalProperties:false},prefixItems:[]};
  return {...form,args:{...args,items:[]},schema:{...schema,properties},preview:undefined,previewError:(e as Error).message};
 }
}
