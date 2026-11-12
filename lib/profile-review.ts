import {servicePreviewAgent} from './service-role-preview';
import {storage} from './storage';
import {resolveRoleAssignment,type Session} from './permissions';
import {roleProfiles} from './role-profiles';

// Stable per administrator and only materialized in isolated preview storage.
export const representativeSampleId=(userId:string)=>'role-sample-representative:'+userId;
// Compatibility is limited to old admin preview cookies; API scopes stay strict.
export function profileReviewSelection(raw:string){const [storedProfileId,buyerId='',extra]=raw.split('~');if(extra!==undefined)throw Error('invalid preview scope');return {profileId:storedProfileId==='home-service'&&buyerId?'home-service-representative':storedProfileId,buyerId:buyerId==='training-service-agent-1'?'':buyerId};}
export const profileReviewCookie='__Host-nafasyar-profile-review';
export const profileJobRoles:Record<string,string[]>={
 'central-store':['inventory','service_inventory'],'line-store':['production_store_assistant'],'line-manager':['production'],
 'warehouse-worker':[],'production-worker':[],'packaging-worker':[],'repair-worker':[],
 quality:['qc'],technical:['engineering','product_manager'],'finance-director':['finance_director','purchase_finance'],
 ceo:['ceo'],domestic:['domestic'],foreign:['foreign'],sales:['sales'],
 'home-sales':['home_sales'],'hospital-sales':['hospital_sales'],'sales-representative':['sales_agent'],'sales-manager':['sales_manager'],'sales-finance':['sales_finance'],treasurer:['treasurer'],
 'home-service-intake':['service_intake'],'hospital-service-intake':['service_intake'],'home-service-customer-support':['service_support','service_intake'],'home-service-technician':['service_technician'],'home-service-manager':['service_manager'],'home-service-representative':['service_agent'],'home-service':['service_support','service_intake','service_technician','service_coordinator'],'hospital-service':['service_support','service_intake','service_technician'],logistics:['transport_manager'],driver:['driver']
};
/** An authenticated admin tests a position's grants; the actor never becomes a person. */
export function profileSession(admin:Session,id:string,warehouses:any[],buyerId=''):Session{
 const profile=roleProfiles.find(p=>p.id===id);if(!admin.isAdmin||!profile)throw Error('پروفایل معتبر مدیر لازم است.');
 if((!profile.buyerScope&&!profile.missionScope&&buyerId)&&!(id==='home-service-representative'&&buyerId===servicePreviewAgent))throw Error('پرونده خریدار برای این پروفایل معتبر نیست.');

 if(profile.buyerScope==='required'&&!buyerId)return {...admin,isAdmin:false,permissions:{read:[],write:[],eventStages:[],manualPrograms:[]},profileReview:{id,title:profile.title,warehouseIds:[]},productionParticipant:false};
 const serviceRepresentative=id==='home-service-representative';
 if(serviceRepresentative&&!buyerId)buyerId=servicePreviewAgent;
 const roles=profileJobRoles[id];if(!roles)throw Error('مجوزهای این پروفایل تعریف نشده است.');
 const selected=warehouses.filter(w=>w.data.active&&!w.data.deletedAt&&(id==='quality'||id==='line-store'?id==='quality'||w.data.warehouseType==='production_line':!w.data.serviceDomain&&!['production_line','quarantine'].includes(w.data.warehouseType)));
 const responsibilities=['central-store','line-store','quality'].includes(id)?selected.map(w=>({warehouseId:w.id,role:(id==='quality'?'qc':'inventory') as 'inventory'|'qc'})):[];
 let permissions=roles.length?resolveRoleAssignment({roles,...(id==='sales-representative'?{salesAgentId:buyerId}:{}),...(serviceRepresentative?{serviceAgentId:buyerId}:{}),...(['central-store','line-store','quality'].includes(id)?{...(responsibilities.length?{warehouseResponsibilities:responsibilities}:{}),warehouses:id==='line-store'?['line']:['raw','quarantine','nonconforming','finished']}:{}),...(['home-service-customer-support','home-service-technician','home-service-intake','hospital-service-intake','central-store','home-service','home-service-manager','home-service-representative','hospital-service'].includes(id)?{serviceDomains:[id==='hospital-service'||id==='hospital-service-intake'?'hospital':'home']}: {})}):{read:[],write:[],eventStages:[]};
 // Entry points follow the agreed profile; operation grants still come from the job policy.
 const {roleAssignment,...grants}=permissions;
 permissions={...grants,...(['central-store','line-store','quality'].includes(id)?{warehouseResponsibilities:responsibilities}:{}),manualPrograms:[...new Set(profile.links.map(l=>l.section==='warehouse'?'flow':l.section).concat(['central-store','line-store'].includes(id)?['routine-production','flow','inventory','fulfillment','sourcing','build-projects']:[]))]};
 return {...admin,isAdmin:false,permissions,profileReview:{id,title:profile.title,warehouseIds:responsibilities.map(r=>r.warehouseId),...(buyerId?(profile.missionScope?{missionId:buyerId}:{buyerId}):{})},productionParticipant:false};
}

export async function profileScopeChoices(profileId:string){
 const profile=roleProfiles.find(p=>p.id===profileId);
 if(!profile?.buyerScope&&!profile?.missionScope)return [];
 if(profile?.serviceScope)return (await storage().prepare("SELECT id,json_extract(data,'$.name') AS name FROM flow_entities WHERE type='as_agent' AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.active')=1 ORDER BY name,id").all<{id:string;name:string}>()).results.filter(row=>/^[A-Za-z0-9:_-]{1,160}$/.test(row.id));
 if(profile?.missionScope)return (await storage().prepare("SELECT id,json_extract(data,'$.code') AS name FROM flow_entities WHERE type='transport' AND json_extract(data,'$.driverId')<>'' AND json_extract(data,'$.state') NOT IN ('cancelled','requested') ORDER BY updated DESC LIMIT 100").all<{id:string;name:string}>()).results.filter(row=>/^[A-Za-z0-9:_-]{1,160}$/.test(row.id));
 const rows=(await storage().prepare("SELECT id,json_extract(data,'$.name') AS name FROM flow_entities WHERE type='sales_agent' AND json_extract(data,'$.active')=1 AND json_extract(data,'$.kind')<>'referrer' AND (?<>'required' OR json_extract(data,'$.kind') IN ('representative','reseller')) ORDER BY name,id").bind(profile.buyerScope).all<{id:string;name:string}>()).results;
 return rows.filter(row=>/^[A-Za-z0-9:_-]{1,160}$/.test(row.id));
}
export async function validProfileScope(profileId:string,buyerId:string,allowUnscoped=false){
 const profile=roleProfiles.find(p=>p.id===profileId);
 if(profileId==='home-service-representative'&&buyerId===servicePreviewAgent)return true;
 if(!buyerId)return !!profile&&(allowUnscoped||profile.buyerScope!=='required');
 if((!profile?.buyerScope&&!profile?.missionScope)||!/^[A-Za-z0-9:_-]{1,160}$/.test(buyerId))return false;
 if(profile.serviceScope)return !!await storage().prepare("SELECT 1 FROM flow_entities WHERE id=? AND type='as_agent' AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.active')=1").bind(buyerId).first();
 if(profile.missionScope)return !!await storage().prepare("SELECT 1 FROM flow_entities WHERE id=? AND type='transport' AND json_extract(data,'$.driverId')<>'' AND json_extract(data,'$.state') NOT IN ('cancelled','requested')").bind(buyerId).first();
 return !!await storage().prepare("SELECT 1 FROM flow_entities WHERE id=? AND type='sales_agent' AND json_extract(data,'$.active')=1 AND json_extract(data,'$.kind')<>'referrer' AND (?<>'required' OR json_extract(data,'$.kind') IN ('representative','reseller'))").bind(buyerId,profile.buyerScope).first();
}
