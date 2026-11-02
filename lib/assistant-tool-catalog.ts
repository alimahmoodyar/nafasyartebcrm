// Chat Completions accepts at most 128 tools. Keep room for navigation,
// form presentation and our read-only catalog discovery tool on every round.
export const assistantToolBudget=125;
const norm=(s:string)=>s.toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ');
const domains:[RegExp,RegExp][]=[
 [/انبار|موجودی|کالا|قطعه|بچ|عکس|نقشه/,/warehouse|material|batch|bom|stock|photo/],
 [/محصول|تولید|مونتاژ|سریال/,/product|production|serial|bom|fulfillment/],
 [/فروش|سفارش|خریدار|نماینده|فاکتور/,/sales|shipping|fulfillment|buyer/],
 [/کاربر|حساب کاربری|اکانت|دسترسی|رمز/,/user|password|member/],
 [/خدمات|تعمیر|گارانتی|داغی/,/service|after_sales|warranty|repair/],
 [/بیمارستان|مرکز|کمپرسور/,/hospital|build_intake|build_project/],
 [/خرید|تامین|تأمین|بازرگانی|صراف/,/sourcing|supplier|purchase|foreign/],
 [/وظیفه|کارتابل|صندوق|پیام|سمت|شرح وظایف/,/task|inbox|position|duty|workflow/],
 [/حمل|ارسال|بارنامه|مقصد/,/transport|shipping|fulfillment/],
 [/مالی|هزینه|بها|قیمت|خزانه|چک|بانک/,/finance|cost|pricing|treasury|bank|expense/],
 [/پرسنل|مرخصی|حقوق|حضور/,/personnel|member|asset/],
 [/کیفیت|کنترل|آزمایش/,/quality|qms|inspect/],
 [/یادآور|ریمایندر/,/reminder/],[/توسعه|درخواست قابلیت|اشکال/,/development/],
];
export function rankAssistantTools<T extends {name:string;description:string;write?:boolean}>(tools:T[],query:string,titles:Record<string,string>={}){
 const text=norm(query),words=text.split(/[^\p{L}\p{N}_]+/u).filter(w=>w.length>2);
 return tools.map((tool,index)=>{const content=norm(tool.name+' '+tool.description+' '+(titles[tool.name]||''));const score=(text===tool.name?1000:0)+words.reduce((n,w)=>n+(content.includes(w)?2:0),0)+domains.reduce((n,[request,names])=>n+(request.test(text)&&names.test(tool.name)?20:0),0);return {tool,index,score};}).sort((a,b)=>b.score-a.score||Number(!!a.tool.write)-Number(!!b.tool.write)||a.index-b.index).map(r=>r.tool);
}
export function selectAssistantTools<T extends {name:string;description:string;write?:boolean}>(tools:T[],query:string,pinned:string[]=[],titles:Record<string,string>={}){
 const names=new Set(['get_calendar_context',...pinned]),priority=tools.filter(t=>names.has(t.name));
 return [...priority,...rankAssistantTools(tools,query,titles).filter(t=>!names.has(t.name))].slice(0,assistantToolBudget);
}
