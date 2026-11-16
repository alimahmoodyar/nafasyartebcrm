import {requireAccess,accessResponse} from '@/lib/authorization';
import {assetPersonView} from '@/lib/asset-person';
export async function GET(request:Request){try{return Response.json(await assetPersonView(await requireAccess(),new URL(request.url).searchParams),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})}catch(e){return accessResponse(e)||Response.json({error:'دریافت فهرست شخص و اموال ممکن نشد.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}}
