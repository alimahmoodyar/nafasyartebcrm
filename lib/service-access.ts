import type {Session} from './permissions';
import {serviceDomains} from './after-sales-labels';

// Shared by service pages and authenticated domain handlers. Navigation must not
// infer permissions from whether a business-data request has succeeded.
export const isAgent=(u:Session)=>!u.isAdmin&&!!u.permissions.serviceAgentId;
export const role=(u:Session,r:string)=>u.isAdmin||!!u.permissions.serviceRoles?.includes(r)||!isAgent(u)&&!!u.permissions.serviceRoles?.includes('manager');
export function domainAccess(u:Session,d:string){return !!serviceDomains[d]&&(u.isAdmin||!!u.permissions.serviceDomains?.includes(d)&&!!u.permissions.serviceRoles?.length);}
