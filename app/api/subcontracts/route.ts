import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {subcontractView,applySubcontract} from '@/lib/subcontract';
export async function GET(r:Request){try{return Response.json(await subcontractView(await requireAccess(),new URL(r.url).searchParams.get('id')||''),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'خواندن پرونده ممکن نشد.'},{status:503});}}
export async function POST(r:Request){try{checkOrigin(r);return Response.json(await applySubcontract(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,100000)))));}catch(e){return accessResponse(e)||Response.json({error:'ثبت قطعی نشد؛ وضعیت را بازخوانی کنید.'},{status:409});}}
