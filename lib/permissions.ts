import {qmsRoles} from './qms-contract';
import type {Kind} from "./model";

export const modules: Kind[] = ["product", "batch", "device", "event", "service", "action", "distribution", "firmware"];
const productionModules:Kind[]=["batch", "device", "event", "service", "action"];
export const stages = ["مصرف قطعه", "مونتاژ", "آزمون نهایی", "بسته‌بندی", "تحویل"];
export type RoleAssignment = {roles:string[]; warehouses?:string[]; serviceDomains?:string[]; salesAgentId?:string; serviceAgentId?:string};
export type Permissions = {roleAssignment?:RoleAssignment;treasuryWorkflowRoles?:string[];assetRoles?:string[];qmsRoles?:string[];personnelRoles?:string[];hospitalCenterId?:string;salesRoles?:string[];salesAgentId?:string;transportRoles?:string[];serviceRoles?:string[];serviceDomains?:string[];serviceAgentId?:string;supplyRoles?: string[];warehouses?: string[];flowRoles?: string[];read: Kind[]; write: Kind[]; eventStages: string[]; finance?: "none"|"read"|"write"};
export type Session = {username?:string;authType?:"password"|"chatgpt";userId: string; email: string; name: string; isAdmin: boolean; permissions: Permissions};
export type Member = {canDelete?:boolean;username?:string;id: string; email: string; name: string; unit: string; status: string; userId: string | null; permissions: Permissions; revision: number; created: string; updated: string};
export const allPermissions: Permissions = {assetRoles:["custodian"],personnelRoles:["hr","payroll","approver","finance","treasury"],salesRoles:["manager","staff","finance","viewer"],transportRoles:['manager','driver'],serviceRoles:["manager","support","intake","technician","coordinator","inventory","logistics","finance"],serviceDomains:["home","hospital"],supplyRoles:["sales","production_planning","ceo","engineering","inventory","finance","domestic","foreign","commerce_manager"],warehouses:["raw","semi","line","quarantine","nonconforming","finished"],flowRoles:["inventory","qc","production","procurement","sales","logistics"],read: modules, write: modules, eventStages: stages, finance: "write"};
export const presets: Record<string, Permissions> = {
 "مدیر فروش": {salesRoles:["manager","staff"],flowRoles:["sales"],read:[],write:[],eventStages:[]},
 "کارشناس فروش": {salesRoles:["staff"],flowRoles:["sales"],read:[],write:[],eventStages:[]},
 "مالی فروش": {salesRoles:["finance"],read:[],write:[],eventStages:[]},
 "نماینده فروش": {salesRoles:["agent"],read:[],write:[],eventStages:[]},
 "تأمین": {flowRoles:["procurement"],read:["batch"],write:[],eventStages:[]},
  "مسئول تدارکات": {transportRoles:["manager"],read:[],write:[],eventStages:[]},
  "کارشناس تدارکات و حمل‌ونقل": {transportRoles:["driver"],flowRoles:[],read:[],write:[],eventStages:[]},
  "مالی": {read: [], write: [], eventStages: [], finance: "write"},
  "انبار": {flowRoles:["inventory"],read: ["batch"], write: ["batch"], eventStages: []},
  "تولید": {flowRoles:["production"],read: ["product", "batch", "device", "event"], write: ["device", "event"], eventStages: ["مصرف قطعه", "مونتاژ", "بسته‌بندی"]},
  "کنترل کیفیت": {flowRoles:["qc"],read: productionModules, write: ["batch", "event", "action"], eventStages: ["آزمون نهایی"]},
  "فروش و تحویل": {flowRoles:["sales"],read: ["batch", "device", "event", "distribution"], write: ["event", "distribution"], eventStages: ["تحویل"]},
  "خدمات خانگی": {serviceRoles:["support","intake","technician"],serviceDomains:["home"],read:[],write:[],eventStages:[]},
  "خدمات بیمارستانی": {serviceRoles:["support","intake","technician"],serviceDomains:["hospital"],read:[],write:[],eventStages:[]},
  "نماینده خدمات": {serviceRoles:["agent"],serviceDomains:["home"],read:[],write:[],eventStages:[]},
  "خدمات پس از فروش": {read: [...productionModules,"distribution"], write: ["service", "action"], eventStages: []},
  "مدیریت — فقط مشاهده": {read: modules, write: [], eventStages: []},
  "سفارشی": {read: [], write: [], eventStages: []},
  "مهندسی نرم‌افزار": {read: ["device", "firmware"], write: ["firmware"], eventStages: []},
};
presets['تکنسین فنی بیمارستانی']={serviceRoles:['technician'],serviceDomains:['hospital'],read:[],write:[],eventStages:[]};
presets['تکنسین فنی خانگی']={serviceRoles:['technician'],serviceDomains:['home'],read:[],write:[],eventStages:[]};
presets["اموال‌دار"]={assetRoles:["custodian"],read:[],write:[],eventStages:[]};
export function validatePermissions(value: unknown): Permissions {
  const raw = value as Permissions;
  // Role selection is authoritative: never merge client-supplied extra grants.
  const p = raw?.roleAssignment ? resolveRoleAssignment(raw.roleAssignment) : raw;
  if(p?.treasuryWorkflowRoles!==undefined&&(!Array.isArray(p.treasuryWorkflowRoles)||p.treasuryWorkflowRoles.some(r=>!['treasury','manager','accountant','ceo'].includes(r))))throw Error('نقش خزانه‌داری معتبر نیست.');
  if(p?.treasuryWorkflowRoles?.length&&(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent')))throw Error('حساب بیرونی مجوز خزانه‌داری ندارد.');
  if(p?.assetRoles!==undefined&&(!Array.isArray(p.assetRoles)||p.assetRoles.some(r=>r!=="custodian")))throw Error("نقش اموال معتبر نیست.");
  if(p?.assetRoles?.length&&(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes("agent")||p.serviceRoles?.includes("agent")))throw Error("حساب بیرونی دسترسی اموال شرکت ندارد.");
  if(p?.qmsRoles!==undefined&&(!Array.isArray(p.qmsRoles)||p.qmsRoles.some(r=>!Object.hasOwn(qmsRoles,r))))throw Error("نقش کیفیت معتبر نیست.");
  if(p?.qmsRoles?.length&&(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes("agent")||p.serviceRoles?.includes("agent")))throw Error("حساب بیرونی مجوز کیفیت ندارد.");
  if(p?.personnelRoles!==undefined&&(!Array.isArray(p.personnelRoles)||p.personnelRoles.some(r=>!["hr","payroll","approver","finance","treasury"].includes(r))))throw Error("دسترسی پرسنلی معتبر نیست.");
  if(p?.personnelRoles?.length&&(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes("agent")||p.serviceRoles?.includes("agent")))throw Error("حساب بیرونی مجوز پرسنلی ندارد.");
  if (!p || !Array.isArray(p.read) || !Array.isArray(p.write) || !Array.isArray(p.eventStages)) throw new Error("دسترسی‌ها معتبر نیستند.");
  if (p.read.some(k => !modules.includes(k)) || p.write.some(k => !modules.includes(k)) || p.eventStages.some(s => !stages.includes(s))) throw new Error("دسترسی ناشناخته است.");
  if (p.write.some(k => !p.read.includes(k))) throw new Error("ثبت اطلاعات به دسترسی مشاهده همان بخش نیاز دارد.");
  if (p.write.includes("event") && (!p.read.includes("device") || !p.read.includes("batch") || !p.eventStages.length)) throw new Error("ثبت رویداد به مشاهده دستگاه و بچ و انتخاب مرحله مجاز نیاز دارد.");
  if (p.write.includes("service") && (!p.read.includes("device") || !p.read.includes("batch"))) throw new Error("ثبت خدمات به مشاهده دستگاه و بچ نیاز دارد.");
  if (p.write.includes("action") && (!p.read.includes("device") || !p.read.includes("batch"))) throw new Error("ثبت اقدام اصلاحی به مشاهده دستگاه و بچ نیاز دارد.");
  if(p.read.includes("distribution")&&!p.read.includes("device"))throw new Error("مشاهده نماینده و مشتری به مشاهده دستگاه نیاز دارد.");
  if(p.finance!==undefined&&!(["none","read","write"] as unknown[]).includes(p.finance))throw new Error("دسترسی مالی معتبر نیست.");
  if(p.flowRoles!==undefined&&(!Array.isArray(p.flowRoles)||p.flowRoles.some(r=>!['inventory','qc','production','procurement','sales','logistics'].includes(r))))throw new Error('نقش گردش مواد معتبر نیست.');
  if(p.warehouses!==undefined&&(!Array.isArray(p.warehouses)||p.warehouses.some(w=>!['raw','semi','line','quarantine','nonconforming','finished'].includes(w))))throw new Error('انبار مجاز معتبر نیست.');
  if(p.supplyRoles!==undefined&&(!Array.isArray(p.supplyRoles)||p.supplyRoles.some(r=>!['sales','production_planning','ceo','engineering','inventory','finance','domestic','foreign','commerce_manager'].includes(r))))throw new Error('نقش برنامه‌ریزی تأمین معتبر نیست.');
  if(p.transportRoles!==undefined&&(!Array.isArray(p.transportRoles)||p.transportRoles.some(r=>!['manager','driver'].includes(r))))throw new Error('نقش تدارکات معتبر نیست.');
  if(p.serviceRoles!==undefined&&(!Array.isArray(p.serviceRoles)||p.serviceRoles.some(r=>!['manager','support','intake','technician','coordinator','inventory','logistics','finance','agent'].includes(r))))throw new Error('نقش خدمات معتبر نیست.');
  if(p.serviceDomains!==undefined&&(!Array.isArray(p.serviceDomains)||p.serviceDomains.some(r=>!['home','hospital'].includes(r))))throw new Error('حوزه خدمات معتبر نیست.');
  if(p.serviceAgentId!==undefined&&(typeof p.serviceAgentId!=='string'||p.serviceAgentId.length>200))throw new Error('نماینده معتبر نیست.');
  if(p.serviceRoles?.includes('agent')&&(p.salesRoles?.length||p.salesAgentId||!p.serviceAgentId||p.serviceRoles.length!==1||p.read.length||p.write.length||p.flowRoles?.length||p.transportRoles?.length||p.supplyRoles?.length||p.finance&&p.finance!=='none'))throw new Error('حساب نماینده فقط نقش نماینده و حوزه خدمات خودش را دارد؛ مجوز عمومی شرکت ندهید.');
  if(p.serviceRoles?.length&&!p.serviceDomains?.length)throw new Error('حوزه خدمات را انتخاب کنید.');
  if(p.serviceAgentId&&!p.serviceRoles?.includes('agent'))throw new Error('اتصال نماینده فقط با نقش نماینده مجاز است.');
  if(p.salesRoles!==undefined&&(!Array.isArray(p.salesRoles)||p.salesRoles.some(r=>!['manager','staff','finance','viewer','agent'].includes(r))))throw new Error('نقش فروش معتبر نیست.');
  if(p.salesAgentId!==undefined&&(typeof p.salesAgentId!=='string'||p.salesAgentId.length>200))throw new Error('شناسه نماینده فروش معتبر نیست.');
  if(p.salesRoles?.includes('agent')&&(!p.salesAgentId||p.salesRoles.length!==1||p.read.length||p.write.length||p.eventStages.length||p.flowRoles?.length||p.transportRoles?.length||p.supplyRoles?.length||p.serviceRoles?.length||p.serviceAgentId||p.finance&&p.finance!=='none'))throw new Error('حساب نماینده فروش فقط به پرونده خودش دسترسی دارد؛ مجوز عمومی شرکت ندهید.');
  if(p.salesAgentId&&!p.salesRoles?.includes('agent'))throw new Error('ارتباط نماینده فروش فقط با نقش نماینده مجاز است.');
  if(p.hospitalCenterId!==undefined&&(typeof p.hospitalCenterId!=='string'||p.hospitalCenterId.length>200))throw Error('شناسه مرکز معتبر نیست.');
  if(p.hospitalCenterId&&(p.read.length||p.write.length||p.eventStages.length||p.salesRoles?.length||p.salesAgentId||p.serviceRoles?.length||p.serviceDomains?.length||p.serviceAgentId||p.flowRoles?.length||p.transportRoles?.length||p.supplyRoles?.length||p.finance&&p.finance!=='none'))throw Error('حساب مسئول مرکز فقط به مرکز خودش دسترسی دارد.');
  return {treasuryWorkflowRoles:[...new Set(p.treasuryWorkflowRoles||[])],...(p.roleAssignment?{roleAssignment:p.roleAssignment}:{}),assetRoles:[...new Set(p.assetRoles||[])],qmsRoles:[...new Set(p.qmsRoles||[])],personnelRoles:[...new Set(p.personnelRoles||[])],hospitalCenterId:p.hospitalCenterId||'',salesRoles:[...new Set(p.salesRoles||[])],salesAgentId:p.salesAgentId||'',transportRoles:[...new Set(p.transportRoles||[])],serviceRoles:[...new Set(p.serviceRoles||[])],serviceDomains:[...new Set(p.serviceDomains||[])],serviceAgentId:p.serviceAgentId||'',supplyRoles:[...new Set(p.supplyRoles||[])],...(p.warehouses!==undefined?{warehouses:[...new Set(p.warehouses)]}:{}),flowRoles:[...new Set(p.flowRoles||[])],finance:p.finance||"none",read: [...new Set(p.read)], write: [...new Set(p.write)], eventStages: p.write.includes("event") ? [...new Set(p.eventStages)] : []};
}

for(const [role,label] of Object.entries({hr:"اداری و منابع انسانی",payroll:"تهیه حقوق‌ودستمزد",approver:"تأیید حقوق و احکام",finance:"تأیید پرداخت پرسنلی",treasury:"ثبت پرداخت پرسنلی"}))presets[label]={read:[],write:[],eventStages:[],personnelRoles:[role]};

for(const [role,label] of Object.entries(qmsRoles))presets[label]={read:[],write:[],eventStages:[],qmsRoles:[role]};
presets["تحقیق‌وتوسعه و مهندسی طراحی"]={read:["product"],write:[],eventStages:[],supplyRoles:["engineering"]};
presets["برنامه‌ریزی تولید"]={read:["product"],write:[],eventStages:[],supplyRoles:["production_planning"]};
presets["مدیرعامل"]={read:["product"],write:[],eventStages:[],supplyRoles:["ceo"]};

presets['مدیر بازرگانی']={read:[],write:[],eventStages:[],supplyRoles:['commerce_manager','foreign','domestic']};
presets['بازرگانی خارجی']={read:[],write:[],eventStages:[],supplyRoles:['foreign']};

// Versioned, explicit workflow dependencies. Assignments store both intent and the
// validated effective snapshot; editing unrelated account fields never infers roles.
export const rolePolicyVersion=2;
export type JobRole={id:string;label:string;group:string;actions:string;grants:Permissions;scope?:'warehouses'|'services'|'salesAgent'|'serviceAgent'};
const emptyGrants=():Permissions=>({read:[],write:[],eventStages:[]});
const job=(id:string,label:string,group:string,actions:string,grants:Partial<Permissions>,scope?:JobRole['scope']):JobRole=>({id,label,group,actions,grants:{...emptyGrants(),...grants},scope});
export const jobRoles:JobRole[]=[
 job('inventory','انباردار','انبار و تولید','بررسی کسری، دریافت کالا، جانمایی، تحویل مواد و بستن سفارش پذیرفته‌شده',{...presets['انبار'],supplyRoles:['inventory']},'warehouses'),
 job('production','مسئول تولید','انبار و تولید','برنامه روزانه، مونتاژ، ثبت مصرف مواد و بسته‌بندی',presets['تولید']),
 job('planning','برنامه‌ریزی تولید','انبار و تولید','ثبت و پیگیری برنامه تولید و نیاز تأمین',presets['برنامه‌ریزی تولید']),
 job('engineering','تحقیق و توسعه','انبار و تولید','مشخصات و BOM، مسیر تأمین، بررسی فنی پیشنهاد و تغییر طراحی',presets['تحقیق‌وتوسعه و مهندسی طراحی']),
 job('qc','کنترل کیفیت','کیفیت','کنترل ورودی و نهایی، صلاحیت منبع و ثبت عدم انطباق',{...presets['کنترل کیفیت'],qmsRoles:['qc']}),
 job('domestic','کارشناس خرید داخلی','خرید','استعلام داخلی، پرونده تأمین‌کننده و پیگیری سفارش و مدارک',{supplyRoles:['domestic'],flowRoles:['procurement'],read:['batch']}),
 job('foreign','کارشناس خرید خارجی','خرید','منبع‌یابی، نمونه، اسناد واردات، پیگیری ارز، بار و ترخیص',{supplyRoles:['foreign'],flowRoles:['procurement'],read:['batch']}),
 job('commerce','مدیر بازرگانی','خرید','مدیریت مسئول‌ها و پیگیری خرید داخلی و خارجی',presets['مدیر بازرگانی']),
 job('purchase_finance','کارشناس خرید مالی','مالی','بودجه و صدور خرید، بررسی بدهی، مجوز پرداخت و تأیید بهای خرید',{finance:'write',supplyRoles:['finance']}),
 job('finance','کارشناس مالی','مالی','مشاهده و ثبت بررسی‌های مالی و هزینه‌ها',presets['مالی']),
 job('ceo','مدیرعامل / تصمیم‌گیر خرید','مدیریت','تأیید برنامه و انتخاب پیشنهاد خرید؛ بدون مدیریت حساب‌های کاربری',presets['مدیرعامل']),
 job('sales','کارشناس فروش','فروش','ثبت و پیگیری فروش و درخواست تولید',{...presets['کارشناس فروش'],read:['product'],supplyRoles:['sales']}),
 job('sales_manager','مدیر فروش','فروش','مدیریت فروش، سفارش‌ها و درخواست تولید',{...presets['مدیر فروش'],read:['product'],supplyRoles:['sales']}),
 job('sales_finance','کارشناس حسابداری فروش','مالی','بررسی مالی سفارش‌های فروش',presets['مالی فروش']),
 job('delivery','فروش و تحویل','فروش','ثبت تحویل دستگاه و اطلاعات توزیع',presets['فروش و تحویل']),
 job('transport_manager','مسئول تدارکات','تدارکات','تخصیص و پیگیری مأموریت‌های حمل‌ونقل',presets['مسئول تدارکات']),
 job('driver','راننده تدارکات','تدارکات','انجام مأموریت‌های تخصیص‌یافته خرید، فروش و خدمات',presets['کارشناس تدارکات و حمل‌ونقل']),
 job('custodian','اموال‌دار','اداری','ثبت اموال، تحویل و بازپس‌گیری و پیگیری تأیید اموال امانی',presets['اموال‌دار']),
 job('firmware','مهندسی نرم‌افزار','انبار و تولید','ثبت و نگهداری نسخه نرم‌افزار دستگاه',presets['مهندسی نرم‌افزار']),
 job('viewer','مدیریت؛ مشاهده اطلاعات رهگیری','مدیریت','مشاهده اطلاعات رهگیری؛ بدون ثبت یا تأیید',presets['مدیریت — فقط مشاهده']),
 job('sales_agent','نماینده فروش','حساب‌های بیرونی','فقط پرونده نمایندگی فروش انتخاب‌شده',{salesRoles:['agent']},'salesAgent'),
 job('service_agent','نماینده خدمات','حساب‌های بیرونی','فقط پرونده، موجودی و حساب نمایندگی خدمات انتخاب‌شده',{serviceRoles:['agent']},'serviceAgent'),
];
jobRoles.push(
 job('treasurer','خزانه‌دار','مالی','اجرای پرداخت دارای مجوز مدیرعامل، چک، تنخواه و پیگیری ضمانت‌نامه',{finance:'read',treasuryWorkflowRoles:['treasury']}),
 job('finance_director','مدیر مالی','مالی','بررسی مستقل درخواست، حساب و ضمانت‌نامه؛ بدون اجرای پرداخت',{finance:'read',treasuryWorkflowRoles:['manager']}),
 job('accounting_head','رئیس حسابداری','مالی','تطبیق مستقل صورتحساب و کنترل حسابداری',{finance:'read',treasuryWorkflowRoles:['accountant']}),
 job('ceo_payment','مجوز نهایی پرداخت مدیرعامل','مدیریت','صدور مستقل مجوز نهایی پرداخت به خزانه‌دار؛ بدون اجرای پرداخت',{finance:'read',treasuryWorkflowRoles:['ceo']}),
 job('warehouse_finance','کارشناس انبار مالی','مالی','مشاهده موجودی و هزینه‌ها؛ بدون جابه‌جایی کالا',{finance:'read',read:['batch']}),
 job('warehouse_supervisor','مسئول انبار','انبار و تولید','دریافت، جانمایی و تحویل در انبارهای تعیین‌شده',{...presets['انبار'],supplyRoles:['inventory']},'warehouses'),
 job('production_store_assistant','کمک‌انباردار تولید','انبار و تولید','عملیات انبار خط تولید در محدوده انتخاب‌شده',presets['انبار'],'warehouses'),
 job('home_sales','کارشناس فروش خانگی','فروش','فروش و پیگیری نمایندگان و عاملین؛ دسترسی فروش داخلی مشترک',{...presets['کارشناس فروش'],read:['product'],supplyRoles:['sales']}),
 job('hospital_sales','کارشناس فروش بیمارستانی','فروش','پیگیری سرنخ و سفارش بیمارستانی؛ دسترسی فروش داخلی مشترک',{...presets['کارشناس فروش'],read:['product'],supplyRoles:['sales']}),
 job('sales_manager_assistant','دستیار مدیر فروش','فروش','پیگیری فروش؛ بدون اختیار تأیید مدیر فروش',{...presets['کارشناس فروش'],read:['product'],supplyRoles:['sales']}),
 job('domestic_commerce_lead','مسئول بازرگانی داخلی','خرید','مدیریت و پیگیری خرید داخلی',{supplyRoles:['commerce_manager','domestic']}),
 job('foreign_commerce_lead','مسئول بازرگانی خارجی','خرید','مدیریت و پیگیری خرید خارجی',{supplyRoles:['commerce_manager','foreign']}),
 job('sales_viewer','مشاهده‌گر گزارش فروش','فروش','مشاهده فروش؛ بدون ثبت یا تأیید',{salesRoles:['viewer']})
);
for(const [id,label,actions] of [
 ['manager','مدیر خدمات','مدیریت پرونده‌ها و عملیات حوزه خدمات انتخاب‌شده'],
 ['support','پاسخ‌گوی خدمات','ثبت تماس، پیگیری و هماهنگی با مشتری'],
 ['intake','پذیرش خدمات','پذیرش و ثبت اطلاعات دستگاه و پرونده'],
 ['technician','تکنسین خدمات','عیب‌یابی، برآورد، تعمیر و ثبت نتیجه آزمون'],
 ['coordinator','مسئول نمایندگان خدمات','هماهنگی و پیگیری امور نمایندگان'],
 ['inventory','انباردار خدمات','آماده‌سازی، دریافت و تحویل قطعات خدمات'],
 ['finance','مالی خدمات','ثبت و بررسی پرداخت و حساب خدمات'],
])jobRoles.push(job('service_'+id,label,'خدمات پس از فروش',actions,{serviceRoles:[id]},'services'));
for(const [id,label] of Object.entries({hr:'اداری و منابع انسانی',payroll:'تهیه حقوق‌ودستمزد',approver:'تأیید حقوق و احکام',finance:'تأیید پرداخت پرسنلی',treasury:'ثبت پرداخت پرسنلی'}))jobRoles.push(job('personnel_'+id,label,'پرسنلی',label,{personnelRoles:[id]}));
for(const [id,label] of Object.entries(qmsRoles))if(id!=='qc')jobRoles.push(job('quality_'+id,label,'کیفیت',label,{qmsRoles:[id]}));

export function resolveRoleAssignment(value:RoleAssignment):Permissions {
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['roles','warehouses','serviceDomains','salesAgentId','serviceAgentId'].includes(k))||!Array.isArray(value.roles)||!value.roles.length||value.roles.length>jobRoles.length||value.roles.some(id=>typeof id!=='string'||!jobRoles.some(r=>r.id===id)))throw Error('حداقل یک نقش شغلی معتبر انتخاب کنید.');
 const roles=[...new Set(value.roles)].map(id=>jobRoles.find(r=>r.id===id)!);
 if(roles.some(r=>r.scope==='salesAgent'||r.scope==='serviceAgent'||r.id==='quality_observer')&&roles.length>1)throw Error('نقش بیرونی را نمی‌توان با نقش‌های دیگر ترکیب کرد؛ حساب مستقل تعریف کنید.');
 const scope=(key:'warehouses'|'serviceDomains',allowed:string[],required:boolean)=>{
  const v=value[key];if(v!==undefined&&(!Array.isArray(v)||v.some(x=>typeof x!=='string'||!allowed.includes(x))))throw Error('محدوده کاری معتبر انتخاب کنید.');
  if(required&&!v?.length)throw Error(key==='warehouses'?'انبارهای تحت مسئولیت را انتخاب کنید.':'حوزه خدمات را انتخاب کنید.');
  return required?[...new Set(v!)]:undefined;
 };
 const assignment:RoleAssignment={roles:roles.map(r=>r.id)};
 const result:Permissions=emptyGrants();
 const arrays=['treasuryWorkflowRoles','read','write','eventStages','assetRoles','qmsRoles','personnelRoles','salesRoles','transportRoles','serviceRoles','supplyRoles','flowRoles'] as const;
 for(const role of roles){for(const key of arrays)(result as any)[key]=[...new Set([...(result[key]||[]),...(role.grants[key]||[])])];if(role.grants.finance==='write'||role.grants.finance==='read'&&result.finance!=='write')result.finance=role.grants.finance;}
 const wh=scope('warehouses',['raw','semi','line','quarantine','nonconforming','finished'],roles.some(r=>r.scope==='warehouses'));
 if(wh){if(roles.some(r=>r.id==='production_store_assistant')&&wh.some(w=>w!=='line')&& !roles.some(r=>r.id==='inventory'||r.id==='warehouse_supervisor'))throw Error('کمک‌انباردار تولید فقط به انبار خط دسترسی دارد.');result.warehouses=wh;assignment.warehouses=wh;}
 const domains=scope('serviceDomains',['home','hospital'],roles.some(r=>r.scope==='services'||r.scope==='serviceAgent'));
 if(domains){result.serviceDomains=domains;assignment.serviceDomains=domains;}
 for(const [kind,key] of [['salesAgent','salesAgentId'],['serviceAgent','serviceAgentId']] as const)if(roles.some(r=>r.scope===kind)){
  if(typeof value[key]!=='string'||!value[key]!.trim()||value[key]!.length>200)throw Error('نمایندگی مربوط را انتخاب کنید.');result[key]=value[key]!.trim();assignment[key]=result[key];
 }
 if(roles.some(r=>r.scope==='serviceAgent')&&domains?.length!==1)throw Error('نماینده خدمات باید فقط یک حوزه داشته باشد.');
 return {...result,roleAssignment:assignment};
}
