import type {Session} from './permissions';
import type {OperationForm} from './assistant-workspace';
import {salesRead,salesScope,salesRows,salesQuote,salesFail,salesSubmission} from './sales';

// Read-only domain preview. Never accept totals, names or rates from the model/browser.
export async function salesOrderDraft(u:Session,args:any){
 if(!salesRead(u))salesFail('دسترسی فروش ندارید.',403);
 const agent=await salesScope(u,args.agentId);
 if(args.referrerId)await salesScope(u,args.referrerId);
 const quote=await salesQuote(agent,args.items,await salesRows(),args);
 return {...quote,buyer:{id:agent.id,name:agent.data.name,kind:agent.data.kind||'representative'}};
}
export async function hydrateSalesOrderForm(u:Session,form:OperationForm):Promise<OperationForm>{
 if(form.tool!=='sales_apply'||form.args.mode!=='order')return form;
 if(!form.args.agentId||!Array.isArray(form.args.items)||!form.args.items.length||form.args.items.some((i:any)=>!i.productId||!i.quantity))return {...form,preview:undefined,previewError:undefined};
 try{return {...form,preview:await salesOrderDraft(u,form.args),previewError:undefined};}
 catch(e){return {...form,preview:undefined,previewError:e instanceof Error?e.message:'پیش‌فاکتور قابل محاسبه نیست.'};}
}
export async function prepareSalesOrderArgs(u:Session,args:any){
 if(args.mode!=='order')return args;
 const quote=await salesOrderDraft(u,args);
 if(args.quoteHash&&args.quoteHash!==quote.quoteHash)salesFail('قیمت یا شرایط فروش تغییر کرده است؛ خلاصه جدید را بررسی و دوباره آماده کنید.',409);
 salesSubmission(u,args.agentId,args.requestSource,new Date().toISOString());
 return {...args,quoteHash:quote.quoteHash};
}

// A previous negotiation belongs to its exact buyer and product set, not the
// next item the model happens to put in the draft. Quantities do not change it.
export function salesDraftArgs(name:string,args:any,previous:any,message:string){
 if(name!=='sales_apply'||args?.mode!=='order')return args;
 const products=(draft:any):string[]|null=>Array.isArray(draft?.items)&&draft.items.length&&draft.items.every((item:any)=>typeof item?.productId==='string'&&item.productId.trim())?[...new Set<string>(draft.items.map((item:any)=>item.productId))].sort():null;
 const currentProducts=products(args),previousArgs=previous?.tool==='sales_apply'&&previous.args?.mode==='order'?previous.args:null,previousProducts=products(previousArgs);
 const sameContext=!!args.agentId&&args.agentId===previousArgs?.agentId&&!!currentProducts&&!!previousProducts&&JSON.stringify(currentProducts)===JSON.stringify(previousProducts);
 const explicit=/(نقد|قسط|اقساط|ماه|[0-9۰-۹٠-٩]+\s*روزه|مهلت|شرایط\s+(?:پرداخت|متفاوت|پیشنهادی)|cash|installment)/i.test(message);
 if(args.agentId&&currentProducts&&(explicit||sameContext&&previousArgs?.salesTerms))return args;
 const {salesTerms,...defaults}=args;return defaults;
}
