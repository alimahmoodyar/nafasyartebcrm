import {storage} from './storage';
import {memberId} from './duties';
import {AccessError} from './authorization';
import {employeeWorkspaces} from './employee-workspaces';
import {roleProfiles,type RoleProfile} from './role-profiles';
import type {Session} from './permissions';

export async function memberCartable(user:Session,request?:Request){
 const scope=request && new URL(request.url).searchParams.get('workspace');
 if(!scope)return null;
 const mid=await memberId(user);
 const assignment=await storage().prepare("SELECT data FROM flow_entities WHERE type='member_role_assignment' AND id=?").bind('member-role-assignment:'+mid).first<{data:string}>();
 const bindings:{profileId:string;warehouseIds?:string[]}[]=assignment?JSON.parse(assignment.data).bindings:[];
 const ids=bindings.map(b=>b.profileId);
 const allowed=employeeWorkspaces(user,ids);
 if(scope!=='personal'&&!allowed.some(w=>w.id===scope))throw new AccessError('این نقش به حساب شما اختصاص ندارد.',403);
 return {scope,bindings,roles:roleProfiles.filter(p=>allowed.some(w=>w.id===p.id))};
}

export function taskRoles(data:any,roles:RoleProfile[],bindings:{profileId:string;warehouseIds?:string[]}[]=[]):string[]{
 if(data.cartableRole)return data.cartableRole==='personal'?[]:[data.cartableRole];
 if(data.assetDeclaration)return data.sourceSection==='assets'?['custodian']:[];
 if(data.positionName==='پرتال شخصی')return [];
 if(data.assetWorkflow)return ['custodian'];
 if(roles.length===1&&['sales-representative','home-service-representative'].includes(roles[0].id)&&roles[0].links.some(l=>l.section===data.sourceSection))return [roles[0].id];
 if(data.materialWorkflow&&data.workflowRole==='inventory'&&data.warehouseId){
  const store=bindings.find(b=>['line-store','central-store'].includes(b.profileId)&&b.warehouseIds?.includes(data.warehouseId));
  if(store)return [store.profileId];
 }
 if(data.serviceWorkflow&&data.serviceRole){
  const key=data.serviceRole,domain=data.serviceDomain;
  const preferred:Record<string,string>={support:'home-service-customer-support',technician:'home-service-technician',manager:'home-service-manager',intake:domain==='hospital'?'hospital-service-intake':'home-service-intake',inventory:'central-store',agent:'home-service-representative'};
  const ids=[preferred[key],domain==='hospital'?'hospital-service':'home-service'];
  const match=ids.find(id=>roles.some(p=>p.id===id)&&(domain!=='hospital'||!id.startsWith('home-')));
  if(match)return [match];
 }
 if(data.treasuryWorkflow){
  const treasury:Record<string,string>={treasury:'treasurer',manager:'finance-director',ceo:'ceo'};
  if(treasury[data.workflowRole])return [treasury[data.workflowRole]];
 }
 const named=roles.filter(p=>p.id===data.profileId||p.title===data.positionName);
 if(named.length)return named.map(p=>p.id);
 const workflow=roles.filter(p=>data.workflowRole&&p.workflowRoles.includes(data.workflowRole));
 if(data.workflowRole&&!workflow.length)return [];
 const candidates=workflow.length?workflow:roles;
 const section=candidates.filter(p=>p.links.some(l=>l.section===data.sourceSection));
 if(section.length===1)return [section[0].id];
 return workflow.length===1?[workflow[0].id]:[];
}
