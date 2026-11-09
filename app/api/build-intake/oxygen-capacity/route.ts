import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {buildIntakeRoles} from '@/lib/build-intake-access';
import {estimateHospitalOxygen} from '@/lib/hospital-oxygen';

export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  checkOrigin(request);
  const roles=buildIntakeRoles(await requireAccess());
  if(!roles.sales&&!roles.engineering)throw new AccessError('دسترسی ظرفیت‌سنجی برای فروش و مهندسی سفارش ساخت است.',403);
  const bytes=await boundedBody(request,32000);
  try{
   const input=JSON.parse(new TextDecoder().decode(bytes));
   return Response.json(estimateHospitalOxygen(input),{headers});
  }catch(error){
   return Response.json({error:error instanceof SyntaxError?'ورودی محاسبه معتبر نیست.':(error as Error).message},{status:400,headers});
  }
 }catch(error){
  return accessResponse(error)||Response.json({error:'محاسبه انجام نشد.'},{status:503,headers});
 }
}
