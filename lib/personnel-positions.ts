import {storage} from './storage';
import {jobRoles} from './permissions';

export type OwnJobResponsibility={id:string;name:string;group:string;responsibilities:string};

// Use only explicit assignments, never infer a job from effective permissions.
// The catalogue contains grants and scopes that do not belong in a self-service view.
export function ownJobResponsibilities(permissions:unknown):OwnJobResponsibility[]{
 let parsed:unknown=permissions;
 if(typeof parsed==='string'){try{parsed=JSON.parse(parsed);}catch{return [];}}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return [];
 const assignment=(parsed as {roleAssignment?:unknown}).roleAssignment;
 if(!assignment||typeof assignment!=='object'||Array.isArray(assignment))return [];
 const roles=(assignment as {roles?:unknown}).roles;
 if(!Array.isArray(roles)||roles.some(id=>typeof id!=='string'))return [];
 return [...new Set<string>(roles)].flatMap(id=>{
  const role=jobRoles.find(r=>r.id===id);
  return role?[{id:role.id,name:role.label,group:role.group,responsibilities:role.actions}]:[];
 });
}

// Only the authenticated employee's assignments; no membership or supervisor data.
export function ownPositionProfiles(rows:any[], memberId:string){
 const positions=rows.filter(r=>r.type==='position'&&r.data.active&&memberId&&Array.isArray(r.data.members)&&r.data.members.includes(memberId));
 return positions.map(r=>({id:r.id,name:r.data.name,unit:r.data.unit,
  mission:r.data.mission,responsibilities:r.data.responsibilities,authorityBoundaries:r.data.authorityBoundaries,
  reportingTo:r.data.reportingTo,handoffs:r.data.handoffs,metrics:r.data.metrics,
  tasks:rows.filter(t=>t.type==='duty_template'&&t.data.positionId===r.id&&t.data.active).map(t=>({title:t.data.title,instructions:t.data.instructions}))}));
}
export async function personnelPositions(memberId:string){
 const rows=(await storage().prepare("SELECT id,type,data FROM flow_entities WHERE type IN ('position','duty_template')").all()).results;
 return ownPositionProfiles(rows.flatMap((r:any)=>{try{const data=typeof r.data==='string'?JSON.parse(r.data):r.data;return data&&typeof data==='object'&&!Array.isArray(data)?[{...r,data}]:[];}catch{return [];}}),memberId);
}
