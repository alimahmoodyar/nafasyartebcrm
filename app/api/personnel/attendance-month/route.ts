import {accessResponse,requireAccess} from '@/lib/authorization';
import {dayAt} from '@/lib/duties';
import {hrActor} from '@/lib/personnel';
import {attendanceMonth} from '@/lib/personnel-attendance-month';
export async function GET(request:Request){
 try{
  const actor=await hrActor(await requireAccess()),today=dayAt();
  const result=await attendanceMonth(actor.id,new URL(request.url).searchParams.get('month')||today,today);
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت کارکرد ممکن نشد.'},{status:503})}
}
