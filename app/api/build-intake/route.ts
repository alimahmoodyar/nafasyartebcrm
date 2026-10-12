import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {buildIntakeRead,buildIntakeApply} from '@/lib/build-intake';
const json=(value:any)=>Response.json(value,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(){try{return json(await buildIntakeRead(await requireAccess()));}catch(e){return accessResponse(e)||Response.json({error:'دریافت سفارش‌های ساخت ممکن نشد.'},{status:503});}}
export async function POST(request:Request){try{checkOrigin(request);const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,160000)));return json(await buildIntakeApply(await requireAccess(),b));}catch(e){return accessResponse(e)||Response.json({error:'ثبت انجام نشد؛ نسخه و دسترسی را بررسی و تازه‌سازی کنید.'},{status:409});}}
