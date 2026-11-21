import {storage} from '@/lib/storage';
import {memberId} from '@/lib/duties';
import {runServiceRolePreview} from '@/lib/service-role-preview';
import {session, accessResponse} from "@/lib/authorization";
import {productionParticipant} from '@/lib/production-participant';
export async function GET() {
  try {const user=await session(true);let assignedProfileIds:string[]=[];if(!user.mustChangePassword&&!user.profileReview){const mid=await memberId(user);if(mid){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='member_role_assignment'").bind('member-role-assignment:'+mid).first();assignedProfileIds=row?JSON.parse(row.data).bindings.map((b:any)=>b.profileId):[];}}return runServiceRolePreview(user,async position=>Response.json({...position,assignedProfileIds,productionParticipant:position.mustChangePassword?false:await productionParticipant(position)}, {headers: {"Cache-Control": "no-store"}}));}
  catch (error) {console.error(error); return accessResponse(error) || Response.json({error: "بررسی دسترسی ممکن نشد؛ دوباره تلاش کنید."}, {status: 503});}
}
