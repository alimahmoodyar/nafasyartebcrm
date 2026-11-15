import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {customRead,customApply} from '@/lib/custom-production';
const json=(v:any)=>Response.json(v,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(request:Request){try{const q=new URL(request.url).searchParams;return json(await customRead(await requireAccess(),q.get('productId')||'',q.get('orderId')||''));}catch(e){return accessResponse(e)||Response.json({error:'دریافت تنظیمات تولید سفارشی ممکن نشد.'},{status:503});}}
export async function POST(request:Request){try{checkOrigin(request);return json(await customApply(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(request,180000)))));}catch(e){return accessResponse(e)||Response.json({error:e instanceof Error?e.message:'ثبت انجام نشد.'},{status:400});}}
