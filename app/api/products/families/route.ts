import {requireAccess,accessResponse,AccessError} from '@/lib/authorization';
import {productFamilyCatalog} from '@/lib/product-family-catalog';
export async function GET(request?:Request){try{
 const user=await requireAccess('product','read'),expected=request?.headers.get('x-assistant-account');
 if(expected&&expected!==user.userId)throw new AccessError('حساب ورود تغییر کرده است.',409);
 return Response.json({accountId:user.userId,families:await productFamilyCatalog()},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
}catch(e){return accessResponse(e)||Response.json({error:'فهرست خانواده‌های محصول دریافت نشد.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
