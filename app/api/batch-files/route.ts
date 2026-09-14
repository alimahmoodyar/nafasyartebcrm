import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {firmwareBucket,boundedBody} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
import {MAX_BATCH_FILE_BYTES,validateBatchFile,type BatchFile} from '@/lib/batch-files';
type Stored=BatchFile&{object_key:string};
function present(f:Stored):BatchFile{const {object_key,...visible}=f;return visible;}
async function batch(id:string|null){if(!id)throw new AccessError('بچ را انتخاب کنید.',400);if(!await storage().prepare("SELECT id FROM records WHERE id=? AND kind='batch'").bind(id).first())throw new AccessError('بچ پیدا نشد.',404);return id;}
async function stored(id:string){return storage().prepare('SELECT * FROM batch_files WHERE id=?').bind(id).first<Stored>();}
export async function GET(request:Request){try{
 await requireAccess('batch');const q=new URL(request.url).searchParams;const batchId=await batch(q.get('batch'));const id=q.get('id');
 if(!id){const result=await storage().prepare('SELECT * FROM batch_files WHERE batch_id=? ORDER BY uploaded_at DESC,id').bind(batchId).all<Stored>();return Response.json({files:result.results.map(present)},{headers:{'Cache-Control':'private, no-store'}});}
 const file=await stored(id);if(!file||file.batch_id!==batchId)throw new AccessError('فایل این بچ پیدا نشد.',404);
 const object=await firmwareBucket().get(file.object_key);if(!object)throw new AccessError('فایل موقتاً در دسترس نیست.',503);
 const bytes=await object.arrayBuffer();if(bytes.byteLength!==file.byte_size||await sha256(bytes)!==file.sha256)throw new AccessError('یکپارچگی فایل تأیید نشد.',503);
 const name=encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 // All arbitrary formats are downloaded, never executed or rendered on the app origin.
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="batch-file"; filename*=UTF-8''${name}`,'Content-Length':String(file.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'X-Content-SHA256':file.sha256}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت فایل‌ها انجام نشد؛ دوباره تلاش کنید.'},{status:503});}}
export async function POST(request:Request){let key:string|null=null,id:string|null=null;
 try{
 checkOrigin(request);const actor=await requireAccess('batch','write');const q=new URL(request.url).searchParams;const batchId=await batch(q.get('batch'));id=q.get('requestId');
 if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new AccessError('شناسه بارگذاری معتبر نیست.',400);
 const contentType=request.headers.get('content-type')||'';if(!contentType.startsWith('multipart/form-data;'))throw new AccessError('فایل انتخاب کنید.',400);
 const bytes=await boundedBody(request,MAX_BATCH_FILE_BYTES+128*1024);let form:FormData;
 try{form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();}catch{throw new AccessError('فایل قابل دریافت نیست.',400);}
 const file=form.get('file');if(!file||typeof file==='string'||form.getAll('file').length!==1)throw new AccessError('در هر درخواست یک فایل انتخاب کنید.',400);
 try{validateBatchFile(file.name,file.size);}catch(e){throw new AccessError((e as Error).message,400);}
 const buffer=await file.arrayBuffer(),hash=await sha256(buffer),old=await stored(id);
 if(old){if(old.batch_id!==batchId||old.sha256!==hash||old.filename!==file.name)throw new AccessError('شناسه برای فایل دیگری استفاده شده است.',409);return Response.json({file:present(old)},{status:200});}
 key='batch-files/'+id+'/'+crypto.randomUUID();const now=new Date().toISOString();
 await firmwareBucket().put(key,buffer,{httpMetadata:{contentType:'application/octet-stream'},sha256:hash});
 const meta:Stored={id,batch_id:batchId,object_key:key,filename:file.name,byte_size:buffer.byteLength,sha256:hash,uploaded_at:now,uploaded_by:actor.name};
 await storage().batch([
 storage().prepare('INSERT INTO batch_files(id,batch_id,object_key,filename,byte_size,sha256,uploaded_at,uploaded_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,batchId,key,file.name,buffer.byteLength,hash,now,actor.name),
 storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,batchId,'attach_batch_file',JSON.stringify(meta),now)
 ]);return Response.json({file:present(meta)},{status:201});
 }catch(e){
 if(key&&id){try{const linked=await stored(id);if(linked?.object_key===key)return Response.json({file:present(linked)},{status:201});await firmwareBucket().delete(key);}catch{console.error('Batch file reconciliation deferred');}}
 return accessResponse(e)||Response.json({error:'بارگذاری تأیید نشد؛ فهرست را تازه کنید و در صورت نیاز دوباره تلاش کنید.'},{status:503});
 }}
