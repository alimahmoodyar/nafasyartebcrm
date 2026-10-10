import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {getServices,applyService} from '@/lib/purchase-services';
import {boundedBody} from '@/lib/firmware-storage';
const json=(v:any,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(){try{return json(await getServices(await requireAccess()));}catch(e){return accessResponse(e)||json({error:'دریافت تعهدات خرید ممکن نشد.'},503);}}
export async function POST(r:Request){try{checkOrigin(r);return json(await applyService(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,100000)))));}catch(e){return accessResponse(e)||json({error:'ثبت تأیید نشد؛ وضعیت و نسخه را تازه کنید.'},409);}}
