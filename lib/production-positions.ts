// A production position is a work/custody address, not a login or person.
// Plans may use it before an employee is assigned. Actual actors stay authenticated.
export function productionPositions(entities:any[]){return entities.filter(e=>e.type==='production_position'&&e.data.active===true).map(e=>({id:e.id,name:e.data.title,status:'active',subject:null,positionRevision:e.revision,permissions:JSON.stringify({read:[],write:[],eventStages:[],roleAssignment:{roles:['production_worker']}})}));}
export function productionMemberGuard(member:any):[string,...any[]]{return member.positionRevision!==undefined?["EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='production_position' AND revision=? AND json_extract(data,'$.active')=1)",member.id,member.positionRevision]:["EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=? AND name=?)",member.id,member.permissions,member.name];}
export const workerStock=(positionId:string)=>'worker:'+positionId;
