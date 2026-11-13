import {storage} from './storage';
import {assetIdentity,technicalAsset} from './asset-workflow';
import {assetMembers,assetInternal} from './assets';
import {storedAccessPermissions} from './permissions';
import {dayAt} from './duties';
export function assetServiceDue(d:any){const p=d.servicePlan;return !!p&&(!!p.nextDay&&p.nextDay<=dayAt()||p.hours>0&&(d.meters?.hours||0)-p.baselineHours>=p.hours||p.cycles>0&&(d.meters?.cycles||0)-p.baselineCycles>=p.cycles);}
// Stable tasks are derived from each current record. Revocation retires old ownership on the next tick.
export async function syncAssetWorkflowTasks(){const db=storage(),policy:any=await db.prepare("SELECT data FROM flow_entities WHERE id='asset-disposal-policy'").first(),delegatedRole=policy?JSON.parse(policy.data).roleId:'',members=await assetMembers(),keepers=members.filter(assetInternal).filter(m=>storedAccessPermissions(m.permissions).assetRoles?.includes('custodian')).map(m=>m.id),now=new Date().toISOString();let after='';
 while(true){const rows=(await db.prepare("SELECT id,data,revision FROM flow_entities WHERE type='asset_item' AND id>? ORDER BY id LIMIT 100").bind(after).all()).results as any[];if(!rows.length)break;
  for(const r of rows){const d=JSON.parse(r.data),wanted:{member:string;stage:string;title:string}[]=[],add=(ids:string[],stage:string,title:string)=>ids.forEach(member=>wanted.push({member,stage,title}));
   if(d.lifecycle!=='disposed'){
    if(d.pending){const p=d.pending;add(p.state==='awaiting_approval'?keepers:p.kind==='employee'?[p.holderId]:keepers,'transfer:'+p.id+':'+p.state,p.state==='awaiting_approval'?'مجوز انتقال اموال':'پیگیری تحویل اموال');}
    if(d.signatureRequired&&!d.signedReceiptId)add(keepers,'signature:'+d.custodyId,'رسید امضاشده تحویل اموال');
    if(d.annualDue&&d.annualDue<=dayAt())add(keepers,'presence:'+d.custodyId+':'+d.annualDue,'تأیید دوره‌ای اموال امانی');
    if(d.returnDue&&d.returnDue<=dayAt()&&!d.continuous)add(keepers,'return:'+d.custodyId,'پیگیری برگشت اموال امانی');
    if(d.issue?.state==='open')add(d.technicalId?[d.technicalId]:keepers,'fault:'+d.issue.id,'بررسی خرابی / خطر اموال');
    if(assetServiceDue(d))add([...new Set([...keepers,d.servicePlan.executorId].filter(Boolean))],'service:'+d.servicePlan.baseAt,'سرویس سررسیدشده اموال');
    if(d.service?.state==='awaiting_review')add(d.technicalId?[d.technicalId]:keepers,'review:'+d.service.id,'تأیید فنی پایان سرویس');
    if(d.disposal?.state==='pending')add(members.filter(assetInternal).filter(m=>{const p=storedAccessPermissions(m.permissions);return p.assetRoles?.includes('disposal')||p.supplyRoles?.includes('ceo')||!!delegatedRole&&p.roleAssignment?.roles?.includes(delegatedRole)}).map(m=>m.id),'disposal:'+d.disposal.id,'تصمیم خروج اموال');
   }
   if(d.financeFollowup?.state==='open')add(members.filter(assetInternal).filter(m=>storedAccessPermissions(m.permissions).supplyRoles?.includes('finance')).map(m=>m.id),'finance:'+d.disposal.id,'ثبت اثر مالی خروج اموال');
   const existing=(await db.prepare("SELECT id,data,state FROM duty_runs WHERE template_id='asset-workflow' AND json_extract(data,'$.sourceId')=? AND state IN ('open','blocked','submitted') LIMIT 200").bind(r.id).all()).results as any[],ids=new Set(wanted.map(w=>'asset-work:'+r.id+':'+w.stage+':'+w.member));
   for(const w of wanted){const id='asset-work:'+r.id+':'+w.stage+':'+w.member,data={assetWorkflowV2:true,recordId:r.id,sourceId:r.id,sourceSection:'assets',stage:w.stage,title:w.title+' · '+d.name,instructions:'از پرونده اموال، اقدام مجاز را ثبت کنید.',history:[]};await db.prepare("INSERT OR IGNORE INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,'asset-workflow',?,?,'@admin',?,'open',?,1,?,?)").bind(id,r.id+':'+w.stage,w.member,now,JSON.stringify(data),now,now).run();}
   for(const t of existing)if(!ids.has(t.id))await db.prepare("UPDATE duty_runs SET state='cancelled',revision=revision+1,updated=? WHERE id=? AND state IN ('open','blocked','submitted')").bind(now,t.id).run();
  }after=rows.at(-1)!.id;if(rows.length<100)break;
 }
}
