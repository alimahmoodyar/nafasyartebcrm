import type {Session} from '@/lib/permissions';

/** Visual pilot only. Never use this predicate to authorize a record or action. */
export function warehouseCompactAppearance(user:Session,section:string):boolean {
  // A preview must follow the selected persona, not the administrator's grants.
  if(user.profileReview)return ['central-store','line-store'].includes(user.profileReview.id);
  if(user.isAdmin)return section==='warehouse';
  const roles=user.permissions.roleAssignment?.roles||[];
  return roles.some(role=>['inventory','warehouse_supervisor','production_store_assistant'].includes(role))
    ||!!user.permissions.flowRoles?.includes('inventory');
}
