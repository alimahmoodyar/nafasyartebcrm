import {unassignedServiceProfileId} from './service-profile-scope';
import {profileExecutionContext} from './profile-execution-context';
import {profileSession} from './profile-review';
import {mcpActor} from './mcp/context';
import {session,accessResponse} from './authorization';
import type {Session} from './permissions';
import {storage} from './storage';
// An unbound profile has no matching record; entering it never seeds data.
export const servicePreviewAgent=unassignedServiceProfileId;
const profiles=new Set(['home-service-customer-support','home-service-technician','home-service-intake','home-service-representative','home-service','home-service-manager','ceo','finance-director','central-store','technical','quality','logistics']);
export const serviceRolePreview=(u:Session)=>!!u.profileReview&&profiles.has(u.profileReview.id);
/** Preview changes position grants, never the application's data source.
 * The authenticated administrator remains the audit actor.
 */
export async function runServiceRolePreview<T>(u:Session,work:(position:Session)=>Promise<T>):Promise<T>{
 if(!serviceRolePreview(u))return work(u);
 const db=storage();let position=u;
 if(['central-store','technical','quality','logistics'].includes(u.profileReview!.id)){
  const warehouses=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='material_warehouse'").all()).results.map((w:any)=>({...w,data:JSON.parse(w.data)}));
  position=profileSession({...u,isAdmin:true},u.profileReview!.id,warehouses);
 }
 if(u.profileReview!.id==='home-service-representative'){
  const selected=u.profileReview!.buyerId;
  // Explicit scopes stay fixed. Only the admin's unbound role preview follows
  // the most recently created active representative in shared application data.
  const unbound=!selected||selected===servicePreviewAgent||selected==='training-service-agent-1';
  const agent:any=unbound
   ?await db.prepare("SELECT id FROM flow_entities WHERE type='as_agent' AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.active')=1 ORDER BY created DESC,id LIMIT 1").first()
   :await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='as_agent' AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.active')=1").bind(selected).first();
  const agentId=agent?.id||servicePreviewAgent;
  position={...u,permissions:{...u.permissions,serviceAgentId:agentId},profileReview:{...u.profileReview!,buyerId:agentId}};
 }
 return profileExecutionContext.run({actor:u.userId,profileId:u.profileReview!.id},()=>mcpActor.run(position,()=>work(position)));
}
export function withServiceRolePreview<T extends Request|undefined>(handler:(r:T)=>Promise<Response>){return async(r?:T)=>{try{const u=await session();return await runServiceRolePreview(u,async()=>{const response=await handler(r as T);if(serviceRolePreview(u)){response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Service-Role-Preview','shared')}return response})}catch(e){return accessResponse(e)||Response.json({error:'دریافت پروفایل خدمات انجام نشد.'},{status:503,headers:{'Cache-Control':'no-store'}})}}}
