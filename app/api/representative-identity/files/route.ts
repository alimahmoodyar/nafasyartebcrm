import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {identityAgentAccess,identityGroup,identityAuthorityGuard} from '@/lib/representative-identity';
import {storage} from '@/lib/storage';
import {boundedBody,firmwareBucket} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
import {MAX_BATCH_FILE_BYTES,validateBatchFile} from '@/lib/batch-files';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function get(r:Request){try{
 const u=await requireAccess(),q=new URL(r.url).searchParams,{agent}=await identityAgentAccess(u,q.get('kind')||'',q.get('agentId')||''),group=await identityGroup(agent),row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='representative_identity_file'").bind(q.get('id')||'').first();
 const d=row?JSON.parse(row.data):null;if(!d||!(group.some(a=>a.id===d.agentId)||agent.data.identityId&&d.identityId===agent.data.identityId))fail('مدرک در دسترسی شما نیست.',404);
 if(q.get('metadata')==='1')return json({id:q.get('id'),filename:d.filename,size:d.size,title:d.title});
 const object=await firmwareBucket().get(d.objectKey);if(!object)fail('فایل موقتاً در دسترس نیست.',503);const raw=await object!.arrayBuffer();if(raw.byteLength!==d.size||await sha256(raw)!==d.sha256)fail('یکپارچگی فایل تأیید نشد.',503);
 return new Response(raw,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=identity-document; filename*=UTF-8''"+encodeURIComponent(d.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
 }catch(e){return accessResponse(e)||json({error:'مدرک دریافت نشد.'},503)}}
async function post(r:Request){let key='',id='';try{
 checkOrigin(r);const u=await requireAccess(),ct=r.headers.get('content-type')||'';if(!ct.startsWith('multipart/form-data;'))fail('یک فایل لازم است.');
 const bytes=await boundedBody(r,MAX_BATCH_FILE_BYTES+10000),form=await new Response(bytes,{headers:{'Content-Type':ct}}).formData(),meta=form.get('metadata'),file=form.get('file');if(typeof meta!=='string'||meta.length>4000||!file||typeof file==='string'||form.getAll('file').length!==1)fail('فایل و مشخصات معتبر لازم است.');
 const b=JSON.parse(meta as string);id=b.id;if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)||b.confirmed!==true||typeof b.title!=='string'||!b.title.trim()||b.title.length>200)fail('شناسه، عنوان و تأیید فایل لازم است.');
 const f=file as File;validateBatchFile(f.name,f.size);if(!/\.(pdf|png|jpe?g|webp)$/i.test(f.name))fail('مدرک باید PDF یا تصویر باشد.');
 const {agent,u:currentUser}=await identityAgentAccess(u,b.kind,b.agentId),group=await identityGroup(agent),db=storage(),raw=await f.arrayBuffer(),hash=await sha256(raw),signature=JSON.stringify({kind:b.kind,agentId:agent.id,title:b.title,filename:f.name,size:f.size,hash});
 const old:any=await db.prepare('SELECT * FROM flow_entities WHERE id=?').bind(id).first();if(old){const d=JSON.parse(old.data);if(old.type!=='representative_identity_file'||d.signature!==signature||d.actor!==u.userId)fail('شناسه فایل تکراری است.',409);return json({saved:true,repeated:true,id,filename:f.name,title:b.title});}
 // A bound on all uploads prevents unbounded abandoned draft documents per agency.
 const count:any=await db.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='representative_identity_file' AND json_extract(data,'$.agentId') IN (SELECT value FROM json_each(?))").bind(JSON.stringify(group.map(a=>a.id))).first();if(count.n>=100)fail('حد مدارک این نمایندگی پر شده؛ با مدیر سامانه هماهنگ کنید.',409);
 key='representative-identity/'+id+'/'+crypto.randomUUID();await firmwareBucket().put(key,raw,{httpMetadata:{contentType:'application/octet-stream'},sha256:hash});
 const now=new Date().toISOString(),data={agentId:agent.id,identityId:agent.data.identityId||'',title:b.title.trim(),filename:f.name,size:f.size,sha256:hash,objectKey:key,actor:u.userId,signature};
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'representative_identity_file',?,?,?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END)").bind(id,signature,u.userId,now,agent.id,agent.revision),...await identityAuthorityGuard(currentUser,id),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'representative_identity_file',?,1,?,?)").bind(id,JSON.stringify(data),now,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,agent.data.identityId||agent.id,'representative_identity_file',JSON.stringify({id,filename:f.name,sha256:hash}),now)]);
 return json({saved:true,id,filename:f.name,title:b.title.trim()},201);
 }catch(e){if(key)try{const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='representative_identity_file'").bind(id).first();if(row&&JSON.parse(row.data).objectKey===key)return json({saved:true,id});await firmwareBucket().delete(key)}catch{console.error('Identity file reconciliation deferred')}
 return accessResponse(e)||json({error:'مدرک ثبت نشد؛ با همان شناسه دوباره تلاش کنید.'},409)}}
export const GET=withServiceRolePreview(get);export const POST=withServiceRolePreview(post);
