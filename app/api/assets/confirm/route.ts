import {checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {useAssetLink} from '@/lib/asset-links';
export async function POST(request:Request){try{checkOrigin(request);const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,30000)));return Response.json(await useAssetLink(b),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}catch(e){return accessResponse(e)||Response.json({error:'درخواست قطعی نشد؛ دوباره وضعیت را بررسی کنید.'},{status:409,headers:{'Cache-Control':'no-store'}});}}
