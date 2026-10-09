import {requireAccess,accessResponse} from '@/lib/authorization';
import {need,req,past,warranty,visible,isAgent} from '@/lib/after-sales';
import {dayAt} from '@/lib/duties';
export async function GET(request:Request){try{
 const u=await requireAccess(),q=new URL(request.url).searchParams,domain=q.get('domain')||'home';
 const expected=request.headers.get('x-assistant-account');if(expected&&expected!==u.userId)return Response.json({error:'حساب ورود تغییر کرده است.'},{status:409,headers:{'Cache-Control':'no-store'}});
 need(u,domain,'support','intake','agent','coordinator');if(isAgent(u))await visible(u,{data:{domain,agentId:u.permissions.serviceAgentId}});
 const w=await warranty(req(q.get('serial'),160),past(q.get('day')||dayAt()));
 // Intake lookup reveals warranty only, never another customer's case or device history.
 const {serial,model,activatedAt,months,endsAt,state,checkedAt,remainingDays}=w;
 return Response.json({accountId:u.userId,warranty:{serial,model,activatedAt,months,endsAt,state,checkedAt,remainingDays},technicalCoverageApproved:false},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'استعلام گارانتی انجام نشد.'},{status:400,headers:{'Cache-Control':'no-store'}});}}
