import type {Session} from './permissions';
/** Shared visibility policy; the HTTP handler also rechecks current membership. */
export function canGenerateActivationCode(u:Session|null):boolean {
 if(!u)return false;const p=u.permissions;
 if(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent'))return false;
 return u.isAdmin||!!p.salesRoles?.includes('manager')||!!(p.serviceDomains?.includes('home')&&p.serviceRoles?.some(r=>['support','intake','technician'].includes(r)));
}
