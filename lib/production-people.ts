import {storedAccessPermissions,jobRoles} from './permissions';
import {personnelStaff} from './personnel-profile';

export function productionPeopleProfile(member:any,entities:any[]){return entities.find(e=>e.type==='hr_employee'&&e.data.memberId===member?.id)?.data;}
export function productionRoleDefault(member:any){
 const p=storedAccessPermissions(member?.permissions),roles=p.roleAssignment?.roles;
 return roles?roles.some(r=>r==='production'||r==='production_worker'):!!p.flowRoles?.includes('production');
}
// This selects operational participants; it never grants planning/HR/QC rights.
export function productionEligible(member:any,entities:any[],start?:string,end=start){
 if(!personnelStaff(member))return false;
 const profile=productionPeopleProfile(member,entities);
 if(profile&&['disabled','draft'].includes(profile.state))return false;
 if(start&&profile?.start&&start<profile.start||end&&profile?.end&&end>profile.end)return false;
 return profile&&Object.hasOwn(profile,'productionEligible')?profile.productionEligible===true:productionRoleDefault(member);
}
export function productionPerson(member:any,entities:any[]){
 const p=storedAccessPermissions(member.permissions),profile=productionPeopleProfile(member,entities);
 return {id:member.id,name:member.name,title:profile?.title||jobRoles.find(r=>p.roleAssignment?.roles.includes(r.id)&&(r.id==='production'||r.id==='production_worker'))?.label||(p.flowRoles?.includes('production')?'مسئول تولید':''),productionEligible:productionEligible(member,entities)};
}
