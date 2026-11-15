import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {projectDailyRead,projectDailyApply} from '@/lib/project-daily-work';
import {boundedBody} from '@/lib/firmware-storage';
const json=(v:any)=>Response.json(v,{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
export async function GET(r?:Request){try{const q=r?new URL(r.url).searchParams:new URLSearchParams();return json(await projectDailyRead(await requireAccess(),q.get('projectId')||'',Number(q.get('page')||0)));}catch(e){return accessResponse(e)||Response.json({error:(e as Error).message},{status:400});}}
export async function POST(r:Request){try{checkOrigin(r);return json(await projectDailyApply(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,30000)))));}catch(e){return accessResponse(e)||Response.json({error:(e as Error).message},{status:400});}}
