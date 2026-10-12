import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {getPricing,applyPricing} from '@/lib/pricing';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(r?:Request){try{return json(await getPricing(await requireAccess(),r?new URL(r.url).searchParams.get('effectiveFrom')||'':''));}catch(e){return accessResponse(e)||json({error:'دریافت پیشنهاد قیمت ممکن نشد.'},503);}}
export async function POST(r:Request){try{checkOrigin(r);return json(await applyPricing(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,32000)))));}catch(e){return accessResponse(e)||json({error:'ثبت قیمت تأیید نشد؛ منابع یا دسترسی تغییر کرده‌اند. تازه‌سازی کنید.'},409);}}
