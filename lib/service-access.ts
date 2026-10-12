import type {Session} from './permissions';
import {serviceDomains} from './after-sales-labels';

// Shared by service pages and authenticated domain handlers. Navigation must not
// infer permissions from whether a business-data request has succeeded.
export const isAgent=(u:Session)=>!u.isAdmin&&!!u.permissions.serviceAgentId;
export const role=(u:Session,r:string)=>u.isAdmin||!!u.permissions.serviceRoles?.includes(r)||!isAgent(u)&&!!u.permissions.serviceRoles?.includes('manager');
const internal=(u:Session)=>!u.permissions.hospitalCenterId&&!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.salesRoles?.includes('agent')&&!u.permissions.serviceRoles?.includes('agent');
// Supervisory visibility is derived at runtime, so existing accounts do not need
// a migration or an operational manager grant. Explicit assignments take priority.
export function serviceSupervisor(u:Session){
 if(u.isAdmin)return true;if(!internal(u))return false;
 const p=u.permissions;
 if(p.roleAssignment)return p.roleAssignment.roles.some(r=>['ceo','sales_manager','service_manager'].includes(r));
 return !!p.supplyRoles?.includes('ceo')||!!p.salesRoles?.includes('manager')||!!p.serviceRoles?.includes('manager');
}
export function serviceReadDomains(u:Session):string[]{
 if(serviceSupervisor(u))return Object.keys(serviceDomains);
 if(u.permissions.hospitalCenterId||u.permissions.salesAgentId||u.permissions.salesRoles?.includes('agent')||!u.permissions.serviceRoles?.length)return [];
 return Object.keys(serviceDomains).filter(d=>u.permissions.serviceDomains?.includes(d));
}
export function serviceRead(u:Session,domain?:string){const domains=serviceReadDomains(u);return domain===undefined?!!domains.length:domains.includes(domain);}
export const domainAccess=(u:Session,d:string)=>serviceRead(u,d);
// Read access to the other service domain never extends operational authority.
export function domainWriteAccess(u:Session,d:string){return !!serviceDomains[d]&&(u.isAdmin||!u.permissions.hospitalCenterId&&!u.permissions.salesAgentId&&!u.permissions.salesRoles?.includes('agent')&&!!u.permissions.serviceDomains?.includes(d)&&!!u.permissions.serviceRoles?.length);}
