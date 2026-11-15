import {scaled,type BomLine} from './production';
export const customStages={production:'شروع تولید',dispatch:'پیش از ارسال',delivery:'پس از تحویل'} as const;
export type PaymentStage={stage:keyof typeof customStages;bps:number;days:number};
export type CustomChoice={partCode:string;label:string;quantity:string};
export type CustomLine={partCode:string;label:string;choices:CustomChoice[];base:string};
export type CustomConfig={bomId:string;version:number;days:number;lines:CustomLine[];incompatibilities:{a:string;av:string;b:string;bv:string}[]};
export function positiveDays(value:unknown,optional=false){if(optional&&(value===''||value==null))return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>3650)throw Error('مدت باید عدد صحیح بین ۱ تا ۳۶۵۰ روز تقویمی باشد.');return n;}
export function normalizePaymentStages(input:unknown):PaymentStage[]{
 if(!Array.isArray(input)||input.length!==3)throw Error('سه مرحله شروع تولید، ارسال و تحویل را تعیین کنید.');let prior=0;
 return input.map((x,i)=>{if(x.stage!==Object.keys(customStages)[i]||!Number.isInteger(x.bps)||x.bps<prior||x.bps>10000||!Number.isInteger(x.days)||x.days<0||x.days>366||i<2&&x.days!==0||i===2&&x.bps!==10000)throw Error('درصدها تجمعی و صعودی باشند؛ مرحله نهایی ۱۰۰ درصد است.');prior=x.bps;return {stage:x.stage,bps:x.bps,days:x.days};});
}
export function resolveCustomBom(config:CustomConfig,base:BomLine[],selections:Record<string,string>,materials:any[]){
 if(!selections||typeof selections!=='object'||Array.isArray(selections)||Object.keys(selections).some(k=>!config.lines.some(l=>l.partCode===k)))throw Error('انتخاب سفارش متعلق به نسخه منتشرشده نیست.');
 const chosen:Record<string,string>={},resolved=base.map(line=>{const setting=config.lines.find(l=>l.partCode===line.partCode);if(!setting)return {...line};const code=selections[line.partCode]||setting.base,choice=setting.choices.find(c=>c.partCode===code);if(!choice)throw Error('قطعه جایگزین در انتخاب‌های مجاز نیست.');chosen[line.partCode]=code;const material=materials.find(m=>m.data.code===code);if(!material)throw Error('شناسنامه قطعه جایگزین موجود نیست.');scaled(choice.quantity);return {partCode:code,name:material.data.name,unit:material.data.unit,quantity:choice.quantity};});
 for(const rule of config.incompatibilities||[])if(chosen[rule.a]===rule.av&&chosen[rule.b]===rule.bv)throw Error('ترکیب انتخاب‌ها ناسازگار است؛ درخواست ویژه برای فنی ثبت کنید.');
 const merged=new Map<string,BomLine>();for(const l of resolved){const existing=merged.get(l.partCode);if(existing){if(existing.unit!==l.unit)throw Error('واحد قطعات همسان سازگار نیست.');existing.quantity=String((scaled(existing.quantity)+scaled(l.quantity))/1000);}else merged.set(l.partCode,{...l});}return [...merged.values()];
}
// Only allocations of actually bank-matched cash to this order's invoices count.
// A rejected/reversed claim, credit note or cleared cheque is not a bank deposit.
export function customPaymentProgress(order:any,rows:any[]){
 const invoices=rows.filter(r=>r.type==='sales_invoice'&&r.data.orderId===order.id&&r.data.agentId===order.data.agentId),invoiceIds=new Set(invoices.map(r=>r.id));
 const payments=rows.filter(r=>r.type==='sales_payment'&&r.data.agentId===order.data.agentId),bankPayments=payments.filter(p=>p.data.method==='bank'&&p.data.state==='cleared'&&p.data.bankRowId&&rows.some(r=>r.type==='sales_bank_row'&&r.id===p.data.bankRowId&&r.data.status==='matched'&&r.data.paymentId===p.id&&r.data.amount===p.data.amount&&r.data.agentId===p.data.agentId&&r.data.accountId===p.data.receivingAccountId));
 let paid=BigInt(0);for(const p of bankPayments){const own=rows.filter(r=>r.type==='sales_allocation'&&r.data.creditId===p.id&&r.data.agentId===order.data.agentId),all=own.reduce((n,r)=>n+BigInt(r.data.amount),BigInt(0));if(all>BigInt(p.data.amount))throw Error('تخصیص وصول بیشتر از مبلغ بانک است.');paid+=own.filter(r=>invoiceIds.has(r.data.invoiceId)).reduce((n,r)=>n+BigInt(r.data.amount),BigInt(0));}
 const amount=BigInt(order.data.amount),stages=order.data.productionTerms?.stages as PaymentStage[]|undefined;
 const pending=payments.filter(p=>p.data.state==='pending'&&(p.data.cashOrderId===order.id||invoices.some(i=>i.id===p.data.checkInvoiceId))).reduce((n,p)=>n+BigInt(p.data.amount),BigInt(0));
 return {paid:String(paid),pending:String(pending),payments:payments.filter(p=>p.data.cashOrderId===order.id||bankPayments.includes(p)&&rows.some(a=>a.type==='sales_allocation'&&a.data.creditId===p.id&&invoiceIds.has(a.data.invoiceId))).map(p=>({id:p.id,amount:p.data.amount,day:p.data.day,reference:p.data.reference,state:p.data.state,bankMatched:bankPayments.includes(p)})),stages:(stages||[]).map(s=>{const required=(amount*BigInt(s.bps)+BigInt(9999))/BigInt(10000),remaining=required>paid?required-paid:BigInt(0);return {...s,label:customStages[s.stage],required:String(required),remaining:String(remaining),ready:remaining===BigInt(0)};})};
}
export const productionDue=(at:string,days:number)=>new Date(Date.parse(at)+days*86400000).toISOString();
export function productionInstallments(amount:string,stages:PaymentStage[]){let prior=BigInt(0);return stages.map(s=>{const cumulative=(BigInt(amount)*BigInt(s.bps)+BigInt(9999))/BigInt(10000),part={id:'production:'+s.stage,kind:s.stage==='production'?'cash':'balance',productionStage:s.stage,stageDays:s.days,amount:String(cumulative-prior),due:''};prior=cumulative;return part;}).filter(p=>BigInt(p.amount)>BigInt(0));}
