import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {flowRole} from '@/lib/material-flow';
import {boundedBody} from '@/lib/firmware-storage';
import {trainingContext} from '@/lib/training-context';
import {finishedPreview} from '@/lib/finished-planning';
import {routineSource} from '../../routine-production/route';
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();if(!flowRole(u,'production')||trainingContext.getStore())throw new AccessError('محاسبه برنامه به دسترسی تولید در اطلاعات شرکت نیاز دارد.',403);
 const input=JSON.parse(new TextDecoder().decode(await boundedBody(request,30000)));
 let result;try{result=await finishedPreview(input,await routineSource());}catch(e){throw new AccessError(e instanceof Error?e.message:'ورودی برنامه معتبر نیست.',400);}
 return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'محاسبه برنامه ممکن نشد.'},{status:503});}}
