import {storage} from './storage';
import {assetIdentity,afail} from './asset-workflow';
import {assetCustodianSteps} from './asset-workflow-tasks';
import {dayAt} from './duties';
import type {Session} from './permissions';
import type {ProfileWork} from './role-profiles';

/** Read current shared obligations without assigning the reviewing admin to a job. */
export async function custodianProfileWork(user:Session){
 const actor=await assetIdentity(user);if(!actor.custodian)afail('دسترسی اموال‌دار لازم است.',403);
 const db=storage(),today=dayAt(),limit=100;
 const rows=(await db.prepare(`SELECT id,data,revision FROM flow_entities
 WHERE type='asset_item' AND coalesce(json_extract(data,'$.lifecycle'),'active')<>'disposed' AND (
  json_extract(data,'$.pending.state')='awaiting_approval'
  OR (json_extract(data,'$.pending.state')='awaiting_receipt' AND json_extract(data,'$.pending.kind')<>'employee')
  OR (json_extract(data,'$.signatureRequired')=1 AND coalesce(json_extract(data,'$.signedReceiptId'),'')='')
  OR (coalesce(json_extract(data,'$.annualDue'),'')<>'' AND json_extract(data,'$.annualDue')<=?)
  OR (coalesce(json_extract(data,'$.returnDue'),'')<>'' AND json_extract(data,'$.returnDue')<=? AND coalesce(json_extract(data,'$.continuous'),0)=0)
  OR (json_extract(data,'$.issue.state')='open' AND coalesce(json_extract(data,'$.technicalId'),'')='')
  OR (json_extract(data,'$.service.state')='awaiting_review' AND coalesce(json_extract(data,'$.technicalId'),'')='')
  OR (coalesce(json_extract(data,'$.servicePlan.nextDay'),'')<>'' AND json_extract(data,'$.servicePlan.nextDay')<=?)
  OR (json_extract(data,'$.servicePlan.hours')>0 AND coalesce(json_extract(data,'$.meters.hours'),0)-json_extract(data,'$.servicePlan.baselineHours')>=json_extract(data,'$.servicePlan.hours'))
  OR (json_extract(data,'$.servicePlan.cycles')>0 AND coalesce(json_extract(data,'$.meters.cycles'),0)-json_extract(data,'$.servicePlan.baselineCycles')>=json_extract(data,'$.servicePlan.cycles'))
  OR (json_type(data,'$.assetKind') IS NULL AND json_extract(data,'$.holderKind')='contractor')
 ) ORDER BY id LIMIT 101`).bind(today,today,today).all()).results as any[];
 const work:ProfileWork[]=[];
 for(const r of rows){const d=JSON.parse(r.data);
  for(const step of assetCustodianSteps(d,r.revision))work.push({id:'asset-work:'+r.id+':'+step.stage,title:step.title+' · '+d.name,section:'assets',target:r.id,sourceId:r.id,state:'open'});
  if(!d.assetKind&&d.holderKind==='contractor')work.push({id:'assets:'+r.id+':annual',title:'تأیید کتبی سالانه · '+d.name,section:'assets',target:'asset-legacy:'+r.id,sourceId:r.id,state:'open'});
 }
 const clearances=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='asset_clearance' AND json_extract(data,'$.state')='open' ORDER BY id LIMIT 101").all()).results as any[];
 for(const r of clearances){const d=JSON.parse(r.data);work.push({id:'assets:'+r.id+':clearance',title:'تسویه اموال ترک کار · '+d.memberName,section:'assets',target:'asset-legacy:'+r.id,sourceId:r.id,state:'open'});}
 return {work:work.slice(0,limit),pendingQuality:0,workHasMore:rows.length>limit||clearances.length>limit||work.length>limit};
}
