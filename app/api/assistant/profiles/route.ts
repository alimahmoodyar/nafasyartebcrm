import {assistantStorageError,type AssistantStage} from '@/lib/assistant-storage-errors';
import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
export async function GET(request?:Request){let stage:AssistantStage='auth';try{const user=await requireAccess();const expected=request?.headers.get('x-assistant-account');if(expected&&expected!==user.userId)throw new AccessError('حساب ورود تغییر کرده است؛ گفتگو را دوباره باز کنید.',409);
 stage='profiles';const profiles=(await storage().prepare('SELECT id,name,model FROM llm_configs ORDER BY name,id').all()).results;
 return Response.json({accountId:user.userId,profiles},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||accessResponse(assistantStorageError(e,{method:'GET',route:'/api/assistant/profiles',stage}))!}}
