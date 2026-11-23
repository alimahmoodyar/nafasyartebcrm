import type {Session} from '@/lib/permissions';
import {accessPermissions} from '@/lib/permissions';
export function selectedEmployeeWorkspace(user:Session,selection?:{accountId:string;id:string}|null){
 const roles=user.assignedWorkspaces||[];
 if(selection?.accountId===user.userId)return roles.find(role=>role.id===selection.id);
 return roles.length===1?roles[0]:undefined;
}
/** Presentation only; the existing section and domain policies remain authoritative. */
export function employeeHomeAvailable(user:Session){
 return !user.isAdmin&&!user.profileReview&&!user.permissions.hospitalCenterId&&((!user.permissions.salesAgentId&&!user.permissions.serviceAgentId)||!!user.assignedWorkspaces?.length);
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
