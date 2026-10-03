import {requireAccess,requireAdmin,checkOrigin,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody,firmwareBucket} from '@/lib/firmware-storage';
import {hashPassword,password as validatePassword,digest} from '@/lib/password-auth';
import {localDay} from '@/lib/persian-date';
import {resetTables,resetScopes,resetPreserved,resetCatalog,resetWhere,resetHelp} from '@/lib/reset-contract';
import {resetControl,resetSecret,resetCounts,resetFiles,readResetBackup,resetCode,publicResetJob,resetAudit,resetFail as fail} from '@/lib/system-reset';
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
const uuid=(x:any)=>{if(typeof x!=='string'||! /^[a-f0-9-]{36}$/i.test(x))fail('شناسه معتبر لازم است.');return x as string};
function account(r:Request,u:any){const expected=r.headers.get('x-assistant-account');if(expected&&expected!==u.userId)fail('حساب تغییر کرده است؛ صفحه را تازه کنید.',409);}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams;if(q.get('view')==='state'){const u=await requireAccess();account(request,u);const c=await resetControl();return json({accountId:u.userId,phase:c.phase});}
 const u=await requireAdmin();account(request,u);const c=await resetControl(),db=storage(),scope=q.get('scope')||'operations';if(!Object.hasOwn(resetScopes,scope))fail('محدوده معتبر انتخاب کنید.');
 const jobs=(await db.prepare('SELECT * FROM reset_jobs ORDER BY created DESC LIMIT 20').all()).results;
 return json({accountId:u.userId,phase:c.phase,hasPassword:!!c.password_hash,revision:c.revision,activeJobId:c.job_id,scopes:resetScopes,preserved:resetPreserved,catalog:resetCatalog,help:resetHelp,counts:await resetCounts(scope),scope,jobs:jobs.map(publicResetJob)});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت تنظیمات پاک‌سازی ممکن نشد؛ مهاجرت 0016 سرور را بررسی کنید.'},{status:503})}}
export async function POST(request:Request){let preparing='';try{
 checkOrigin(request);const u=await requireAdmin();account(request,u);const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000))),db=storage(),c=await resetControl();
 if(b.confirmed!==true)fail('تأیید صریح این عملیات لازم است.');
 if(!['password','prepare','cancel','execute'].includes(b.mode))fail('عملیات معتبر نیست.');
 const allowed=['mode','confirmed',...(b.mode==='password'?['password','currentPassword','revision']:b.mode==='prepare'?['id','scope','password']:b.mode==='cancel'?['id']:['id','password','confirmationCode','backupAcknowledged'])];
 if(Object.keys(b).some(k=>!allowed.includes(k)))fail('فیلد نامعتبر در درخواست.');
 if(b.mode==='password'){
  if(c.phase!=='testing'||b.revision!==c.revision)fail('تنظیم رمز اکنون مجاز نیست؛ وضعیت را تازه کنید.',409);
  if(c.password_hash)await resetSecret(b.currentPassword,c.password_hash);
  try{validatePassword(b.password)}catch{fail('رمز مستقل ۱۰ تا ۱۲۸ نویسه‌ای لازم است.')}
  const hash=await hashPassword(b.password),now=new Date().toISOString();
  await db.batch([db.prepare("UPDATE reset_control SET internal=CASE WHEN phase='testing' AND revision=? THEN 0 ELSE 2 END WHERE id=1").bind(c.revision),db.prepare('UPDATE reset_control SET password_hash=?,revision=revision+1,updated=? WHERE id=1').bind(hash,now),resetAudit(u.userId,'reset_control','password',{configured:true})]);return json({accountId:u.userId,saved:true});
 }
 const id=uuid(b.id),existing:any=await db.prepare('SELECT * FROM reset_jobs WHERE id=?').bind(id).first();
 if(existing&&existing.owner!==u.userId&&b.mode!=='cancel')fail('این عملیات متعلق به مدیر دیگری است.',403);
 if(b.mode==='cancel'){
  if(!existing)fail('پیش‌نمایش پیدا نشد.',404);if(existing.state==='cancelled')return json({accountId:u.userId,cancelled:true});if(!['preparing','ready'].includes(existing.state))fail('این عملیات قابل لغو نیست.',409);
  await db.batch([db.prepare("UPDATE reset_jobs SET guard=CASE WHEN state IN ('preparing','ready') AND EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND job_id=?) THEN 1 ELSE 0 END WHERE id=?").bind(id,id),db.prepare("UPDATE reset_jobs SET state='cancelled' WHERE id=?").bind(id),db.prepare("UPDATE reset_control SET phase='testing',job_id=NULL,internal=0,revision=revision+1,updated=? WHERE id=1 AND job_id=?").bind(new Date().toISOString(),id),resetAudit(u.userId,id,'cancel',{})]);return json({accountId:u.userId,cancelled:true});
 }
 if(b.mode==='execute'&&existing?.state==='succeeded')return json({accountId:u.userId,saved:true,repeated:true,job:publicResetJob(existing)});
 if(c.phase==='live')fail('کار اصلی شروع شده است؛ پاک‌سازی آزمایشی برای این نصب قفل است.',409);
 await resetSecret(b.password,c.password_hash);
 if(b.mode==='prepare'){
  if(!Object.hasOwn(resetScopes,b.scope))fail('محدوده معتبر لازم است.');
  if(existing){if(existing.scope!==b.scope)fail('شناسه برای محدوده دیگری استفاده شده است.',409);if(existing.state==='ready')return json({accountId:u.userId,job:publicResetJob(existing)});fail('این شناسه قبلاً استفاده شده؛ وضعیت را بررسی کنید.',409);}
  if(c.phase!=='testing')fail('پیش‌نمایش دیگری فعال است؛ آن را بررسی یا لغو کنید.',409);
  const now=new Date().toISOString(),expires=new Date(Date.now()+30*60000).toISOString();
  await db.batch([db.prepare("INSERT INTO reset_jobs(id,owner,scope,state,created,expires,guard) VALUES(?,?,?,'preparing',?,?,CASE WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='testing' AND revision=?) THEN 1 ELSE 0 END)").bind(id,u.userId,b.scope,now,expires,c.revision),db.prepare("UPDATE reset_control SET phase='maintenance',job_id=?,revision=revision+1,updated=? WHERE id=1").bind(id,now),resetAudit(u.userId,id,'prepare',{scope:b.scope})]);preparing=id;
  // Database triggers freeze every business table, including writes from already-running requests and schedulers.
  const counts=await resetCounts(b.scope);if(counts.reduce((n,r)=>n+r.count,0)>100000)fail('این حجم داده نیاز به پشتیبان‌گیری توسط همکار فنی دارد؛ چیزی حذف نشد.',413);
  const names=Object.keys(resetTables),rows=await db.batch(names.map(t=>db.prepare(`SELECT * FROM ${t} WHERE ${resetWhere(t,b.scope)}`))),tables=Object.fromEntries(names.map((t,i)=>[t,rows[i].results]));
  const templates=(await db.prepare("SELECT * FROM flow_entities WHERE type='duty_template'").all()).results;
  const backup={format:'hamnafas-reset-v1',jobId:id,scope:b.scope,created:now,actor:u.userId,tables,preservedTemplateState:templates,files:resetFiles(tables),notice:'JSON includes business records and file manifest; attachments are retained privately in the same object store, not embedded. Accounts, credentials, audit, development requests and agent identities are not erased.'};
  const raw=JSON.stringify(backup),size=new TextEncoder().encode(raw).length;if(size>20*1024*1024)fail('نسخه پشتیبان بزرگ‌تر از حد پاک‌سازی داخلی است؛ همکار فنی پشتیبان بگیرد. چیزی حذف نشد.',413);
  const hash=await digest(raw),key='system-reset-backups/'+id+'/data.json';await firmwareBucket().put(key,raw,{httpMetadata:{contentType:'application/json'},sha256:hash});await readResetBackup({backup_key:key,backup_hash:hash});
  const summary={counts,total:counts.reduce((n,r)=>n+r.count,0),files:backup.files.length,pausedTemplates:templates.length};
  await db.batch([db.prepare("UPDATE reset_jobs SET guard=CASE WHEN state='preparing' AND EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND job_id=? AND phase='maintenance') THEN 1 ELSE 0 END WHERE id=?").bind(id,id),db.prepare("UPDATE reset_jobs SET state='ready',backup_key=?,backup_hash=?,byte_size=?,summary=? WHERE id=?").bind(key,hash,size,JSON.stringify(summary),id)]);preparing='';
  return json({accountId:u.userId,job:publicResetJob(await db.prepare('SELECT * FROM reset_jobs WHERE id=?').bind(id).first())});
 }
 if(!existing||existing.state!=='ready'||c.phase!=='maintenance'||c.job_id!==id)fail('پیش‌نمایش آماده و متعلق به همین نشست لازم است.',409);
 if(existing.expires<=new Date().toISOString())fail('مهلت پیش‌نمایش پایان یافته؛ لغو کنید و دوباره بسازید.',409);
 if(b.confirmationCode!==resetCode(id)||b.backupAcknowledged!==true||!existing.downloaded_at)fail('نسخه پشتیبان را دریافت کنید و کد تأیید همان پیش‌نمایش را دقیق وارد کنید.');
 await readResetBackup(existing);
 const now=new Date().toISOString(),statements:D1PreparedStatement[]=[
  db.prepare("UPDATE reset_jobs SET guard=CASE WHEN state='ready' AND expires>? AND downloaded_at IS NOT NULL AND EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND job_id=?) THEN 1 ELSE 0 END WHERE id=?").bind(now,id,id),
  db.prepare('UPDATE reset_control SET internal=1 WHERE id=1'),
  ...Object.keys(resetTables).map(t=>db.prepare(`DELETE FROM ${t} WHERE ${resetWhere(t,existing.scope)}`)),
  // Prevent old daily periods or cached assistant/SSE results resurfacing after a clean start.
  db.prepare("UPDATE flow_entities SET data=json_set(data,'$.active',json('false'),'$.lastDay',NULL,'$.startDate',?),revision=revision+1,updated=? WHERE type='duty_template'").bind(localDay(),now),
  db.prepare('DELETE FROM mcp_messages'),db.prepare('DELETE FROM mcp_streams'),db.prepare('DELETE FROM password_sessions'),
  db.prepare("UPDATE reset_jobs SET state='succeeded',completed=? WHERE id=?").bind(now,id),
  db.prepare("UPDATE reset_control SET phase='live',internal=0,password_hash=NULL,revision=revision+1,updated=? WHERE id=1").bind(now),
  resetAudit(u.userId,id,'completed',{scope:existing.scope,backupHash:existing.backup_hash,summary:JSON.parse(existing.summary)})
 ];await db.batch(statements);
 return json({accountId:u.userId,saved:true,relogin:true,job:publicResetJob(await db.prepare('SELECT * FROM reset_jobs WHERE id=?').bind(id).first())});
 }catch(e){if(preparing)try{const db=storage();await db.batch([db.prepare("UPDATE reset_jobs SET state='failed' WHERE id=? AND state='preparing'").bind(preparing),db.prepare("UPDATE reset_control SET phase='testing',job_id=NULL,internal=0,revision=revision+1,updated=? WHERE id=1 AND job_id=? AND phase='maintenance' AND EXISTS(SELECT 1 FROM reset_jobs WHERE id=? AND state='failed')").bind(new Date().toISOString(),preparing,preparing)]);}catch{}return accessResponse(e)||Response.json({error:'عملیات کامل نشد یا نتیجه قطعی نیست؛ وضعیت را تازه کنید. پیش از بررسی دوباره اجرا نکنید.'},{status:409})}}
