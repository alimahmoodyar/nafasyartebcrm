import type {Session} from './permissions';
import {domainWriteAccess,role} from './service-access';
export const officeServiceAccess=(u:Session)=>!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.hospitalCenterId&&domainWriteAccess(u,'home')&&['support','intake','technician','coordinator'].some(r=>role(u,r));
