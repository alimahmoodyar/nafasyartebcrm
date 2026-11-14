import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {employeePurchases,applyEmployeePurchase} from '@/lib/employee-purchases';
export async function GET(r:Request){try{const q=new URL(r.url).searchParams;return Response.json(await employeePurchases(await requireAccess(),Number(q.get('page')||0),q.get('search')||''),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'دریافت درخواست‌ها ممکن نشد.'},{status:503});}}
export async function POST(r:Request){try{checkOrigin(r);return Response.json(await applyEmployeePurchase(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,20000)))));}catch(e){return accessResponse(e)||Response.json({error:'ثبت تأیید نشد؛ وضعیت را بازخوانی کنید.'},{status:409});}}
