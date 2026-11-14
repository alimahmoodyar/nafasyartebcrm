import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {issueTransportLink} from '@/lib/transport-external';
export async function POST(r:Request){try{checkOrigin(r);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(r,10000)));return Response.json(await issueTransportLink(u,b,new URL(r.url).origin),{headers:{'Cache-Control':'no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'صدور لینک انجام نشد؛ وضعیت حمل را بررسی کنید.'},{status:409});}}
