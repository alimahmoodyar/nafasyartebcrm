import {trainingContext} from './training-context';
import {seedTraining} from './training-seed';
import {mcpActor} from './mcp/context';
import {session,accessResponse} from './authorization';
import type {Session} from './permissions';
export const servicePreviewAgent='training-service-agent-1';
const profiles=new Set(['home-service-representative','home-service','home-service-manager','ceo','finance-director']);
export const serviceRolePreview=(u:Session)=>!!u.profileReview&&profiles.has(u.profileReview.id)&&(u.profileReview.id!=='home-service-representative'||!u.profileReview.buyerId||u.profileReview.buyerId===servicePreviewAgent);
/** Role-only scenario: actual tester remains the actor; no company account or person is assigned. */
export async function runServiceRolePreview<T>(u:Session,work:()=>Promise<T>):Promise<T>{
 if(trainingContext.getStore()||!serviceRolePreview(u))return work();
 return trainingContext.run({actor:u.userId,role:u.profileReview!.id},async()=>{await seedTraining(u.userId);return mcpActor.run(u,work)});
}
export function withServiceRolePreview<T extends Request|undefined>(handler:(r:T)=>Promise<Response>){return async(r:T)=>{try{const u=await session();return await runServiceRolePreview(u,async()=>{const response=await handler(r);if(serviceRolePreview(u)){response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Service-Role-Preview','isolated')}return response})}catch(e){return accessResponse(e)||Response.json({error:'آماده‌سازی آزمون نقش خدمات انجام نشد.'},{status:503,headers:{'Cache-Control':'no-store'}})}}}
