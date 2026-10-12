import {AccessError} from './authorization';
import {storedAccessPermissions} from './permissions';
import type {Session} from './permissions';
import {salesManager,salesRead} from './sales-access';
import {salesVisible} from './sales';
import {domainWriteAccess,role,serviceRead} from './service-access';
import {taskText,taskRequired} from './duties';
import {normalizeIranLocation} from './iran-locations';

type Entity={id:string;type:string;revision:number;data:any;created?:string;updated?:string};
type LinkContext={db:D1Database;user:Session;operationId:string;now:string;guard:(test:string,...args:any[])=>unknown;put:(id:string,type:string,data:any,old?:Entity)=>unknown};
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const text=(v:unknown,max=200)=>taskText(v??'',max);
const read=async(db:D1Database,id:string,type:string)=>{const r:any=await db.prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(id,type).first();if(!r)fail('پرونده مرتبط پیدا نشد یا دسترسی ندارید.',404);return {...r,data:JSON.parse(r.data)} as Entity;};
const list=async(db:D1Database,type:string)=>(await db.prepare('SELECT * FROM flow_entities WHERE type=? ORDER BY created,id').bind(type).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)})) as Entity[];
export const canLinkServiceDomain=(u:Session,domain:string)=>salesManager(u)&&domainWriteAccess(u,domain)&&role(u,'manager')&&!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId;
export const canLinkServiceDomains=(u:Session)=>['home','hospital'].filter(domain=>canLinkServiceDomain(u,domain));
function needLink(c:LinkContext,domain:string){if(!canLinkServiceDomain(c.user,domain))fail('اتصال یا قطع اتصال نمایندگی به مجوز مدیر فروش و مدیر خدمات همان حوزه نیاز دارد.',403);}
async function authorityGuard(c:LinkContext){
 if(c.user.isAdmin)return;
 const m:any=await c.db.prepare("SELECT id,permissions FROM app_members WHERE status='active' AND (subject=? OR id=?)").bind(c.user.userId,c.user.userId.startsWith('local:')?c.user.userId.slice(6):c.user.userId).first();
 if(!m||JSON.stringify(storedAccessPermissions(m.permissions))!==JSON.stringify(c.user.permissions))fail('دسترسی حساب تغییر کرده است؛ دوباره وارد شوید.',403);
 c.guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",m.id,m.permissions);
}
function current(c:LinkContext,e:Entity,revision?:unknown){if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision!==e.revision))fail('نسخه پرونده مرتبط تغییر کرده است؛ فهرست را تازه کنید.',409);c.guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type=? AND revision=?)',e.id,e.type,e.revision);}
function sourceIds(sales:Entity|null):string[]{const value=sales?.data.linkedServiceAgentIds;if(value===undefined)return [];if(!Array.isArray(value)||value.some((id:any)=>typeof id!=='string'||!id)||new Set(value).size!==value.length)fail('ارتباط‌های این پرونده نیازمند بررسی مدیر سامانه است.',409);return [...value];}
function history(c:LinkContext,data:any,action:string,otherId:string){return {...data,representationLinkHistory:[...(data.representationLinkHistory||[]),{action,otherId,actor:c.user.userId,actorName:c.user.name,at:c.now,operationId:c.operationId}]};}
function bool(body:any,key:string){if(body[key]!==undefined&&typeof body[key]!=='boolean')fail('انتخاب نوع نمایندگی معتبر نیست.');return body[key] as boolean|undefined;}
function requireRevision(body:any,key:string,e:Entity){if(!Number.isSafeInteger(body[key])||body[key]!==e.revision)fail('نسخه پرونده مرتبط تغییر کرده است؛ فهرست را تازه کنید.',409);}
const representationKind=(kind:string)=>['representative','reseller'].includes(kind);

// These are profile relationships only. Neither member grants nor credentials are
// read, combined or altered; each module retains its independent account scope.
export async function salesRepresentationLinks(c:LinkContext,body:any,old:Entity|null,data:any){
 if(old)current(c,old);const sales=bool(body,'salesRepresentation'),service=bool(body,'serviceRepresentation');if(sales===false)fail('پرونده فروش باید نمایندگی فروش خود را حفظ کند.');
 if(service===undefined){if(sourceIds(old).length&&!representationKind(data.kind))fail('ابتدا اتصال خدمات را قطع کنید، سپس نوع خریدار را تغییر دهید.');if(['serviceDomain','linkedServiceAgentId','linkedServiceRevision','serviceCode'].some(k=>body[k]!==undefined))fail('برای تغییر ارتباط، وضعیت نمایندگی خدمات را مشخص کنید.');return {...data,salesRepresentation:true,serviceRepresentation:sourceIds(old).length>0};}
 if(service&&!representationKind(data.kind))fail('اتصال خدمات فقط برای نماینده فروش یا عامل فروش امکان‌پذیر است.');
 const sourceId=old?.id||c.operationId,ids=sourceIds(old);let services:Entity[]=[];
 for(const id of ids){const agent=await read(c.db,id,'as_agent');if(agent.data.linkedSalesAgentId!==sourceId)fail('ارتباط دو پرونده هم‌خوان نیست؛ مدیر سامانه بررسی کند.',409);services.push(agent);}
 if(!service){
  for(const agent of services)needLink(c,agent.data.domain);
  if(services.length){await authorityGuard(c);for(const agent of services){current(c,agent);c.put(agent.id,'as_agent',history(c,{...agent.data,serviceRepresentation:true,salesRepresentation:false,linkedSalesAgentId:''},'unlink-sales',sourceId),agent);}}
  return {...data,salesRepresentation:true,serviceRepresentation:false,linkedServiceAgentIds:[],...(services.length?{representationLinkHistory:history(c,data,'unlink-service','').representationLinkHistory}:{})};
 }
 const domain=taskRequired(body.serviceDomain,30);if(!['home','hospital'].includes(domain))fail('حوزه نمایندگی خدمات را انتخاب کنید.');needLink(c,domain);await authorityGuard(c);
 const selectedId=text(body.linkedServiceAgentId),existing=selectedId?await read(c.db,selectedId,'as_agent'):null;
 if(existing){if(existing.data.domain!==domain)fail('حوزه پرونده خدمات با انتخاب شما متفاوت است.');requireRevision(body,'linkedServiceRevision',existing);current(c,existing);if(existing.data.linkedSalesAgentId&&existing.data.linkedSalesAgentId!==sourceId)fail('این نماینده خدمات به پرونده فروش دیگری متصل است.',409);}
 const sameDomain=services.filter(agent=>agent.data.domain===domain);if(sameDomain.length>1)fail('بیش از یک نمایندگی خدمات در این حوزه متصل است؛ مدیر سامانه بررسی کند.',409);
 const targetId=existing?.id||c.operationId+':service:'+domain;
 c.guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='as_agent' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.linkedSalesAgentId')=? AND id NOT IN (SELECT value FROM json_each(?)))",domain,sourceId,JSON.stringify([...sameDomain.map(agent=>agent.id),targetId]));
 c.guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='sales_agent' AND id<>? AND EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.linkedServiceAgentIds')) WHERE value=?))",sourceId,targetId);
 for(const agent of sameDomain.filter(agent=>agent.id!==targetId)){current(c,agent);c.put(agent.id,'as_agent',history(c,{...agent.data,serviceRepresentation:true,salesRepresentation:false,linkedSalesAgentId:''},'unlink-sales',sourceId),agent);}
 if(existing){if(existing.data.linkedSalesAgentId!==sourceId)c.put(existing.id,'as_agent',history(c,{...existing.data,serviceRepresentation:true,salesRepresentation:true,linkedSalesAgentId:sourceId},'link-sales',sourceId),existing);}
 else{
  const code=taskRequired(body.serviceCode,80),location=normalizeIranLocation(data.province,data.city),phone=text(data.phone||data.mobile,50);if(!location.city)fail('برای ساخت نمایندگی خدمات، شهر یا شهرستان را انتخاب کنید.');if(!phone||phone.length>30)fail('برای نمایندگی خدمات، شماره تماس معتبر حداکثر ۳۰ نویسه وارد کنید.');if(!data.address||data.address.length>1000)fail('نشانی مشترک نمایندگی فروش و خدمات حداکثر ۱۰۰۰ نویسه باشد.');c.guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='as_agent' AND json_extract(data,'$.code')=?)",code);
  c.put(targetId,'as_agent',history(c,{domain,agentId:targetId,name:data.name,code,city:location.city,province:location.province,coverage:[],phone,address:data.address,active:data.active,nationalId:data.nationalId||'',mobile:data.mobile||'',serviceRepresentation:true,salesRepresentation:true,linkedSalesAgentId:sourceId},'link-sales',sourceId));
 }
 const next=[...services.filter(agent=>agent.data.domain!==domain).map(agent=>agent.id),targetId];
 const changed=JSON.stringify(ids.slice().sort())!==JSON.stringify(next.slice().sort());
 return {...data,salesRepresentation:true,serviceRepresentation:true,linkedServiceAgentIds:next,...(changed?{representationLinkHistory:history(c,data,'link-service',targetId).representationLinkHistory}:{})};
}

export async function serviceRepresentationLinks(c:LinkContext,body:any,old:Entity|null,data:any){
 await authorityGuard(c);if(old)current(c,old);const service=bool(body,'serviceRepresentation'),sales=bool(body,'salesRepresentation');if(service===false)fail('پرونده خدمات باید نمایندگی خدمات خود را حفظ کند.');
 if(sales===undefined){if(['linkedSalesAgentId','linkedSalesRevision'].some(k=>body[k]!==undefined))fail('برای تغییر ارتباط، وضعیت نمایندگی فروش را مشخص کنید.');return {...data,serviceRepresentation:true,salesRepresentation:!!old?.data.linkedSalesAgentId};}
 const sourceId=old?.id||c.operationId,previousId=text(old?.data.linkedSalesAgentId),domain=data.domain;
 const existingSales=previousId?await read(c.db,previousId,'sales_agent'):null;
 if(!sales&&!existingSales)return {...data,serviceRepresentation:true,salesRepresentation:false,linkedSalesAgentId:''};
 needLink(c,domain);
 if(existingSales){current(c,existingSales);if(!sourceIds(existingSales).includes(sourceId))fail('ارتباط دو پرونده هم‌خوان نیست؛ مدیر سامانه بررسی کند.',409);}
 const selectedId=sales?taskRequired(body.linkedSalesAgentId,200):'',selectedSales=sales?(selectedId===existingSales?.id?existingSales:await read(c.db,selectedId,'sales_agent')):null;
 if(selectedSales){if(!representationKind(selectedSales.data.kind||'representative'))fail('فقط نماینده یا عامل فروش قابل اتصال است.');requireRevision(body,'linkedSalesRevision',selectedSales);current(c,selectedSales);c.guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='as_agent' AND id<>? AND json_extract(data,'$.domain')=? AND json_extract(data,'$.linkedSalesAgentId')=?)",sourceId,domain,selectedSales.id);}
 if(existingSales&&existingSales.id!==selectedSales?.id){const remaining=sourceIds(existingSales).filter(id=>id!==sourceId);c.put(existingSales.id,'sales_agent',history(c,{...existingSales.data,salesRepresentation:true,serviceRepresentation:!!remaining.length,linkedServiceAgentIds:remaining},'unlink-service',sourceId),existingSales);}
 if(selectedSales&&selectedSales.id!==existingSales?.id){const ids=sourceIds(selectedSales);if(ids.includes(sourceId))fail('ارتباط یک‌طرفه موجود است؛ مدیر سامانه بررسی کند.',409);c.put(selectedSales.id,'sales_agent',history(c,{...selectedSales.data,salesRepresentation:true,serviceRepresentation:true,linkedServiceAgentIds:[...ids,sourceId]},'link-service',sourceId),selectedSales);}
 return {...data,serviceRepresentation:true,salesRepresentation:sales,linkedSalesAgentId:selectedSales?.id||'',...(previousId!==(selectedSales?.id||'')?{representationLinkHistory:history(c,data,sales?'link-sales':'unlink-sales',selectedSales?.id||previousId).representationLinkHistory}:{})};
}

function serviceSummary(a:Entity){return {id:a.id,revision:a.revision,name:a.data.name,domain:a.data.domain,code:a.data.code,province:a.data.province||'',city:a.data.city||''};}
function salesSummary(a:Entity){return {id:a.id,revision:a.revision,name:a.data.name,kind:a.data.kind||'representative',province:a.data.province||'',city:a.data.city||''};}
export async function salesLinkWorkspace(db:D1Database,user:Session,agents:Entity[]){
 const domains=canLinkServiceDomains(user),services=await list(db,'as_agent'),byId=new Map(services.map(a=>[a.id,a]));
 return {canLinkServiceDomains:domains,serviceAgentChoices:services.filter(a=>domains.includes(a.data.domain)).map(a=>({...serviceSummary(a),linkedSalesAgentId:a.data.linkedSalesAgentId||''})),agents:agents.map(a=>{const {linkedServiceAgentIds,representationLinkHistory,...data}=a.data;return {...a,data:{...data,salesRepresentation:true,serviceRepresentation:sourceIds(a).length>0,linkedServiceAgents:sourceIds(a).flatMap(id=>{const service=byId.get(id);return service&&service.data.linkedSalesAgentId===a.id&&serviceRead(user,service.data.domain)?[serviceSummary(service)]:[];})}};})};
}
export async function serviceLinkWorkspace(db:D1Database,user:Session,domain:string,agents:Entity[]){
 const canLinkSales=canLinkServiceDomain(user,domain),sales=canLinkSales||salesRead(user)?await list(db,'sales_agent'):[],visibleSales:Entity[]=[];
 for(const agent of sales)if(salesRead(user)&&await salesVisible(user,agent,'read'))visibleSales.push(agent);
 const byId=new Map(visibleSales.map(a=>[a.id,a]));return {canLinkSales,salesAgentChoices:canLinkSales?visibleSales.filter(a=>representationKind(a.data.kind||'representative')).map(salesSummary):[],agents:agents.map(a=>{const {linkedSalesAgentId,representationLinkHistory,...data}=a.data,sale=byId.get(linkedSalesAgentId);return {...a,data:{...data,serviceRepresentation:true,salesRepresentation:!!linkedSalesAgentId,linkedSalesAgent:sale&&sourceIds(sale).includes(a.id)?salesSummary(sale):null}};})};
}
