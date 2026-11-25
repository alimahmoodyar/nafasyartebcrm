import {accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {supplierImport} from '@/lib/supplier-import';

const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await requireAccess();
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,1800000)));
  return Response.json(await supplierImport(user,body),{headers});
 }catch(error){
  const message=String(error);
  return accessResponse(error)||Response.json({error:'اطلاعات ورود تغییر کرد یا ثبت کامل نشد. دوباره پیش‌نمایش بگیرید.'},{status:/guard|constraint|UNIQUE/i.test(message)?409:error instanceof SyntaxError?400:503,headers});
 }
}
