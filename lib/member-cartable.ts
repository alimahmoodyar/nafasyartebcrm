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
 const ids=(assignment?JSON.parse(assignment.data).bindings:[]).map((b:{profileId:string})=>b.profileId);
 const allowed=employeeWorkspaces(user,ids);
 if(scope!=='personal'&&!allowed.some(w=>w.id===scope))throw new AccessError('این نقش به حساب شما اختصاص ندارد.',403);
 return {scope,roles:roleProfiles.filter(p=>allowed.some(w=>w.id===p.id))};
}

export function taskRoles(data:any,roles:RoleProfile[]):string[]{
 if(data.cartableRole)return data.cartableRole==='personal'?[]:[data.cartableRole];
 if(data.assetDeclaration)return data.sourceSection==='assets'?['custodian']:[];
 if(data.positionName==='پرتال شخصی')return [];
 if(data.assetWorkflow)return ['custodian'];
 const named=roles.filter(p=>p.id===data.profileId||p.title===data.positionName);
 if(named.length)return named.map(p=>p.id);
 const workflow=roles.filter(p=>data.workflowRole&&p.workflowRoles.includes(data.workflowRole));
 if(data.workflowRole&&!workflow.length)return [];
 const candidates=workflow.length?workflow:roles;
 const section=candidates.filter(p=>p.links.some(l=>l.section===data.sourceSection));
 if(section.length===1)return [section[0].id];
 return workflow.length===1?[workflow[0].id]:[];
}
