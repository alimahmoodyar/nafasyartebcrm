import {requireProfileAdmin,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {trainingContext} from '@/lib/training-context';
import {seedTraining} from '@/lib/training-seed';
import {mcpActor} from '@/lib/mcp/context';
import * as flow from '@/app/api/flow/route';

// Administrator setup uses the existing warehouse form/handler, in isolated storage only.
async function run(request?:Request){try{
 const owner=await requireProfileAdmin();
 if(request){checkOrigin(request);const body=await request.clone().json() as any;if(body.mode!=='warehouse')throw new AccessError('این ورودی فقط برای تنظیم انبار محیط آزمون است.',403);}
 return await trainingContext.run({actor:owner.userId,role:'warehouse-scenario-setup'},async()=>{
  await seedTraining(owner.userId);
  return mcpActor.run(owner,async()=>{const response=request?await flow.POST(request):await flow.GET();response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Service-Role-Preview','isolated');return response;});
 });
 }catch(error){return accessResponse(error)||Response.json({error:'تنظیم انبار آزمایشی انجام نشد.'},{status:400});}}
export const GET=()=>run();
export const POST=(request:Request)=>run(request);
