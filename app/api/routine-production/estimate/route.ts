import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {routineRoles} from '@/lib/routine-production';
import {trainingContext} from '@/lib/training-context';
import {routineSource,routinePreview} from '../route';
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();if(!routineRoles(u).foreman||trainingContext.getStore())throw new AccessError('محاسبه برنامه فقط برای مسئول تولید در اطلاعات شرکت است.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,30000)));
 let result;try{result=await routinePreview(b,await routineSource());}catch(e){throw new AccessError(e instanceof Error?e.message:'محاسبه ظرفیت ممکن نشد.',400);}
 return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'محاسبه ظرفیت ممکن نشد.'},{status:503});}}
