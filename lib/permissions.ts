import type {Kind} from "./model";

export const modules: Kind[] = ["batch", "device", "event", "service", "action"];
export const stages = ["مصرف قطعه", "مونتاژ", "آزمون نهایی", "بسته‌بندی", "تحویل"];
export type Permissions = {read: Kind[]; write: Kind[]; eventStages: string[]};
export type Session = {userId: string; email: string; name: string; isAdmin: boolean; permissions: Permissions};
export type Member = {id: string; email: string; name: string; unit: string; status: string; userId: string | null; permissions: Permissions; revision: number; created: string; updated: string};
export const allPermissions: Permissions = {read: modules, write: modules, eventStages: stages};
export const presets: Record<string, Permissions> = {
  "انبار": {read: ["batch"], write: ["batch"], eventStages: []},
  "تولید": {read: ["batch", "device", "event"], write: ["device", "event"], eventStages: ["مصرف قطعه", "مونتاژ", "بسته‌بندی"]},
  "کنترل کیفیت": {read: modules, write: ["batch", "event", "action"], eventStages: ["آزمون نهایی"]},
  "فروش و تحویل": {read: ["batch", "device", "event"], write: ["event"], eventStages: ["تحویل"]},
  "خدمات پس از فروش": {read: modules, write: ["service", "action"], eventStages: []},
  "مدیریت — فقط مشاهده": {read: modules, write: [], eventStages: []},
  "سفارشی": {read: [], write: [], eventStages: []},
};
export function validatePermissions(value: unknown): Permissions {
  const p = value as Permissions;
  if (!p || !Array.isArray(p.read) || !Array.isArray(p.write) || !Array.isArray(p.eventStages)) throw new Error("دسترسی‌ها معتبر نیستند.");
  if (p.read.some(k => !modules.includes(k)) || p.write.some(k => !modules.includes(k)) || p.eventStages.some(s => !stages.includes(s))) throw new Error("دسترسی ناشناخته است.");
  if (p.write.some(k => !p.read.includes(k))) throw new Error("ثبت اطلاعات به دسترسی مشاهده همان بخش نیاز دارد.");
  if (p.write.includes("event") && (!p.read.includes("device") || !p.read.includes("batch") || !p.eventStages.length)) throw new Error("ثبت رویداد به مشاهده دستگاه و بچ و انتخاب مرحله مجاز نیاز دارد.");
  if (p.write.includes("service") && (!p.read.includes("device") || !p.read.includes("batch"))) throw new Error("ثبت خدمات به مشاهده دستگاه و بچ نیاز دارد.");
  if (p.write.includes("action") && (!p.read.includes("device") || !p.read.includes("batch"))) throw new Error("ثبت اقدام اصلاحی به مشاهده دستگاه و بچ نیاز دارد.");
  return {read: [...new Set(p.read)], write: [...new Set(p.write)], eventStages: p.write.includes("event") ? [...new Set(p.eventStages)] : []};
}
