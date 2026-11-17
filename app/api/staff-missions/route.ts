import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {missionRead,applyStaffMission} from '@/lib/staff-missions';
import {syncStaffMissionTasks} from '@/lib/staff-mission-tasks';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{const u=await requireAccess();return Response.json(await missionRead(u,new URL(request.url).searchParams),{headers})}catch(e){return accessResponse(e)||Response.json({error:'دریافت مأموریت‌ها انجام نشد.'},{status:503,headers})}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,150000))),result=await applyStaffMission(u,b);let followupPending=false;try{await syncStaffMissionTasks(result.id)}catch{followupPending=true}return Response.json({...result,followupPending},{headers})}catch(e){return accessResponse(e)||Response.json({error:'ثبت انجام نشد؛ وضعیت را تازه کنید و با همان درخواست دوباره تلاش کنید.'},{status:409,headers})}}
