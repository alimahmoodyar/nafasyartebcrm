import {accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {deskActor,deskRead,deskWrite} from '@/lib/event-desk';
const failure=(e:unknown)=>accessResponse(e)||Response.json({error:'عملیات رویداد انجام نشد. فهرست را تازه کنید.'},{status:409});
export async function GET(req:Request){try{return Response.json(await deskRead(await deskActor(await requireAccess()),new URL(req.url).searchParams),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return failure(e)}}
export async function POST(req:Request){try{checkOrigin(req);const u=await requireAccess();return Response.json(await deskWrite(u,await deskActor(u),JSON.parse(new TextDecoder().decode(await boundedBody(req,250000)))))}catch(e){return failure(e)}}
