import type {ServiceField} from './after-sales-contract';
export const servicePartsActions:Record<string,string>={catalog_propose:'پیشنهاد قطعات مجاز یک مدل',catalog_decide:'تصمیم مدیرعامل درباره فهرست قطعات',eligibility:'مجوز تعمیر دستگاه‌های نماینده'};
const f=(key:string,label:string,type='text',extra:Partial<ServiceField>={}):ServiceField=>({key,label,type,...extra});
export const servicePartsForms:Record<string,ServiceField[]>={
 catalog_propose:[f('productId','مدل دستگاه','select',{source:'products'}),f('parts','قطعات مجاز این مدل؛ فهرست کامل جایگزین','rows',{fields:[f('partCode','کالای انبار مرکزی','select',{source:'materials'})]}),f('notes','دلیل پیشنهاد یا تغییر','textarea')],
 catalog_decide:[f('approved','فهرست تأیید شود','boolean'),f('notes','دلیل تصمیم مدیرعامل','textarea')],
 eligibility:[f('agentId','نماینده خدمات خانگی','select',{source:'agents'}),f('products','دستگاه‌های مجاز به تعمیر؛ فهرست کامل','rows',{fields:[f('productId','مدل دستگاه','select',{source:'products'})]}),f('notes','شرح آموزش / تغییر مجوز','textarea')]
};
export const servicePartsHelp='Expert proposes the complete central-material list for each device model; CEO approves every addition/removal with current catalog revision. Expert separately assigns trained/authorized models to each representative. Representative searches the union of approved parts for all authorized models; no model selection is required before ordering. Only approved effective representative sale prices apply. Read-only details disclose identification fields/photos only, not suppliers, cost, BOM or stock. API and UI enforce the same entitlement and revisions; removed permissions affect future orders without rewriting earlier invoices.';
