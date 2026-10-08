import type {Kind} from "./model";

export const modules: Kind[] = ["product", "batch", "device", "event", "service", "action", "distribution", "firmware"];
const productionModules:Kind[]=["batch", "device", "event", "service", "action"];
export const stages = ["مصرف قطعه", "مونتاژ", "آزمون نهایی", "بسته‌بندی", "تحویل"];
export type Permissions = {personnelRoles?:string[];hospitalCenterId?:string;salesRoles?:string[];salesAgentId?:string;transportRoles?:string[];serviceRoles?:string[];serviceDomains?:string[];serviceAgentId?:string;supplyRoles?: string[];warehouses?: string[];flowRoles?: string[];read: Kind[]; write: Kind[]; eventStages: string[]; finance?: "none"|"read"|"write"};
export type Session = {username?:string;authType?:"password"|"chatgpt";userId: string; email: string; name: string; isAdmin: boolean; permissions: Permissions};
export type Member = {canDelete?:boolean;username?:string;id: string; email: string; name: string; unit: string; status: string; userId: string | null; permissions: Permissions; revision: number; created: string; updated: string};
export const allPermissions: Permissions = {personnelRoles:["hr","payroll","approver","finance","treasury"],salesRoles:["manager","staff","finance","viewer"],transportRoles:['manager','driver'],serviceRoles:["manager","support","intake","technician","coordinator","inventory","logistics","finance"],serviceDomains:["home","hospital"],supplyRoles:["sales","ceo","engineering","inventory","finance","domestic","foreign"],warehouses:["raw","semi","line","quarantine","nonconforming","finished"],flowRoles:["inventory","qc","production","procurement","sales","logistics"],read: modules, write: modules, eventStages: stages, finance: "write"};
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
export function validatePermissions(value: unknown): Permissions {
  const p = value as Permissions;
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
  if(p.supplyRoles!==undefined&&(!Array.isArray(p.supplyRoles)||p.supplyRoles.some(r=>!['sales','ceo','engineering','inventory','finance','domestic','foreign'].includes(r))))throw new Error('نقش برنامه‌ریزی تأمین معتبر نیست.');
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
  return {personnelRoles:[...new Set(p.personnelRoles||[])],hospitalCenterId:p.hospitalCenterId||'',salesRoles:[...new Set(p.salesRoles||[])],salesAgentId:p.salesAgentId||'',transportRoles:[...new Set(p.transportRoles||[])],serviceRoles:[...new Set(p.serviceRoles||[])],serviceDomains:[...new Set(p.serviceDomains||[])],serviceAgentId:p.serviceAgentId||'',supplyRoles:[...new Set(p.supplyRoles||[])],...(p.warehouses!==undefined?{warehouses:[...new Set(p.warehouses)]}:{}),flowRoles:[...new Set(p.flowRoles||[])],finance:p.finance||"none",read: [...new Set(p.read)], write: [...new Set(p.write)], eventStages: p.write.includes("event") ? [...new Set(p.eventStages)] : []};
}

for(const [role,label] of Object.entries({hr:"اداری و منابع انسانی",payroll:"تهیه حقوق‌ودستمزد",approver:"تأیید حقوق و احکام",finance:"تأیید پرداخت پرسنلی",treasury:"ثبت پرداخت پرسنلی"}))presets[label]={read:[],write:[],eventStages:[],personnelRoles:[role]};
