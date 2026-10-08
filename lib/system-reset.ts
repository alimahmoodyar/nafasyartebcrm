import {storage} from './storage';
import {AccessError} from './authorization';
import {firmwareBucket} from './firmware-storage';
import {digest,verifyPassword} from './password-auth';
import {resetTables,resetWhere} from './reset-contract';
export const resetFail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export async function resetControl(){const row:any=await storage().prepare('SELECT * FROM reset_control WHERE id=1').first();if(!row)resetFail('مهاجرت 0016 روی سرور اجرا نشده است.',503);return row;}
export async function resetSecret(value:unknown,hash:string|null){
 if(!hash)resetFail('ابتدا رمز مستقل پاک‌سازی را در صفحه امن تنظیم کنید.');
 if(typeof value!=='string'||value.length<10||value.length>128)resetFail('رمز پاک‌سازی معتبر نیست.',403);
 const now=new Date().toISOString(),db=storage();const r:any=await db.prepare("INSERT INTO login_attempts(key,count,reset) VALUES('system-reset-secret',1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count AS n").bind(new Date(Date.now()+15*60000).toISOString(),now,now).first();
 if(r.n>5)resetFail('تعداد تلاش زیاد است؛ ۱۵ دقیقه بعد دوباره امتحان کنید.',429);
 if(!await verifyPassword(value as string,hash!))resetFail('رمز پاک‌سازی درست نیست.',403);
 await db.prepare("DELETE FROM login_attempts WHERE key='system-reset-secret'").run();
}
export const resetCode=(id:string)=>'RESET-'+id.slice(0,8).toUpperCase();
export function publicResetJob(j:any){if(!j)return null;return {id:j.id,scope:j.scope,state:j.state,created:j.created,expires:j.expires,byteSize:j.byte_size,summary:j.summary?JSON.parse(j.summary):null,downloadedAt:j.downloaded_at,completed:j.completed,confirmationCode:resetCode(j.id),hasBackup:!!j.backup_key};}
export async function resetCounts(scope:string){const db=storage(),tables=Object.keys(resetTables),rows=await db.batch(tables.map(t=>db.prepare(`SELECT COUNT(*) AS count FROM ${t} WHERE ${resetWhere(t,scope)}`)));return tables.map((table,i)=>({table,label:resetTables[table],count:Number((rows[i].results[0] as any).count)}));}
export function resetFiles(tables:Record<string,any[]>){
 const files=new Map<string,{key:string;filename:string;size:number;sha256:string}>();
 for(const [table,rows] of Object.entries(tables))for(const r of rows){let f:any=null;
  if(['batch_files','quality_files','firmware_files','finance_files','duty_files','service_files'].includes(table))f={key:r.object_key,filename:r.filename,size:r.byte_size,sha256:r.sha256};
  if(table==='flow_entities'&&['shipment_file','hr_file','guarantee_file','payable_file','settlement_file','expense_file','hospital_file','sales_file','supplier_document','transport_file','inbox_file'].includes(r.type)){const d=JSON.parse(r.data);f={key:d.objectKey,filename:d.filename,size:d.byteSize||d.size,sha256:d.sha256};}
  if(f?.key)files.set(f.key,f);
 }return [...files.values()];
}
export async function readResetBackup(job:any){if(!job.backup_key||!job.backup_hash)resetFail('نسخه پشتیبان آماده نیست.',409);const obj=await firmwareBucket().get(job.backup_key);if(!obj)resetFail('فایل پشتیبان در دسترس نیست؛ حذف انجام نمی‌شود.',503);const raw=await obj!.text();if(await digest(raw)!==job.backup_hash)resetFail('صحت فایل پشتیبان تأیید نشد؛ حذف انجام نمی‌شود.',503);return {raw,data:JSON.parse(raw)};}
export const resetAudit=(actor:string,id:string,action:string,data:unknown)=>storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,id,'system_reset_'+action,JSON.stringify(data),new Date().toISOString());
