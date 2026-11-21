import type {Session} from '@/lib/permissions';
/** Presentation only; the existing section and domain policies remain authoritative. */
export function employeeHomeAvailable(user:Session){
 return !user.isAdmin&&!user.profileReview&&!user.permissions.hospitalCenterId&&!user.permissions.salesAgentId&&!user.permissions.serviceAgentId;
}
