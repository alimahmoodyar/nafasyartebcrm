import {assistantProfiles} from '@/lib/assistant-profiles';
import {assistantStorageError,type AssistantStage} from '@/lib/assistant-storage-errors';
import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
export async function GET(request?:Request){let admin=false;let stage:AssistantStage='auth';try{const user=await requireAccess();admin=user.isAdmin;const expected=request?.headers.get('x-assistant-account');if(expected&&expected!==user.userId)throw new AccessError('حساب ورود تغییر کرده است؛ گفتگو را دوباره باز کنید.',409);
 stage='profiles';const catalog=await assistantProfiles();
 return Response.json({accountId:user.userId,...catalog},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||accessResponse(assistantStorageError(e,{method:'GET',route:'/api/assistant/profiles',stage},{admin}))!}}
