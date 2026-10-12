import {validatePermissions} from './permissions';
// Base personnel identity is not an employment contract or a grant of HR access.
export const personnelSetupFields=['code','unit','title','location','employment','managerId','start','leaveMinutes'] as const;
function objectPermissions(value:unknown):Record<string,any>|null{try{const p=typeof value==='string'?JSON.parse(value):value;return p&&typeof p==='object'&&!Array.isArray(p)?p:null;}catch{return null;}}
export function personnelStaff(member:any){
 const raw=objectPermissions(member?.permissions);if(member?.status!=='active'||!raw)return false;let p=raw;if(raw.roleAssignment!==undefined){try{p=validatePermissions(raw as any)}catch{return false}};
 if(p.salesAgentId||p.serviceAgentId||p.hospitalCenterId)return false;
 for(const key of ['salesRoles','serviceRoles'])if(p[key]!==undefined&&(!Array.isArray(p[key])||p[key].includes('agent')))return false;
 if(p.roleAssignment!==undefined){const assignment=objectPermissions(p.roleAssignment);if(!assignment||!Array.isArray(assignment.roles)||assignment.roles.some((role:any)=>['sales_agent','service_agent'].includes(role)))return false;}
 return true;
}
export const personnelProfileId=(memberId:string)=>'hr-profile:'+memberId;
export function personnelProfileMissing(data:any){return personnelSetupFields.filter(key=>key==='leaveMinutes'?!Number.isSafeInteger(data?.[key])||data[key]<0:typeof data?.[key]!=='string'||!data[key].trim());}
export function personnelBaseProfile(member:{id:string;name:string},actor:{userId:string;name?:string},now:string){
 return {memberId:member.id,name:member.name,state:'setup',setupMissing:[...personnelSetupFields],createdBy:actor.userId,createdAt:now,history:[{mode:'profile_setup',at:now,actor:actor.userId,name:actor.name||'',notes:'ایجاد پروندهٔ پایه از حساب کارکنان؛ اطلاعات همکاری باید توسط اداری تکمیل شود.',state:'setup'}]};
}
export function personnelProfileStatements(db:D1Database,member:any,actor:{userId:string;name?:string},now:string){
 if(!personnelStaff(member))return [];
 const id=personnelProfileId(member.id),data=personnelBaseProfile(member,actor,now);
 return [
  db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'hr_employee',?,1,?,?)").bind(id,JSON.stringify(data),now,now),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,id,'personnel_profile_setup',JSON.stringify({memberId:member.id,state:'setup',setupMissing:data.setupMissing,source:'create_member'}),now)
 ];
}
