import {accessPermissions} from './permissions';
import {programsForRoles,selfServicePrograms} from './workflow-programs';
import {financialWorkflowRole} from './financial-workflow-roles';
import {financialAccess} from './financial-access';
import {canGenerateActivationCode} from './activation-code-access';
import {routineRoles} from './routine-production';
import {projectRoles} from './build-projects';
import {buildIntakeRoles} from './build-intake-access';
import {costRead} from './costing';
import {pricingRead} from './pricing-access';
import {salesRead,salesWarehouse,salesStaff,salesManager,salesFinance} from './sales-access';
import type {Kind} from './model';
import type {Session} from './permissions';
import {serviceRead} from './service-access';

const can=(u:Session,kind:Kind,operation:'read'|'write'='read')=>u.isAdmin||u.permissions[operation].includes(kind);

/** One navigation policy shared by the browser shell and the assistant. */
export function canOpenSection(user:Session,s:string){
 const p=accessPermissions(user.permissions),u={...user,permissions:p};
 const internal=!p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId;
 if(!u.isAdmin&&!selfServicePrograms.includes(s)){
  if(p.roleAssignment&&!programsForRoles(p.roleAssignment.roles).includes(s))return false;
  if(!p.roleAssignment&&p.manualPrograms!==undefined&&!p.manualPrograms.includes(s))return false;
 }
 if(s==='pricing')return pricingRead(u);
 if(s==='qms')return internal&&(u.isAdmin||!!p.qmsRoles?.length||!!p.supplyRoles?.some(r=>['engineering','ceo'].includes(r)));
 if(s==='hospital')return !!p.hospitalCenterId||u.isAdmin||financialAccess(u,'hospital')||!p.serviceAgentId&&serviceRead(u,'hospital');
 if(s==='reminders')return true;
 if(s==='sales-bank')return internal&&(salesManager(u)||salesFinance(u)||financialWorkflowRole(p,'',[],'treasury'));
 if(s==='treasury')return internal&&(u.isAdmin||financialAccess(u,'treasury'));
 // Personal custody is inside personnel; the standalone program is for custodians.
 if(s==='assets')return internal&&(u.isAdmin||!!p.assetRoles?.includes('custodian'));
 if(s==='activation-code')return canGenerateActivationCode(u);
 // Personnel is a self-service entry point for every internal employee; HR
 // scope and sensitive fields remain enforced by the personnel domain API.
 if(s==='personnel')return internal;
 if(s==='guarantees')return internal&&(u.isAdmin||financialAccess(u,'guarantees'));
 if(s==='llm-usage')return u.isAdmin;
 if(s==='routine-production')return routineRoles(u).section;
 if(s==='build-projects')return projectRoles(u).read;
 if(s==='build-intake')return buildIntakeRoles(u).read;
 if(s==='costing')return costRead(u);
 if(s==='overview')return u.isAdmin||!!p.read.length;
 if(u.isAdmin||s==='mobile-install'||s==='tasks'||s==='development')return true;
 if(s==='sales')return salesRead(u)||salesWarehouse(u);
 if(s==='transport')return financialAccess(u,'transport')||!!p.salesAgentId||!!p.salesRoles?.some(r=>['manager','staff'].includes(r))||!!p.supplyRoles?.some(r=>['inventory','domestic','foreign'].includes(r))||!!p.transportRoles?.length||!!p.flowRoles?.some(r=>['inventory','sales','logistics'].includes(r))||!!p.serviceRoles?.length;
 if(s==='after-sales')return serviceRead(u);
 if(s==='sourcing')return !!p.qmsRoles?.some(r=>['qa','qc'].includes(r))||!!p.flowRoles?.includes('qc')||!!p.supplyRoles?.length||!!p.flowRoles?.some(r=>['inventory','logistics'].includes(r))||!!p.transportRoles?.includes('manager');
 if(['users','llm','finance','system-reset'].includes(s))return false;
 if(s==='fulfillment')return salesStaff(u)||!!p.salesAgentId||!!p.flowRoles?.some(r=>['inventory','production','sales','logistics'].includes(r));
 if(s==='flow')return !!p.flowRoles?.some(r=>['inventory','qc','production','procurement'].includes(r));
 if(s==='finance-control')return financialAccess(u,'control');
 return can(u,(s==='inventory'?'batch':['serials','analytics'].includes(s)?'device':s) as Kind,'read');
}

// Hidden personal asset entry points still support authorized task/deep links.
export function sectionDestination(user:Session,section:string,target=''){
 const p=accessPermissions(user.permissions);
 if(section==='assets'&&!user.isAdmin&&!p.assetRoles?.includes('custodian')&&!p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId)return {section:'personnel',target:'asset:'+target};
 return {section,target};
}
export function workflowSectionTitle(user:Session,key:string,fallback:string){
 const p=accessPermissions(user.permissions);
 if(key==='assets')return 'مدیریت اموال شرکت';
 if(!user.isAdmin&&key==='event'&&p.eventStages.length===1&&p.eventStages[0]==='تحویل')return 'ثبت تحویل دستگاه';
 if(!user.isAdmin&&p.salesRoles?.some(r=>['staff','manager'].includes(r))){
  if(key==='sourcing'&&!!p.supplyRoles?.length&&p.supplyRoles.every(r=>r==='sales'))return 'درخواست تولید';
  if(key==='transport'&&!p.transportRoles?.length)return 'پیگیری ارسال سفارش';
  if(key==='fulfillment'&&!p.flowRoles?.some(r=>['inventory','production','logistics'].includes(r)))return 'رزرو و تحویل فروش';
 }
 return fallback;
}

export function canAccessSection(user:Session,section:string){
 const destination=sectionDestination(user,section);
 return canOpenSection(user,destination.section);
}
