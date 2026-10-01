import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
export async function GET(request?:Request){try{const user=await requireAccess();const expected=request?.headers.get('x-assistant-account');if(expected&&expected!==user.userId)throw new AccessError('حساب ورود تغییر کرده است؛ گفتگو را دوباره باز کنید.',409);
 const profiles=(await storage().prepare('SELECT id,name,model FROM llm_configs ORDER BY name,id').all()).results;
 return Response.json({accountId:user.userId,profiles},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'فهرست مدل‌های ذخیره‌شده از این سرور دریافت نشد.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
