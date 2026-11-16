import type {Session} from './permissions';
import {storage} from './storage';
import {assetFail,assetMemberGuard} from './assets';
import {boundedBody,firmwareBucket} from './firmware-storage';
import {MAX_BATCH_FILE_BYTES,validateBatchFile} from './batch-files';
import {sha256} from './firmware';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
function mime(b:Uint8Array){if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';if(b.length>=12&&new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return 'image/webp';return '';}

// Staged images have no effect on custody. Only the matching successful action binds them.
export async function uploadTransferPhoto(request:Request,u:Session,q:URLSearchParams){
 const {accessWorkflowAsset,assetActions,assetRow}=await import('./asset-workflow');
 const id=q.get('id')||'',operationId=q.get('operationId')||'',phase=q.get('phase')||'',filename=(q.get('filename')||'').trim();
 if(!uuid.test(id)||!uuid.test(operationId)||!['sender','receiver'].includes(phase)||!filename||filename.length>180)assetFail('شناسه عملیات، مرحله و نام عکس معتبر لازم است.');
 const {a,r}=await accessWorkflowAsset(u,q.get('assetId')||''),mode=phase==='sender'?'transfer':'accept_transfer';
 const transferId=q.get('transferId')||'';if(!uuid.test(transferId)||phase==='sender'&&transferId!==operationId)assetFail('شناسه انتقال معتبر لازم است.');
 const bytes=await boundedBody(request,MAX_BATCH_FILE_BYTES);try{validateBatchFile(filename,bytes.length)}catch(e){assetFail((e as Error).message)}const imageMime=mime(bytes);if(!imageMime)assetFail('فقط عکس JPEG، PNG یا WebP مجاز است.');
 const hash=await sha256(bytes.buffer as ArrayBuffer),old=await assetRow(id),db=storage();
 if(old){const f=old.data;if(old.type!=='asset_file'||f.purpose!=='transfer_photo'||f.assetId!==r.id||f.actor!==u.userId||f.phase!==phase||f.operationId!==operationId||f.transferId!==transferId||f.assetRevision!==Number(q.get('revision'))||f.filename!==filename||f.sha256!==hash)assetFail('شناسه عکس با محتوای دیگری استفاده شده است.',409);return Response.json({id,repeated:true},{headers});}
 if(!(await assetActions(u,r,a)).includes(mode)||phase==='sender'&&r.data.pending)assetFail('عکس فقط برای مرحله جاری تحویل شما قابل ثبت است.',403);
 if(r.data.lifecycle==='disposed'||phase==='receiver'&&r.data.pending?.id!==transferId)assetFail('انتقال تغییر کرده است.',409);
 if(String(r.revision)!==q.get('revision'))assetFail('پرونده یا انتقال تغییر کرده؛ تازه‌سازی کنید.',409);
 if(await db.prepare('SELECT id FROM inventory_operations WHERE id=?').bind(operationId).first())assetFail('عملیات قبلاً ثبت شده؛ عکس جدید به آن افزوده نمی‌شود.',409);
 const count:any=await db.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='asset_file' AND json_extract(data,'$.purpose')='transfer_photo' AND json_extract(data,'$.operationId')=? AND json_extract(data,'$.actor')=?").bind(operationId,u.userId).first();if(Number(count?.n)>=5)assetFail('حداکثر پنج عکس برای هر مرحله مجاز است.');
 const now=new Date().toISOString(),key='assets/'+r.id+'/'+id+'/'+crypto.randomUUID(),op=crypto.randomUUID(),data={assetId:r.id,custodyId:r.data.custodyId,purpose:'transfer_photo',operationId,transferId,phase,assetRevision:r.revision,filename,mime:imageMime,actor:u.userId,name:u.name,at:now,objectKey:key,sha256:hash,byteSize:bytes.length,eventId:''};
 try{await firmwareBucket().put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});await db.batch([
 db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(op,'asset_transfer_photo',JSON.stringify({id,operationId,transferId,phase,hash}),u.userId,now),
 db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM inventory_operations WHERE id=?) THEN guard ELSE 0 END WHERE id=?').bind(r.id,r.revision,operationId,op),assetMemberGuard(db,op,a.members),
 db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE type='asset_file' AND json_extract(data,'$.purpose')='transfer_photo' AND json_extract(data,'$.operationId')=? AND json_extract(data,'$.actor')=?)<5 THEN guard ELSE 0 END WHERE id=?").bind(operationId,u.userId,op),
 db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'asset_file',?,1,?,?)").bind(id,JSON.stringify(data),now,now),
 db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(op,u.userId,r.id,'asset_transfer_photo_upload',JSON.stringify({id,phase,operationId,transferId}),now)
 ]);}catch(e){try{const linked=await assetRow(id);if(linked?.data.objectKey===key)return Response.json({id},{headers});await firmwareBucket().delete(key);}catch{}throw e;}
 return Response.json({id},{headers});
}

export async function bindTransferPhotos(u:Session,b:any,r:any,guards:D1PreparedStatement[],extras:D1PreparedStatement[]){
 const ids=b.photoFileIds===undefined?[]:b.photoFileIds;
 if(!Array.isArray(ids)||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!uuid.test(id)))assetFail('حداکثر پنج شناسه عکس متفاوت لازم است.');
 if(!['transfer','accept_transfer'].includes(b.mode)){if(ids.length)assetFail('عکس تحویل فقط به مرحله تحویل یا دریافت متصل می‌شود.');return [];}
 const phase=b.mode==='transfer'?'sender':'receiver',transferId=phase==='sender'?b.id:r.data.pending?.id,db=storage(),photos:any[]=[];
 for(const id of ids){const f:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='asset_file'").bind(id).first();const d=f?JSON.parse(f.data):{};
 if(!f||d.purpose!=='transfer_photo'||d.assetId!==r.id||d.actor!==u.userId||d.operationId!==b.id||d.phase!==phase||d.transferId!==transferId||d.assetRevision!==r.revision||d.eventId)assetFail('عکس باید توسط خود شما برای همین مرحله و نسخه تحویل بارگذاری شده باشد.',409);
 guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND data=?) THEN guard ELSE 0 END WHERE id=?').bind(id,f.revision,f.data,b.id));
 extras.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...d,eventId:'asset-event:'+b.id}),new Date().toISOString(),id,f.revision));
 photos.push({id,phase,transferId,actor:d.actor,name:d.name,at:d.at,filename:d.filename});
 }
 return photos;
}

export async function accessTransferPhoto(u:Session,f:any){
 const {accessWorkflowAsset,assetRow}=await import('./asset-workflow');const {r,a}=await accessWorkflowAsset(u,f.data.assetId),d=f.data;
 if(!d.eventId){if(d.actor!==u.userId||d.assetRevision!==r.revision)assetFail('عکس در دسترسی شما نیست.',404);return;}
 const e=await assetRow(d.eventId);if(!e||e.type!=='asset_event'||e.data.assetId!==r.id||!e.data.details?.photos?.some((p:any)=>p.id===f.id&&p.actor===d.actor))assetFail('عکس تحویل معتبر نیست.',404);
 // The same scope as the event history, plus the recipient of the currently pending transfer.
 const privileged=a.custodian||a.ceo||a.disposal||a.finance||!a.external&&(a.admin||a.id===r.data.technicalId);
 if(!privileged&&e.data.custodyId!==r.data.custodyId&&d.transferId!==r.data.custodyId&&d.transferId!==r.data.pending?.id)assetFail('عکس مربوط به تحویل پیشین است.',404);
}
