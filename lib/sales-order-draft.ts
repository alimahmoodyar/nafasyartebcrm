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
