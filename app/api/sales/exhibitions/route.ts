import {AccessError,accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {leadActor,leadEligible,leadMembers} from '@/lib/sales-leads';
import {storage} from '@/lib/storage';
import {readVisits,saveVisit} from '@/lib/exhibition-visits';

async function context(){
 const user=await requireAccess();
 if(user.rolePreview||user.profileReview)throw new AccessError('با حساب کارشناس وارد شوید.',403);
 const members=await leadMembers(), actor=await leadActor(user,members);
 return {actor:{...actor,id:actor.id||user.userId},members:members.filter(leadEligible).map(m=>({id:m.id,name:m.name}))};
}
const fail=(e:unknown)=>accessResponse(e)||Response.json({error:'دسترسی به بازدیدهای نمایشگاه ممکن نشد.'},{status:503});
export async function GET(req:Request){
 try{const {actor,members}=await context();return Response.json({...await readVisits(storage(),actor,new URL(req.url).searchParams.get('event')?.trim()||''),members,me:actor.id},{headers:{'Cache-Control':'private, no-store'}})}catch(e){return fail(e)}
}
export async function POST(req:Request){
 try{checkOrigin(req);const {actor,members}=await context();const b=JSON.parse(new TextDecoder().decode(await boundedBody(req,20000)));if(!b.revision&&!(await readVisits(storage(),actor,b.event)).visits?.length)throw new AccessError('رویداد تازه را از «رویدادهای من» تعریف کنید.',403);return Response.json(await saveVisit(storage(),actor,b,members.map(m=>m.id)))}catch(e){return fail(e)}
}
