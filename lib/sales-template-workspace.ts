import type {Session} from './permissions';
import {storage} from './storage';
import {networkActor} from './sales-network';
import {salesManager} from './sales-access';
import {salesRows,salesBasePrice,salesFail,stxt} from './sales';
import {dayAt} from './duties';
import {partnerKinds} from './sales-network-contract';
import {rial} from './sales-contract';
import {salesTemplateType,salesTemplateStatus,selectSalesTemplate,selectFixedSalesTemplate,salesTemplateAppliesTo,promotionEndDay,type SalesTemplateType,type SalesTemplateStatus} from './sales-template';
import {salesPaymentDays,salesPaymentMaxDays} from './sales-payment-terms';
import {isIsoDay,latinDigits,formatDate} from './persian-date';

export const salesTemplateKinds={representative:partnerKinds.representative,reseller:partnerKinds.reseller,branch:partnerKinds.branch,end_customer:partnerKinds.end_customer};
export const salesTemplateWorkspaceStatuses={active:'در حال اجرا',scheduled:'شروع در آینده',expired:'پایان‌یافته',previous:'نسخه قبلی'};
export const salesTemplateWorkspaceTypes={fixed:'الگوی ثابت',promotion:'پروموشن'};
export type SalesTemplateWorkspaceFilters={kind:string;product:string;search:string;type:string;status:string};
export type SalesTemplateKind=keyof typeof salesTemplateKinds;
export type SalesTemplateProduct={id:string;name:string;code:string;model:string;status:string};
export type SalesTemplateDiagnostic={code:string;message:string};
export type SalesTemplatePriceSource='cost_approved'|'sales_template'|'sales_price'|null;
export type SalesTemplateProductPrice={productId:string;name:string;code:string;model:string;unitPrice:string|null;unitNet:string|null};
export type SalesTemplateSummary={id:string;revision:number;kind:SalesTemplateKind;title:string;version:number|null;templateType:SalesTemplateType;status:SalesTemplateStatus|'previous';temporalStatus:SalesTemplateStatus;isSelected:boolean;isFixedBaseline:boolean;selectedProductIds?:string[];fixedBaselineProductIds?:string[];effectiveFrom:string|null;effectiveTo:string|null;durationDays:number|null;discountBps:number|null;cashBps:number|null;minCashBps:number|null;days:number|null;maxDays:number|null;productPrices:SalesTemplateProductPrice[]};
export type SalesTemplateCurrentPrice={kind:SalesTemplateKind;productId:string;name:string;code:string;model:string;productStatus:string;unitPrice:string|null;discountBps:number|null;unitNet:string|null;source:SalesTemplatePriceSource;sourceId:string|null;templateId:string|null;templateTitle:string|null;termsTemplateId:string|null;termsTemplateTitle:string|null;canQuote:boolean;diagnostics:SalesTemplateDiagnostic[]};
export type SalesTemplateWorkspace={today:string;kinds:typeof salesTemplateKinds;products:SalesTemplateProduct[];filters:SalesTemplateWorkspaceFilters;templates:SalesTemplateSummary[];prices:SalesTemplateCurrentPrice[];summary:{totalTemplates:number;filteredTemplates:number;totalPrices:number;availablePrices:number;blockedPrices:number};notes:string};
const normalize=(value:unknown)=>latinDigits(String(value??'')).normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('fa');
const match=(search:string,values:unknown[])=>!search||normalize(values.join(' ')).includes(normalize(search));
const integerOrNull=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
const discount=(data:any)=>integerOrNull(data?.discountBps??0,0,9000);
const price=(value:unknown):string|null=>typeof value==='string'&&/^\d{1,18}$/.test(value)&&BigInt(value)>BigInt(0)?BigInt(value).toString():null;
const net=(amount:string|null,bps:number|null)=>amount!==null&&bps!==null?String(BigInt(amount)*BigInt(10000-bps)/BigInt(10000)):null;
const safeDays=(data:any,today:string,max=false):number|null=>{try{const value=max?salesPaymentMaxDays(data,today):salesPaymentDays(data,today);return Number.isSafeInteger(value)&&value>=0?value:null;}catch{return null;}};
function filterValues(raw:Partial<SalesTemplateWorkspaceFilters>):SalesTemplateWorkspaceFilters {
 const read=(key:keyof SalesTemplateWorkspaceFilters,max=200)=>stxt(raw[key]??'',max);
 const filters={kind:read('kind',40),product:read('product'),search:read('search'),type:read('type',30),status:read('status',30)};
 if(filters.kind&&!Object.hasOwn(salesTemplateKinds,filters.kind))salesFail('نوع خریدار فیلتر معتبر نیست.');
 if(filters.type&&!Object.hasOwn(salesTemplateWorkspaceTypes,filters.type))salesFail('نوع الگوی فیلتر معتبر نیست.');
 if(filters.status&&!Object.hasOwn(salesTemplateWorkspaceStatuses,filters.status))salesFail('وضعیت الگوی فیلتر معتبر نیست.');
 return filters;
}
function templateState(row:any,rows:any[],today:string,productIds:string[]){
 const applicable=productIds.filter(id=>salesTemplateAppliesTo(row,id)),temporalStatus=salesTemplateStatus(row,today);
 const selectedProductIds=applicable.filter(id=>selectSalesTemplate(rows,row.data.kind,today,id)?.id===row.id),fixedBaselineProductIds=applicable.filter(id=>selectFixedSalesTemplate(rows,row.data.kind,today,id)?.id===row.id),isSelected=!!selectedProductIds.length,isFixedBaseline=!!fixedBaselineProductIds.length;
 return {temporalStatus,isSelected,isFixedBaseline,selectedProductIds,fixedBaselineProductIds,status:temporalStatus==='active'?(isSelected?'active' as const:'previous' as const):temporalStatus};
}
function absenceDiagnostics(rows:any[],kind:string,product:SalesTemplateProduct,today:string,template:any):SalesTemplateDiagnostic[]{
 if(template)return [];
 const byKind=rows.filter(row=>row.type==='sales_template'&&row.data.kind===kind&&salesTemplateAppliesTo(row,product.id)),upcoming=byKind.filter(row=>isIsoDay(row.data.effectiveFrom)&&row.data.effectiveFrom>today).sort((a,b)=>a.data.effectiveFrom.localeCompare(b.data.effectiveFrom));
 const result:SalesTemplateDiagnostic[]=[{code:'no_active_template',message:'الگوی قابل اجرا برای «'+product.name+'» و نوع خریدار «'+salesTemplateKinds[kind as keyof typeof salesTemplateKinds]+'» در تاریخ امروز وجود ندارد.'}];
 if(upcoming[0])result.push({code:'future_template',message:'شروع الگوی این نوع خریدار از '+formatDate(upcoming[0].data.effectiveFrom)+' است.'});
 else if(byKind.some(row=>salesTemplateType(row)==='promotion'&&salesTemplateStatus(row,today)==='expired'))result.push({code:'expired_promotion',message:'پروموشن این نوع خریدار پایان یافته و الگوی ثابت معتبر جایگزین ندارد.'});
 else if(byKind.length)result.push({code:'invalid_template',message:'تاریخ یا دوره الگوی ذخیره‌شده معتبر نیست؛ نسخه را بررسی کنید.'});
 if(rows.some(row=>row.type==='sales_template'&&row.data.kind!==kind&&row.data.productPrices?.some((item:any)=>item.productId===product.id)))result.push({code:'other_buyer_kind',message:'برای این کالا در نوع دیگری از خریدار الگو ثبت شده؛ الگوی هر نوع خریدار مستقل است.'});
 return result;
}

// This workspace exposes the same currently effective pricing policy as a quote,
// without buyer-specific credit/earned discounts, cost details or any mutation.
export async function readSalesTemplateWorkspace(actor:Session,raw:Partial<SalesTemplateWorkspaceFilters>={}):Promise<SalesTemplateWorkspace>{
 const {u}=await networkActor(actor);if(!salesManager(u))salesFail('فهرست الگوها و قیمت روز فقط برای مدیر فروش و مدیر سامانه است.',403);
 const filters=filterValues(raw),today=dayAt(),db=storage();
 const [rows,productRows,approvalRows]=await Promise.all([
  salesRows(),
  db.prepare("SELECT id,payload FROM records WHERE kind='product' ORDER BY created,id").all(),
  // Read only approval integrity fields; the approved floor is checked privately.
  // Neither the floor nor internal cost/profit data enters the response.
  db.prepare("SELECT id,json_extract(data,'$.productId') productId,json_extract(data,'$.kind') kind,json_extract(data,'$.calculation.unitPrice') unitPrice,json_extract(data,'$.calculation.minimumNet') minimumNet FROM flow_entities WHERE type='pricing_approval'").all(),
 ]);
 const products:SalesTemplateProduct[]=productRows.results.map((row:any)=>{const data=JSON.parse(row.payload);return {id:row.id,name:data.name||data.model||data.code||'کالای ثبت‌شده',code:data.code||'',model:data.model||'',status:data.status||''};}),byId=new Map(products.map(product=>[product.id,product]));
 if(filters.product&&!byId.has(filters.product))salesFail('محصول فیلتر پیدا نشد.',404);
 const templateRows=rows.filter(row=>row.type==='sales_template'&&Object.hasOwn(salesTemplateKinds,row.data.kind));
 const allTemplates:SalesTemplateSummary[]=templateRows.map((row):SalesTemplateSummary=>{
  const data=row.data,discountBps=discount(data),productPrices:SalesTemplateProductPrice[]=(Array.isArray(data.productPrices)?data.productPrices:[]).map((item:any)=>{const product=byId.get(item.productId),unitPrice=price(item.unitPrice);return {productId:String(item.productId??''),name:product?.name||'کالای بایگانی‌شده',code:product?.code||'',model:product?.model||'',unitPrice,unitNet:net(unitPrice,discountBps)};});
  const templateType=salesTemplateType(row);return {id:row.id,revision:row.revision,kind:data.kind as keyof typeof salesTemplateKinds,title:String(data.title||''),version:integerOrNull(data.version,1,Number.MAX_SAFE_INTEGER),templateType,...templateState(row,rows,today,filters.product?[filters.product]:products.map(p=>p.id)),effectiveFrom:data.effectiveFrom||null,effectiveTo:templateType==='promotion'?promotionEndDay(data.effectiveFrom,data.durationDays):null,durationDays:templateType==='promotion'?integerOrNull(data.durationDays,1,Number.MAX_SAFE_INTEGER):null,discountBps,cashBps:integerOrNull(data.cashBps,0,10000),minCashBps:integerOrNull(data.minCashBps??0,0,10000),days:safeDays(data,today),maxDays:safeDays(data,today,true),productPrices};
 }).sort((a,b)=>a.kind.localeCompare(b.kind)||(b.version??0)-(a.version??0)||b.id.localeCompare(a.id));
 const templates=allTemplates.filter(row=>(!filters.kind||row.kind===filters.kind)&&(!filters.type||row.templateType===filters.type)&&(!filters.status||row.status===filters.status)&&(!filters.product||salesTemplateAppliesTo(templateRows.find(t=>t.id===row.id),filters.product))&&match(filters.search,[row.title,row.id,salesTemplateKinds[row.kind],...row.productPrices.flatMap(item=>[item.name,item.code,item.model,item.productId])]));
 const approvals=new Map(approvalRows.results.map((row:any)=>[row.id,row]));
 const kinds=(filters.kind?[filters.kind]:Object.keys(salesTemplateKinds)) as (keyof typeof salesTemplateKinds)[],filteredProducts=products.filter(product=>!filters.product||product.id===filters.product);
 const prices:SalesTemplateCurrentPrice[]=kinds.flatMap(kind=>filteredProducts.map((product):SalesTemplateCurrentPrice=>{
  const template=selectSalesTemplate(rows,kind,today,product.id),resolved=salesBasePrice(rows,product.id,kind,today),discountBps=discount(template?.data),unitPrice=resolved?price(resolved.unitPrice):null,unitNet=net(unitPrice,discountBps),diagnostics=absenceDiagnostics(rows,kind,product,today,template);let canQuote=true;
  if(['غیرفعال','توقف تولید'].includes(product.status)){canQuote=false;diagnostics.push({code:'inactive_product',message:'این محصول برای سفارش فروش فعال نیست.'});}
  if(discountBps===null){canQuote=false;diagnostics.push({code:'invalid_discount',message:'درصد تخفیف الگوی جاری معتبر نیست.'});}
  if(!resolved){canQuote=false;diagnostics.push({code:'missing_product_price',message:'برای شناسه دقیق این کالا، قیمت پایه معتبر این نوع خریدار وجود ندارد.'});const future=templateRows.filter(row=>row.data.kind===kind&&isIsoDay(row.data.effectiveFrom)&&row.data.effectiveFrom>today&&row.data.productPrices?.some((item:any)=>item.productId===product.id)).sort((a,b)=>a.data.effectiveFrom.localeCompare(b.data.effectiveFrom))[0];if(future)diagnostics.push({code:'future_product_price',message:'قیمت این کالا در الگوی آینده از '+formatDate(future.data.effectiveFrom)+' اجرا می‌شود.'});}
  else if(unitPrice===null||unitNet===null||BigInt(unitNet)<=BigInt(0)){canQuote=false;diagnostics.push({code:'invalid_product_price',message:'مبلغ پایه یا مبلغ پس از تخفیف قابل استفاده نیست.'});}
  if(resolved?.approvedPrice){const source=resolved.approvedPrice,approval:any=approvals.get(source.data.pricingApprovalId);if(!approval||approval.productId!==product.id||approval.kind!==kind||approval.unitPrice!==unitPrice){canQuote=false;diagnostics.push({code:'invalid_price_approval',message:'مصوبه قیمت با این کالا یا نوع خریدار هم‌خوان نیست؛ مالی و مدیرعامل بررسی کنند.'});}else try{if(unitNet!==null&&BigInt(unitNet)<rial(approval.minimumNet)){canQuote=false;diagnostics.push({code:'price_approval_discount',message:'تخفیف الگو از دامنه مصوبه قیمت خارج است؛ مالی و مدیرعامل بررسی کنند.'});}}catch{canQuote=false;diagnostics.push({code:'invalid_price_approval',message:'دامنه مجاز مصوبه قیمت قابل محاسبه نیست؛ مالی و مدیرعامل بررسی کنند.'});}}
  const sourceTemplate=resolved?.source==='sales_template'?resolved.templatePrice?.template:null;
  return {kind,productId:product.id,name:product.name,code:product.code,model:product.model,productStatus:product.status,unitPrice,discountBps,unitNet,source:resolved?.source||null,sourceId:resolved?.sourceId||null,templateId:sourceTemplate?.id||null,templateTitle:sourceTemplate?.data.title||null,termsTemplateId:template?.id||null,termsTemplateTitle:template?.data.title||null,canQuote,diagnostics};
 })).filter(row=>match(filters.search,[row.name,row.code,row.model,row.productId,row.templateTitle,row.termsTemplateTitle,salesTemplateKinds[row.kind]]));
 return {today,kinds:salesTemplateKinds,products,filters,templates,prices,summary:{totalTemplates:allTemplates.length,filteredTemplates:templates.length,totalPrices:prices.length,availablePrices:prices.filter(row=>row.canQuote).length,blockedPrices:prices.filter(row=>!row.canQuote).length},notes:'قیمت روز شامل تخفیف الگوی همین کالا و نوع خریدار است. قیمت اختصاصی مشتری، تخفیف تارگت و بدهی معوق در این جدول محاسبه نمی‌شود؛ در پیش‌فاکتور واقعی بررسی می‌شود. فیلتر نوع و وضعیت، فهرست نسخه‌ها را محدود می‌کند و مبنای قیمت روز را تغییر نمی‌دهد.'};
}
