import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {readSalesCalls,writeSalesCall} from '@/lib/sales-calls';
import {syncLeadTasks} from '@/lib/sales-lead-tasks';
import {syncSalesTasks} from '@/lib/sales-tasks';

export async function GET(){
 try{return Response.json(await readSalesCalls(await requireAccess()),{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){return accessResponse(e)||Response.json({error:'دریافت تماس‌ها انجام نشد.'},{status:503});}
}

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,16000)));
  const result=await writeSalesCall(await requireAccess(),body);
  const followupPending=await Promise.allSettled([syncSalesTasks(),syncLeadTasks()]).then(results=>results.some(r=>r.status==='rejected'));
  return Response.json({...result,followupPending});
 }catch(e){return accessResponse(e)||Response.json({error:'ثبت تماس انجام نشد. دوباره تلاش کنید.'},{status:409});}
}
