import {requireAdmin,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {firmwareBucket} from '@/lib/firmware-storage';
import {readResetBackup,resetAudit,resetFail as fail} from '@/lib/system-reset';
import {sha256} from '@/lib/firmware';
export async function GET(request:Request){try{
 const u=await requireAdmin();if(request.headers.get('x-assistant-account')&&request.headers.get('x-assistant-account')!==u.userId)fail('حساب تغییر کرده است.',409);const q=new URL(request.url).searchParams,id=q.get('id')||'',db=storage(),j:any=await db.prepare('SELECT * FROM reset_jobs WHERE id=?').bind(id).first();
 if(!j||!j.backup_key)fail('نسخه پشتیبان پیدا نشد.',404);const {raw,data}=await readResetBackup(j);
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"};
 if(q.get('view')==='files')return Response.json({files:data.files.map((f:any,i:number)=>({index:i,filename:f.filename,size:f.size}))},{headers});
 if(q.has('file')){const i=Number(q.get('file'));if(!Number.isInteger(i)||i<0||i>=data.files.length)fail('فایل پشتیبان معتبر نیست.');const f=data.files[i],o=await firmwareBucket().get(f.key);if(!o)fail('پیوست در مخزن سرور موجود نیست.',404);const bytes=await o!.arrayBuffer();if(f.sha256&&await sha256(bytes)!==f.sha256)fail('صحت پیوست تأیید نشد.',503);await db.batch([resetAudit(u.userId,id,'download_file',{index:i})]);return new Response(bytes,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=backup-file; filename*=UTF-8''"+encodeURIComponent(f.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}});}
 await db.batch([db.prepare('UPDATE reset_jobs SET downloaded_at=COALESCE(downloaded_at,?) WHERE id=?').bind(new Date().toISOString(),id),resetAudit(u.userId,id,'download',{})]);
 return new Response(raw,{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="hamnafas-before-reset-'+id+'.json"'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت پشتیبان ممکن نشد.'},{status:503})}}
