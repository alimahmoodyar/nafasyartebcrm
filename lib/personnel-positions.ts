import {storage} from './storage';

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
