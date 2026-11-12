import {profileSession} from './profile-review';
import {trainingContext} from './training-context';
import {seedTraining} from './training-seed';
import {mcpActor} from './mcp/context';
import {session,accessResponse} from './authorization';
import type {Session} from './permissions';
import {storage} from './storage';
export const servicePreviewAgent='training-service-agent-1';
const profiles=new Set(['home-service-representative','home-service','home-service-manager','ceo','finance-director','central-store','technical','quality','logistics']);
export const serviceRolePreview=(u:Session)=>!!u.profileReview&&profiles.has(u.profileReview.id)&&(u.profileReview.id!=='home-service-representative'||!u.profileReview.buyerId||u.profileReview.buyerId===servicePreviewAgent);
/** Role-only scenario: actual tester remains the actor; no company account or person is assigned. */
export async function runServiceRolePreview<T>(u:Session,work:(position:Session)=>Promise<T>):Promise<T>{
 if(trainingContext.getStore()||!serviceRolePreview(u))return work(u);
 return trainingContext.run({actor:u.userId,role:u.profileReview!.id},async()=>{await seedTraining(u.userId);const db=storage(),id='training-service-bank-account',exists=await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(id).first();if(!exists){const now=new Date().toISOString();await db.batch([db.prepare("INSERT OR IGNORE INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'treasury_account',?,1,?,?)").bind(id,JSON.stringify({title:'حساب فرضی خدمات — فقط آزمون',number:'TEST-ONLY',kind:'bank',currency:'IRR',state:'active'}),now,now),db.prepare("UPDATE flow_entities SET data=json_set(data,'$.receivingAccountIds',json_array(?)),revision=revision+1,updated=? WHERE id=? AND COALESCE(json_array_length(json_extract(data,'$.receivingAccountIds')),0)=0").bind(id,now,servicePreviewAgent),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'training_service_payment_setup','{"isolated":true}',now)]);}const scenario:any=await db.prepare("SELECT json_extract(data,'$.activeServiceAgentId') AS agentId FROM flow_entities WHERE id='training-base'").first();let position=u;
 if(['central-store','technical','quality','logistics'].includes(u.profileReview!.id)){const warehouses=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='material_warehouse'").all()).results.map((w:any)=>({...w,data:JSON.parse(w.data)}));position=profileSession({...u,isAdmin:true},u.profileReview!.id,warehouses);}

 if(u.profileReview?.id==='home-service-representative'&&scenario?.agentId){const valid=await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='as_agent' AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.active')=1").bind(scenario.agentId).first();if(valid)position={...u,permissions:{...u.permissions,serviceAgentId:scenario.agentId},profileReview:{...u.profileReview,buyerId:scenario.agentId}};}
 return mcpActor.run(position,()=>work(position))});
}
export function withServiceRolePreview<T extends Request|undefined>(handler:(r:T)=>Promise<Response>){return async(r?:T)=>{try{const u=await session();return await runServiceRolePreview(u,async()=>{const response=await handler(r as T);if(serviceRolePreview(u)){response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Service-Role-Preview','isolated')}return response})}catch(e){return accessResponse(e)||Response.json({error:'آماده‌سازی آزمون نقش خدمات انجام نشد.'},{status:503,headers:{'Cache-Control':'no-store'}})}}}
