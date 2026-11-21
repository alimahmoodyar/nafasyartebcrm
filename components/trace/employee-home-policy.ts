import type {Session} from '@/lib/permissions';
import {accessPermissions} from '@/lib/permissions';
/** Presentation only; the existing section and domain policies remain authoritative. */
export function employeeHomeAvailable(user:Session){
 return !user.isAdmin&&!user.profileReview&&!user.permissions.hospitalCenterId&&!user.permissions.salesAgentId&&!user.permissions.serviceAgentId;
}

/** A work launcher is separate from the employee's own personnel services.
 * Stored grants, never assigned-profile labels, determine this entry. */
export function personnelWorkEntry(user:Session){
 if(!employeeHomeAvailable(user))return null;
 const roles=accessPermissions(user.permissions).personnelRoles||[];
 if(roles.includes('hr'))return {title:'امور اداری و پرسنلی',target:'hr-admin:'};
 if(roles.some(role=>['payroll','approver','finance','treasury','executive_viewer','reporter'].includes(role)))return {title:'مدیریت پرسنلی و حقوق',target:'management:'};
 return null;
}
