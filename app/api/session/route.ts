import {runServiceRolePreview} from '@/lib/service-role-preview';
import {session, accessResponse} from "@/lib/authorization";
import {productionParticipant} from '@/lib/production-participant';
export async function GET() {
  try {const user=await session(true);return runServiceRolePreview(user,async position=>Response.json({...position,productionParticipant:position.mustChangePassword?false:await productionParticipant(position)}, {headers: {"Cache-Control": "no-store"}}));}
  catch (error) {console.error(error); return accessResponse(error) || Response.json({error: "بررسی دسترسی ممکن نشد؛ دوباره تلاش کنید."}, {status: 503});}
}
