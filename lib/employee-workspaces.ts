import {accessPermissions,type Session} from './permissions';
import {centralWarehouseMenus,type WarehouseMenu} from './central-warehouse-menu';
import {roleProfiles,type RoleLink} from './role-profiles';
import {canAccessSection,sectionDestination} from './navigation-access';

export type EmployeeWorkspace={
 id:string;
 title:string;
 group:string;
 programs:string[];
 links:RoleLink[];
 menus?:WarehouseMenu[];
};

/** Navigation only. Every form continues to enforce the account's current grants. */
export function employeeWorkspaces(user:Session,assignedIds:string[]):EmployeeWorkspace[]{
 if(user.isAdmin||user.profileReview||user.mustChangePassword)return [];
 const p=accessPermissions(user.permissions);
 if(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId)return [];
 return roleProfiles.filter(profile=>assignedIds.includes(profile.id)&&profile.operational)
  .filter(profile=>profile.id!=='personnel-hr'||p.personnelRoles?.includes('hr'))
  .filter(profile=>profile.id!=='custodian'||p.assetRoles?.includes('custodian'))
  .filter(profile=>profile.links.some(link=>canAccessSection(user,link.section)))
  .map(profile=>({
   id:profile.id,title:profile.title,group:profile.group,
   programs:[...new Set(profile.links.filter(link=>canAccessSection(user,link.section)).map(link=>sectionDestination(user,link.section).section))],
   ...(profile.id==='central-store'?{menus:centralWarehouseMenus(user)}:{}),
   links:profile.links.filter(link=>!link.taskOnly&&canAccessSection(user,link.section)),
  }));
}
