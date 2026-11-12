import type {Session} from './permissions';
// Empty administrator role identity, never a stored agency or a personal account.
export const unassignedServiceProfileId='role-unassigned-service-agent';
export const isUnassignedServiceProfile=(u:Session)=>u.profileReview?.id==='home-service-representative'&&u.permissions.serviceAgentId===unassignedServiceProfileId&&u.permissions.serviceDomains?.includes('home')===true&&u.permissions.serviceRoles?.includes('agent')===true;
