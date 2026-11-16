import {validateInboxVoice} from '@/lib/inbox-voice';
import {checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {requireInboxAccess,inboxAccess,inboxClosed,checkInboxMailbox,inboxMailbox,inboxDirectory,prepareInboxCreate,inboxCreateGuards} from '@/lib/inbox';
import {firmwareBucket,boundedBody} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
import {validateFinanceFile,MAX_FINANCE_BYTES} from '@/lib/finance-control';
const present=(r:any)=>{const d=JSON.parse(r.data);delete d.objectKey;return {id:r.id,...d};};
export async function GET(request:Request){try{const u=await requireInboxAccess(),q=new URL(request.url).searchParams,thread=q.get('thread')||'';await inboxAccess(thread,u);const db=storage(),id=q.get('id');if(!id)return Response.json({files:(await db.prepare("SELECT * FROM flow_entities WHERE type='inbox_file' AND json_extract(data,'$.thread')=? ORDER BY created DESC LIMIT 100").bind(thread).all()).results.map(present)},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 const row:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='inbox_file' AND json_extract(data,'$.thread')=?").bind(id,thread).first();if(!row)throw new AccessError('فایل یافت نشد.',404);const f=JSON.parse(row.data),object=await firmwareBucket().get(f.objectKey);if(!object)throw new Error('missing');const bytes=await object.arrayBuffer();if(bytes.byteLength!==f.byteSize||await sha256(bytes)!==f.sha256)throw new Error('integrity');const play=q.get('view')==='play'&&f.purpose==='voice'&&['audio/webm','audio/ogg','audio/mp4'].includes(f.audioMime);return new Response(bytes,{headers:{'Content-Type':play?f.audioMime:'application/octet-stream','Content-Disposition':(play?'inline':'attachment')+"; filename=inbox-file; filename*=UTF-8''"+encodeURIComponent(f.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت پیوست انجام نشد.'},{status:503})}}
export async function POST(request:Request){let key='',id='';try{
 checkOrigin(request);const u=await requireInboxAccess(),q=new URL(request.url).searchParams,db=storage(),mailbox=await inboxMailbox(u);checkInboxMailbox(request.headers.get('x-inbox-mailbox'),mailbox.id);
 id=q.get('requestId')||'';if(!/^[a-f0-9-]{36}$/i.test(id))throw new AccessError('شناسه فایل معتبر نیست.',400);
 const suppliedThread=q.get('thread')||'',recipientId=q.get('recipientId')||'',purpose=q.get('purpose')||'document';
 if(!['voice','document'].includes(purpose)||!!suppliedThread===!!recipientId)throw new AccessError('یک گفت‌وگو یا یک گیرنده مشخص کنید.',400);
 if(purpose==='voice'&&q.get('confirmed')!=='true')throw new AccessError('تأیید ارسال پیام صوتی لازم است.',400);
 const thread=suppliedThread||'inbox-direct:'+id;let t:any=null,prepared:any=null;
 if(suppliedThread)t=await inboxAccess(thread,u);else {
  // Shared recipient selection and profile mailbox rules; no placeholder text message is posted.
  const dir=await inboxDirectory(u);const person=dir.people.find(p=>p.id===recipientId);
  prepared=await prepareInboxCreate(u,{recipientType:'person',recipientId,kind:'message',priority:'normal',title:person?.name||'',body:purpose==='voice'?'پیام صوتی':'پیوست'},new Date(),dir);
  const exists=await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='inbox_thread'").bind(thread).first();if(exists)t=await inboxAccess(thread,u);
 }
 if(t&&t.data.kind==='message'&&t.data.recipientType==='person'&&(u.permissions.salesAgentId||u.profileReview?.id==='sales-representative')){const peer=t.isSender?t.data.recipientId:t.data.sender;if(!(await inboxDirectory(u)).people.some(p=>p.id===peer))throw new AccessError('این مخاطب برای ارسال پیام در دسترس نیست.',403);}
 const ct=request.headers.get('content-type')||'',bytes=await boundedBody(request,MAX_FINANCE_BYTES+128000),form=await new Response(bytes,{headers:{'Content-Type':ct}}).formData(),file=form.get('file');
 if(!file||typeof file==='string'||form.getAll('file').length!==1)throw new AccessError('یک فایل انتخاب کنید.',400);
 const buffer=await file.arrayBuffer(),audioMime=purpose==='voice'?validateInboxVoice(file.name,new Uint8Array(buffer)):'';
 if(purpose!=='voice')try{validateFinanceFile(file.name,file.size)}catch(e){throw new AccessError((e as Error).message,400)}
 const rawDuration=form.get('durationMs'),durationMs=rawDuration===null?null:Number(rawDuration);if(durationMs!==null&&(!Number.isInteger(durationMs)||durationMs<1||durationMs>300000))throw new AccessError('مدت پیام صوتی معتبر نیست.',400);
 const hash=await sha256(buffer),old:any=await db.prepare('SELECT * FROM flow_entities WHERE id=?').bind(id).first();
 if(old){const f=JSON.parse(old.data);if(old.type!=='inbox_file'||f.thread!==thread||f.sha256!==hash||f.filename!==file.name||f.author!==mailbox.id||(f.purpose||'document')!==purpose||(f.originRecipient||'')!==recipientId||((f.durationMs??null)!==durationMs))throw new AccessError('شناسه فایل تکراری است.',409);return Response.json({file:present(old),threadId:thread,repeated:true});}
 if(t&&inboxClosed(t.data.state))throw new AccessError('گفت‌وگو بسته است.',400);
 const count:any=await db.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='inbox_file' AND json_extract(data,'$.thread')=?").bind(thread).first();if(count.n>=100)throw new AccessError('حداکثر ۱۰۰ پیوست در هر گفت‌وگو.',400);
 key='inbox-files/'+id+'/'+crypto.randomUUID();await firmwareBucket().put(key,buffer,{httpMetadata:{contentType:'application/octet-stream'},sha256:hash});const now=new Date().toISOString(),f={thread,objectKey:key,filename:file.name,byteSize:buffer.byteLength,sha256:hash,author:mailbox.id,authorName:mailbox.name,created:now,purpose,audioMime,durationMs,originRecipient:recipientId},sentRevision=(t?.revision||0)+1,checks:D1PreparedStatement[]=[],body=purpose==='voice'?'پیام صوتی':'پیوست: '+file.name;
 if(t)checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(thread,t.revision,id));
 else checks.push(...inboxCreateGuards(db,id,'person',recipientId));
 if(!mailbox.profileTitle&&mailbox.id!=='@owner')checks.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active') THEN guard ELSE 0 END WHERE id=?").bind(mailbox.id,id));
 if(t?.data.recipientType==='position'&&!t.isSender)checks.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities p,json_each(p.data,'$.members') m WHERE p.id=? AND p.type='position' AND json_extract(p.data,'$.active')=1 AND m.value=?) THEN guard ELSE 0 END WHERE id=?").bind(t.data.recipientId,mailbox.id,id));
 checks.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE type='inbox_file' AND json_extract(data,'$.thread')=?)<100 THEN guard ELSE 0 END WHERE id=?").bind(thread,id));
 const data={...(t?.data||prepared.data),...((t?.data||prepared.data).kind==='message'&&(t?.data||prepared.data).recipientType==='person'?{lastMessage:body.slice(0,160)}:{})};
 await db.batch([
 db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'inbox_file',?,?,?,1)").bind(id,JSON.stringify({thread,purpose,hash}),u.userId,now),...checks,
 t?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,thread,t.revision):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_thread',?,1,?,?)").bind(thread,JSON.stringify(data),now,now),
 db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_file',?,1,?,?)").bind(id,JSON.stringify(f),now,now),
 db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_message',?,1,?,?)").bind('inbox-upload:'+id,JSON.stringify({thread,mode:'attachment',body,author:mailbox.id,authorName:mailbox.name,viaAssistant:false,sentRevision}),now,now),
 db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_state',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind('inbox-state:'+thread+':'+mailbox.id,JSON.stringify({readRevision:sentRevision,snoozeUntil:''}),now,now),
 db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,thread,'inbox_file',JSON.stringify({fileId:id,purpose,...(mailbox.profileTitle?{profileMailbox:mailbox.id}:{})}),now)]);
 return Response.json({file:{id,...f,objectKey:undefined},threadId:thread},{status:201});
 }catch(e){if(key&&id)try{const linked:any=await storage().prepare("SELECT * FROM flow_entities WHERE id=? AND type='inbox_file'").bind(id).first();if(linked&&JSON.parse(linked.data).objectKey===key)return Response.json({file:present(linked),threadId:JSON.parse(linked.data).thread},{status:201});await firmwareBucket().delete(key)}catch{}return accessResponse(e)||Response.json({error:'پیوست ذخیره نشد؛ صندوق را تازه کنید.'},{status:409})}}
