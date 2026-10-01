import type {Kind} from "./model";

export const modules: Kind[] = ["product", "batch", "device", "event", "service", "action", "distribution", "firmware"];
const productionModules:Kind[]=["batch", "device", "event", "service", "action"];
export const stages = ["مصرف قطعه", "مونتاژ", "آزمون نهایی", "بسته‌بندی", "تحویل"];
export type Permissions = {flowRoles?: string[];read: Kind[]; write: Kind[]; eventStages: string[]; finance?: "none"|"read"|"write"};
export type Session = {username?:string;authType?:"password"|"chatgpt";userId: string; email: string; name: string; isAdmin: boolean; permissions: Permissions};
export type Member = {username?:string;id: string; email: string; name: string; unit: string; status: string; userId: string | null; permissions: Permissions; revision: number; created: string; updated: string};
export const allPermissions: Permissions = {flowRoles:["inventory","qc","production","procurement"],read: modules, write: modules, eventStages: stages, finance: "write"};
export const presets: Record<string, Permissions> = {
 "تأمین": {flowRoles:["procurement"],read:["batch"],write:[],eventStages:[]},
  "مالی": {read: [], write: [], eventStages: [], finance: "write"},
  "انبار": {flowRoles:["inventory"],read: ["batch"], write: ["batch"], eventStages: []},
  "تولید": {flowRoles:["production"],read: ["product", "batch", "device", "event"], write: ["device", "event"], eventStages: ["مصرف قطعه", "مونتاژ", "بسته‌بندی"]},
  "کنترل کیفیت": {flowRoles:["qc"],read: productionModules, write: ["batch", "event", "action"], eventStages: ["آزمون نهایی"]},
  "فروش و تحویل": {read: ["batch", "device", "event", "distribution"], write: ["event", "distribution"], eventStages: ["تحویل"]},
  "خدمات پس از فروش": {read: [...productionModules,"distribution"], write: ["service", "action"], eventStages: []},
  "مدیریت — فقط مشاهده": {read: modules, write: [], eventStages: []},
  "سفارشی": {read: [], write: [], eventStages: []},
  "مهندسی نرم‌افزار": {read: ["device", "firmware"], write: ["firmware"], eventStages: []},
};
export function validatePermissions(value: unknown): Permissions {
  const p = value as Permissions;
  if (!p || !Array.isArray(p.read) || !Array.isArray(p.write) || !Array.isArray(p.eventStages)) throw new Error("دسترسی‌ها معتبر نیستند.");
  if (p.read.some(k => !modules.includes(k)) || p.write.some(k => !modules.includes(k)) || p.eventStages.some(s => !stages.includes(s))) throw new Error("دسترسی ناشناخته است.");
  if (p.write.some(k => !p.read.includes(k))) throw new Error("ثبت اطلاعات به دسترسی مشاهده همان بخش نیاز دارد.");
  if (p.write.includes("event") && (!p.read.includes("device") || !p.read.includes("batch") || !p.eventStages.length)) throw new Error("ثبت رویداد به مشاهده دستگاه و بچ و انتخاب مرحله مجاز نیاز دارد.");
  if (p.write.includes("service") && (!p.read.includes("device") || !p.read.includes("batch"))) throw new Error("ثبت خدمات به مشاهده دستگاه و بچ نیاز دارد.");
  if (p.write.includes("action") && (!p.read.includes("device") || !p.read.includes("batch"))) throw new Error("ثبت اقدام اصلاحی به مشاهده دستگاه و بچ نیاز دارد.");
  if(p.read.includes("distribution")&&!p.read.includes("device"))throw new Error("مشاهده نماینده و مشتری به مشاهده دستگاه نیاز دارد.");
  if(p.finance!==undefined&&!(["none","read","write"] as unknown[]).includes(p.finance))throw new Error("دسترسی مالی معتبر نیست.");
  if(p.flowRoles!==undefined&&(!Array.isArray(p.flowRoles)||p.flowRoles.some(r=>!['inventory','qc','production','procurement'].includes(r))))throw new Error('نقش گردش مواد معتبر نیست.');
  return {flowRoles:[...new Set(p.flowRoles||[])],finance:p.finance||"none",read: [...new Set(p.read)], write: [...new Set(p.write)], eventStages: p.write.includes("event") ? [...new Set(p.eventStages)] : []};
}
