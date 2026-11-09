import {returnRoles} from './sales-return-contract';
import {financeStandaloneSections,financeTarget} from './finance-workspace';
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
import {warehouseAccess,flowRole} from './material-flow';
import {serviceReadDomains} from './service-access';
import {warehouseLegacySections,warehouseTarget,type WarehouseEntry} from './warehouse-workspace';
import {shortageRoles} from './handoff-shortage';

const can=(u:Session,kind:Kind,operation:'read'|'write'='read')=>u.isAdmin||u.permissions[operation].includes(kind);

/** One navigation policy shared by the browser shell and the assistant. */
export function canOpenSection(user:Session,s:string):boolean{
 const p=accessPermissions(user.permissions),u={...user,permissions:p};
 const internal=!p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId;
 // The inbox is a shared workspace. Showing its entry does not grant access
 // to any task or conversation; the corresponding APIs scope each record.
 if(s==='tasks')return true;
 if(s==='oxygen-capacity'){
  const roles=buildIntakeRoles(u);
  return roles.sales||roles.engineering;
 }
 if(s==='sales-returns')return Object.values(returnRoles(u)).some(Boolean);
 if(s==='fulfillment'&&internal&&Object.values(shortageRoles(u)).some(Boolean))return true;
 if(s==='routine-production'&&internal&&u.productionParticipant===true)return true;
 if(s==='warehouse')return internal&&(!!p.supplyRoles?.includes('inventory')||canOpenSection(u,'flow')||canOpenSection(u,'inventory')||canOpenSection(u,'batch')||canOpenSection(u,'fulfillment')&&warehouseAccess(u,'finished')||canOpenSection(u,'after-sales')&&!!p.serviceRoles?.includes('inventory'));
 if(!u.isAdmin&&!selfServicePrograms.includes(s)){
  if(p.roleAssignment&&!programsForRoles(p.roleAssignment.roles).includes(s)&&!(s==='flow'&&p.warehouseResponsibilities?.length))return false;
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
 if(s==='sales')return !!salesRead(u)||!!salesWarehouse(u);
 if(s==='transport')return financialAccess(u,'transport')||!!p.salesAgentId||!!p.salesRoles?.some(r=>['manager','staff'].includes(r))||!!p.supplyRoles?.some(r=>['inventory','domestic','foreign'].includes(r))||!!p.transportRoles?.length||!!p.flowRoles?.some(r=>['inventory','sales','logistics'].includes(r))||!!p.serviceRoles?.length;
 if(s==='after-sales')return serviceRead(u);
 if(s==='sourcing')return !!p.qmsRoles?.some(r=>['qa','qc'].includes(r))||!!p.flowRoles?.includes('qc')||!!p.supplyRoles?.length||!!p.flowRoles?.some(r=>['inventory','logistics'].includes(r))||!!p.transportRoles?.includes('manager');
 if(['users','llm','finance','system-reset'].includes(s))return false;
 if(s==='fulfillment')return !!p.supplyRoles?.some(r=>r==='finance'||r==='ceo')||warehouseAccess(u,'finished')||salesStaff(u)||!!p.salesAgentId||!!p.flowRoles?.some(r=>['inventory','production','sales','logistics'].includes(r));
 if(s==='flow')return !!p.warehouseResponsibilities?.length||!!p.flowRoles?.some(r=>['inventory','qc','production','procurement'].includes(r))||!!p.supplyRoles?.includes('engineering');
 if(s==='finance-control')return financialAccess(u,'control')||financialAccess(u,'purchase');
 return can(u,(s==='inventory'?'batch':['serials','analytics'].includes(s)?'device':s) as Kind,'read');
}

// Hidden personal asset entry points still support authorized task/deep links.
export function sectionDestination(user:Session,section:string,target=''){
 if(section==='build-intake'&&target==='oxygen-capacity')return {section:'oxygen-capacity',target:''};
 if(user.isAdmin&&financeStandaloneSections.includes(section as any)&&canOpenSection(user,section))return {section:'finance',target:financeTarget(section,target)};
 const p=accessPermissions(user.permissions);
 if(section==='fulfillment'&&target.startsWith('handoff-shortage:'))return {section,target};
 if(warehouseLegacySections.includes(section as any)&&canOpenSection(user,section)&&canOpenSection(user,'warehouse'))return {section:'warehouse',target:warehouseTarget(section,target)};
 if(section==='assets'&&!user.isAdmin&&!p.assetRoles?.includes('custodian')&&!p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId)return {section:'personnel',target:'asset:'+target};
 return {section,target};
}

/** The hub groups existing grants; it never assigns a domain or warehouse. */
export function warehouseNavigation(user:Session){
 const p=accessPermissions(user.permissions),u={...user,permissions:p};
 const groups:Record<string,WarehouseEntry[]>={tasks:[],stock:[],receive:[],issue:[],operations:[],dispatch:[],returns:[],settings:[]};
 if(!canOpenSection(u,'warehouse'))return groups;
 const add=(group:string,key:string,title:string,source:string,view:string)=>groups[group].push({key,title,source,view});
 if(u.isAdmin||p.supplyRoles?.includes('inventory'))add('tasks','warehouse-supply','درخواست و تأیید تأمین مواد','sourcing','warehouse-supply');
 const materialScope=['raw','semi','line','quarantine','nonconforming'].filter(warehouse=>warehouseAccess(u,warehouse));
 const flow=canOpenSection(u,'flow'),inventory=flowRole(u,'inventory'),production=u.isAdmin||!!p.flowRoles?.includes('production'),quality=u.isAdmin||!!p.flowRoles?.includes('qc');
 if(flow){
  if(quality||p.warehouseResponsibilities?.some(r=>r.role==='qc')||production||materialScope.length||p.flowRoles?.includes('procurement'))add('tasks','material-tasks','کارهای مواد و کنترل ورودی','flow','tasks');
  if(inventory&&materialScope.length)add('stock','material-stock','موجودی','flow','stock');
  if(quality||p.warehouseResponsibilities?.some(r=>r.role==='qc')||inventory&&warehouseAccess(u,'quarantine')){add('receive','receipts','رسید، کنترل ورودی و جانمایی','flow','receipts');}
  if(production||inventory&&(warehouseAccess(u,'raw')||warehouseAccess(u,'line'))){add('issue','requests','درخواست و تحویل مواد به خط','flow','requests');}
  if(production)add('issue','plans','برنامه و سریال محصول','flow','plans');
  if(quality||production)add('receive','builds',quality?'کنترل سریالی محصول':'ثبت بچ‌های مصرفی محصول','flow','builds');
  if(production)add('returns','nonconforming','ثبت قطعه نامنطبق خط','flow','nonconforming');
  if(inventory&&materialScope.length||p.supplyRoles?.includes('engineering'))add('settings','materials','شناسنامه کالاها','flow','materials');
  if(u.isAdmin)add('settings','warehouses','انبارها و محل‌های نگهداری','flow','warehouses');
 }
 if(canOpenSection(u,'inventory')&&(!inventory||materialScope.length)){
  if(!flow||!inventory)add('stock','material-stock','موجودی','inventory','report');
  if(inventory&&materialScope.length>1)add('issue','move','انتقال بین انبارها','inventory','transfer');
  if(u.isAdmin)add('settings','opening','موجودی آغازین و سوابق قبلی','inventory','opening');
 }
 if(canOpenSection(u,'batch')&&(!inventory||materialScope.length)||inventory&&(materialScope.length||warehouseAccess(u,'finished')))add('stock','batches','گردش کالا','batch','batches');
 if(canOpenSection(u,'fulfillment')){
  const finished=warehouseAccess(u,'finished'),sales=u.isAdmin||!!p.salesRoles?.some(r=>['staff','manager'].includes(r))||!!p.flowRoles?.includes('sales'),logistics=u.isAdmin||!!p.flowRoles?.includes('logistics')||!!p.transportRoles?.includes('driver');
  if(finished||production)add('receive','finished-receive','تحویل و دریافت محصول نهایی','fulfillment','handoff-receive');
  if(finished||sales)add('stock','finished-stock','موجودی و رزرو محصول نهایی','fulfillment','sales');
  if(finished||sales||logistics)add('dispatch','dispatch','سفارش‌های باز','fulfillment',finished||logistics?'dispatch':'sales');
  if(finished&&canOpenSection(u,'sales'))add('returns','sales-returns','دریافت برگشتی مشتری','sales','returns');
 }
 if(canOpenSection(u,'after-sales')&&(u.isAdmin||p.serviceRoles?.includes('inventory'))){
  for(const domain of serviceReadDomains(u)){
   const title=domain==='home'?'خدمات خانگی':'خدمات بیمارستانی';
   if(!groups.stock.some(e=>e.key==='material-stock'))add('stock','material-stock','موجودی','warehouse','stock');
   add('issue','service-issue-'+domain,'تحویل قطعه به '+title,'after-sales',domain+':stock');
   add('returns','service-return-'+domain,'قطعات، داغی و برگشتی '+title,'after-sales',domain+':orders');
  }
 }
 if(!groups.dispatch.length&&canOpenSection(u,'warehouse')&&canOpenSection(u,'after-sales')&&serviceReadDomains(u).length&&(u.isAdmin||p.serviceRoles?.some(r=>['inventory','logistics','manager','coordinator'].includes(r))))add('dispatch','dispatch','سفارش‌های باز','warehouse','dispatch');
 if(canOpenSection(u,'build-projects')&&(inventory&&warehouseAccess(u,'raw')||p.serviceRoles?.includes('technician')))add('issue','project-materials','درخواست‌های قطعات پروژه','build-projects','materials');
 groups.operations=[...groups.receive,...groups.issue];delete groups.receive;delete groups.issue;
 return groups;
}
export function warehouseHomeAliases(user:Session){return canOpenSection(user,'warehouse')?Object.fromEntries(warehouseLegacySections.map(key=>[key,'warehouse'])):{};}
export function warehouseHomeApps<T extends {key:string}>(apps:T[],user:Session):T[]{
 return canOpenSection(user,'warehouse')?apps.filter(app=>!warehouseLegacySections.includes(app.key as any)):apps;
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
