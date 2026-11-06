import {storage} from './storage';
import {productionEligible} from './production-people';
import type {Session} from './permissions';

// A participant receives only an entry point to existing own-job handlers.
// No stored role, permission, planning right or HR data is added to the session.
export async function productionParticipant(user:Session){
 if(user.profileReview)return false;
 if(user.permissions.salesAgentId||user.permissions.serviceAgentId||user.permissions.hospitalCenterId)return false;
 const id=user.userId.startsWith('local:')?user.userId.slice(6):user.userId,db=storage();
 const member:any=await db.prepare("SELECT id,name,status,permissions FROM app_members WHERE status='active' AND (id=? OR subject=?)").bind(id,user.userId).first();
 if(!member)return false;
 const raw:any=await db.prepare("SELECT data FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=?").bind(member.id).first();
 return productionEligible(member,raw?[{type:'hr_employee',data:JSON.parse(raw.data)}]:[]);
}
