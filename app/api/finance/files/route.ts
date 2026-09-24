import {requireFinance,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {firmwareBucket,boundedBody} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
import {MAX_FINANCE_BYTES,validateFinanceFile,type FinanceFile,validFinanceReport} from '@/lib/finance-control';
import {financeScope as scope} from '@/lib/finance-scope';
type Stored=FinanceFile&{object_key:string};
function present(f:Stored):FinanceFile{const {object_key,...visible}=f;return visible;}
async function stored(id:string){return storage().prepare('SELECT * FROM finance_files WHERE id=?').bind(id).first<Stored>();}
export async function GET(request:Request){try{
 await requireFinance();const q=new URL(request.url).searchParams;const {cadence,period}=scope(q);const reportId=q.get('report')||'';if(!validFinanceReport(cadence,reportId)||reportId==='summary')throw new AccessError('گزارش معتبر نیست.',400);const id=q.get('id');
 if(!id){const result=await storage().prepare('SELECT * FROM finance_files WHERE cadence=? AND period=? AND report_id=? ORDER BY uploaded_at DESC,id').bind(cadence,period,reportId).all<Stored>();return Response.json({files:result.results.map(present)},{headers:{'Cache-Control':'private, no-store'}});}
 const file=await stored(id);if(!file||file.cadence!==cadence||file.period!==period||file.report_id!==reportId)throw new AccessError('فایل این گزارش پیدا نشد.',404);
 const object=await firmwareBucket().get(file.object_key);if(!object)throw new AccessError('فایل موقتاً در دسترس نیست.',503);
 const bytes=await object.arrayBuffer();if(bytes.byteLength!==file.byte_size||await sha256(bytes)!==file.sha256)throw new AccessError('یکپارچگی فایل تأیید نشد.',503);
 const name=encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 // All arbitrary formats are downloaded, never executed or rendered on the app origin.
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="report-file"; filename*=UTF-8''${name}`,'Content-Length':String(file.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'X-Content-SHA256':file.sha256}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت فایل‌ها انجام نشد؛ دوباره تلاش کنید.'},{status:503});}}
export async function POST(request:Request){let key:string|null=null,id:string|null=null;
 try{
 checkOrigin(request);const actor=await requireFinance(true);const q=new URL(request.url).searchParams;const {cadence,period}=scope(q);const reportId=q.get('report')||'';if(!validFinanceReport(cadence,reportId)||reportId==='summary')throw new AccessError('گزارش معتبر نیست.',400);id=q.get('requestId');
 if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new AccessError('شناسه بارگذاری معتبر نیست.',400);
 const contentType=request.headers.get('content-type')||'';if(!contentType.startsWith('multipart/form-data;'))throw new AccessError('فایل انتخاب کنید.',400);
 const bytes=await boundedBody(request,MAX_FINANCE_BYTES+128*1024);let form:FormData;
 try{form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();}catch{throw new AccessError('فایل قابل دریافت نیست.',400);}
 const file=form.get('file');if(!file||typeof file==='string'||form.getAll('file').length!==1)throw new AccessError('در هر درخواست یک فایل انتخاب کنید.',400);
 try{validateFinanceFile(file.name,file.size);}catch(e){throw new AccessError((e as Error).message,400);}
 const buffer=await file.arrayBuffer(),hash=await sha256(buffer),old=await stored(id);
 if(old){if(old.cadence!==cadence||old.period!==period||old.report_id!==reportId||old.sha256!==hash||old.filename!==file.name)throw new AccessError('شناسه برای فایل دیگری استفاده شده است.',409);return Response.json({file:present(old)},{status:200});}
 key='finance-files/'+id+'/'+crypto.randomUUID();const now=new Date().toISOString();
 await firmwareBucket().put(key,buffer,{httpMetadata:{contentType:'application/octet-stream'},sha256:hash});
 const meta:Stored={id,cadence:cadence as FinanceFile["cadence"],period,report_id:reportId,object_key:key,filename:file.name,byte_size:buffer.byteLength,sha256:hash,uploaded_at:now,uploaded_by:actor.name};
 await storage().batch([
 storage().prepare('INSERT INTO finance_files(id,cadence,period,report_id,object_key,filename,byte_size,sha256,uploaded_at,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,cadence,period,reportId,key,file.name,buffer.byteLength,hash,now,actor.name),
 storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,id,'attach_finance_file',JSON.stringify(meta),now)
 ]);return Response.json({file:present(meta)},{status:201});
 }catch(e){
 if(key&&id){try{const linked=await stored(id);if(linked?.object_key===key)return Response.json({file:present(linked)},{status:201});await firmwareBucket().delete(key);}catch{console.error('Finance file reconciliation deferred');}}
 return accessResponse(e)||Response.json({error:'بارگذاری تأیید نشد؛ فهرست را تازه کنید و در صورت نیاز دوباره تلاش کنید.'},{status:503});
 }}
