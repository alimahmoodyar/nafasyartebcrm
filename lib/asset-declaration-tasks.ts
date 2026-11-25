import {storage} from './storage';
import {assetRows,assetMembers,assetInternal,assetMemberGuard,assetSnapshotGuard} from './assets';
import {storedAccessPermissions} from './permissions';
import {trainingContext} from './training-context';
import {dayAt,notice} from './duties';
export async function syncDeclarationTasks(){
 if(trainingContext.getStore())return;const db=storage(),rows=await assetRows(),members=await assetMembers(),custodians=members.filter(assetInternal).filter(m=>storedAccessPermissions(m.permissions).assetRoles?.includes('custodian')).map(m=>m.id),existing=(await db.prepare("SELECT * FROM duty_runs WHERE template_id='asset-declarations'").all()).results as any[],wanted=new Set<string>(),now=new Date().toISOString();
 for(const r of rows.filter(r=>r.type==='asset_declaration'&&['submitted','returned'].includes(r.data.state))){
  const review=r.data.state==='submitted',eligible=custodians.filter(id=>id!==r.data.memberId),assignees=review?(eligible.length?eligible:['@admin']):[r.data.memberId];
  for(const mid of assignees){const id='asset-declaration-task:'+r.id+':'+r.revision+':'+mid;wanted.add(id);if(existing.some(x=>x.id===id&&['open','blocked','submitted'].includes(x.state)))continue;
   const op=crypto.randomUUID(),title=review?'بررسی موجودی اولیه · '+r.data.memberName:'اصلاح اعلام اموال من',target='asset-declaration:'+r.id,data={assetWorkflow:true,assetDeclaration:true,recordId:target,sourceId:r.id,sourceSection:review?'assets':'personnel',title,positionName:review?'اموالدار':'پرتال شخصی',instructions:review?'اعلام، عکس‌های شماره‌دار و دارنده فعلی را تطبیق دهید. مال تکراری نسازید؛ موجودی ابتدای استقرار را با تاریخ بررسی ثبت کنید.':'نظر اموالدار را بخوانید، همان اعلام را اصلاح و دوباره ارسال کنید.',history:[]};
   await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'asset_declaration_task','{}','scheduler',?,1)").bind(op,now),assetMemberGuard(db,op,members),assetSnapshotGuard(db,op,rows),db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,'asset-declarations',?,?,'@admin',?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',revision=duty_runs.revision+1,updated=excluded.updated WHERE duty_runs.state IN ('cancelled','completed')").bind(id,r.id+':'+r.revision,mid,dayAt()+'T16:00:00+03:30',JSON.stringify(data),now,now),notice(id,mid,'asset-declaration',title,now)]);
  }
 }
 for(const task of existing.filter(t=>!wanted.has(t.id)&&['open','blocked','submitted'].includes(t.state))){const d=JSON.parse(task.data),r=rows.find(r=>r.id===d.sourceId),op=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'asset_declaration_task_retire','{}','scheduler',?,1)").bind(op,now),assetMemberGuard(db,op,members),assetSnapshotGuard(db,op,rows),db.prepare('UPDATE duty_runs SET state=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(r&&r.data.state!=='withdrawn'&&task.period!==r.id+':'+r.revision?'completed':'cancelled',now,task.id,task.revision)]);}
}
