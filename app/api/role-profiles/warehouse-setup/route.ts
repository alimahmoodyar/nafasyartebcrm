import {requireProfileAdmin,accessResponse} from '@/lib/authorization';
// Retired: warehouse maintenance belongs to the existing shared warehouse module.
async function retired(){try{await requireProfileAdmin();return Response.json({error:'تنظیم انبار جداگانه حذف شده است؛ از مدیریت انبارهای موجود سامانه استفاده کنید.'},{status:410,headers:{'Cache-Control':'no-store'}})}catch(error){return accessResponse(error)||Response.json({error:'دسترسی مجاز نیست.'},{status:403})}}
export const GET=retired;
export const POST=retired;
