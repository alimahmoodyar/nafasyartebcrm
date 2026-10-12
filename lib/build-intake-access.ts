import {accessPermissions} from './permissions';
import {salesStaff,salesManager} from './sales-access';
import {projectRoles} from './build-projects';
import type {Session} from './permissions';

/** Customer specifications never grant access to design documents or costing. */
export function buildIntakeRoles(user:Session){
 const p=accessPermissions(user.permissions),u={...user,permissions:p};
 const internal=!p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId;
 const project=projectRoles(u),assigned=p.roleAssignment?.roles;
 const sales=internal&&(u.isAdmin||salesManager(u)||salesStaff(u)&&(!assigned||assigned.some(r=>['sales','hospital_sales','sales_manager','sales_manager_assistant'].includes(r))));
 const manager=internal&&(project.manager||salesManager(u));
 return {sales:!!sales,engineering:!!project.engineering,manager:!!manager,production:!!project.production,read:!!(internal&&(sales||manager||project.engineering||project.production))};
}
