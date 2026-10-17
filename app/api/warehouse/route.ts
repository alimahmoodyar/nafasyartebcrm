import {requireAccess,accessResponse,AccessError} from '@/lib/authorization';
import {canOpenSection,warehouseNavigation} from '@/lib/navigation-access';
import {warehouseGroupTitles} from '@/lib/warehouse-workspace';
export async function GET(request?:Request){try{
 const user=await requireAccess();
 if(!canOpenSection(user,'warehouse'))throw new AccessError('دسترسی انبار برای این حساب تعریف نشده است.',403);
 const expected=request?.headers.get('x-assistant-account');
 if(expected&&expected!==user.userId)throw new AccessError('حساب ورود تغییر کرده است.',409);
 const menu=warehouseNavigation(user);
 return Response.json({accountId:user.userId,section:'warehouse',groups:Object.entries(menu).filter(([,items])=>items.length).map(([key,items])=>({key,title:warehouseGroupTitles[key],items})),notice:'این صفحه فقط مسیر عملیات مجاز فعلی را جمع می‌کند. موجودی یا دسترسی تازه ایجاد نمی‌کند؛ هر عملیات از همان ابزار و تأیید فعلی انجام می‌شود.'},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'فهرست کارهای انبار دریافت نشد.'},{status:503})}}
