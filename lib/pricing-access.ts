import {costRead,costWrite} from './costing';
const internal=(u:any)=>!u.permissions?.salesAgentId&&!u.permissions?.serviceAgentId&&!u.permissions?.hospitalCenterId;
export const pricingExecutive=(u:any)=>internal(u)&&(u.isAdmin||!!u.permissions?.supplyRoles?.includes('ceo'));
export const pricingFinance=(u:any)=>internal(u)&&costWrite(u);
export const pricingRead=(u:any)=>internal(u)&&(pricingExecutive(u)||costRead(u));
