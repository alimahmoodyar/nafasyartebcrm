import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {MAX_UPLOAD_BYTES,validateIntelHex,sha256} from '@/lib/firmware';
import {firmwareBucket,firmwareFile,firmwareRecord,withFirmwareFile,boundedBody,type FirmwareFile} from '@/lib/firmware-storage';

export async function POST(request:Request){
 let objectKey:string|null=null,versionId:string|null=null;
 try{
  checkOrigin(request);const actor=await requireAccess('firmware','write');versionId=new URL(request.url).searchParams.get('version');
  if(!versionId)throw new AccessError('نسخه را انتخاب کنید.',400);
  const record=await firmwareRecord(versionId);
  if(await firmwareFile(versionId))throw new AccessError('این نسخه فایل دارد و قابل جایگزینی نیست؛ برای فایل متفاوت نسخه جدید تعریف کنید.',409);
  const bucket=firmwareBucket(),contentType=request.headers.get('content-type')||'';
  if(!contentType.startsWith('multipart/form-data;'))throw new AccessError('فایل HEX را انتخاب کنید.',400);
  const bytes=await boundedBody(request,MAX_UPLOAD_BYTES);
  let form:FormData;try{form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();}catch{throw new AccessError('فایل قابل دریافت نیست؛ دوباره انتخاب کنید.',400);}
  const file=form.get('file');if(!file||typeof file==='string'||form.getAll('file').length!==1)throw new AccessError('یک فایل HEX انتخاب کنید.',400);
  const buffer=await file.arrayBuffer();try{validateIntelHex(new Uint8Array(buffer),file.name);}catch(e){throw new AccessError((e as Error).message,400);}
  const hash=await sha256(buffer),now=new Date().toISOString();objectKey='firmware/'+versionId+'/'+crypto.randomUUID()+'.hex';
  await bucket.put(objectKey,buffer,{httpMetadata:{contentType:'application/octet-stream'},sha256:hash});
  const meta:FirmwareFile={version_id:versionId,object_key:objectKey,filename:file.name,byte_size:buffer.byteLength,sha256:hash,uploaded_at:now,uploaded_by:actor.name};
  await storage().batch([
   storage().prepare('INSERT INTO firmware_files(version_id,object_key,filename,byte_size,sha256,uploaded_at,uploaded_by) VALUES(?,?,?,?,?,?,?)').bind(versionId,objectKey,file.name,buffer.byteLength,hash,now,actor.name),
   storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,versionId,'attach_firmware_hex',JSON.stringify(meta),now)
  ]);
  return Response.json({record:withFirmwareFile(record,meta)},{status:201});
 }catch(e){
  // D1 and R2 are not one transaction. Only remove this request's unreferenced
  // object after a successful reconciliation read; never delete after unknown DB status.
  if(objectKey&&versionId){try{
   const linked=await firmwareFile(versionId);
   if(linked?.object_key===objectKey)return Response.json({record:withFirmwareFile(await firmwareRecord(versionId),linked)},{status:201});
   await firmwareBucket().delete(objectKey);
  }catch{console.error('Firmware upload reconciliation deferred; possible unreferenced object retained');}}
  const denied=accessResponse(e);if(denied)return denied;
  if((e as Error).message?.includes('UNIQUE'))return Response.json({error:'فایل این نسخه هم‌زمان ثبت شده است؛ فهرست را تازه کنید.'},{status:409});
  console.error('Firmware upload failed');return Response.json({error:'بارگذاری تأیید نشد؛ فهرست را تازه کنید. نسخه ثبت‌شده حفظ شده است.'},{status:503});
 }
}
export async function GET(request:Request){try{
 await requireAccess('firmware');const versionId=new URL(request.url).searchParams.get('version');if(!versionId)throw new AccessError('نسخه را انتخاب کنید.',400);
 await firmwareRecord(versionId);const file=await firmwareFile(versionId);if(!file)throw new AccessError('هنوز فایل HEX برای این نسخه بارگذاری نشده است.',404);
 const object=await firmwareBucket().get(file.object_key);if(!object)throw new AccessError('فایل در دسترس نیست؛ با مدیر سامانه هماهنگ کنید.',503);
 const bytes=await object.arrayBuffer();if(bytes.byteLength!==file.byte_size||await sha256(bytes)!==file.sha256)throw new AccessError('یکپارچگی فایل تأیید نشد؛ با مدیر سامانه هماهنگ کنید.',503);
 const filename=encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="firmware.hex"; filename*=UTF-8''${filename}`,'Content-Length':String(file.byte_size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Content-SHA256':file.sha256}});
 }catch(e){return accessResponse(e)||Response.json({error:'دانلود فایل انجام نشد؛ دوباره تلاش کنید.'},{status:503});}}
