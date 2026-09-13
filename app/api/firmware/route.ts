import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {normalizeFirmware,firmwareIdentity,sha256} from '@/lib/firmware';
import {boundedBody,withFirmwareFile,type FirmwareFile} from '@/lib/firmware-storage';
import type {Row} from '@/lib/model';
export async function GET(){try{
 await requireAccess('firmware');
 const [records,files]=await Promise.all([storage().prepare("SELECT * FROM records WHERE kind='firmware' ORDER BY created DESC, id").all(),storage().prepare('SELECT * FROM firmware_files').all<FirmwareFile>()]);
 return Response.json({records:records.results.map((r:any)=>withFirmwareFile({id:r.id,kind:r.kind,created:r.created,data:JSON.parse(r.payload)},files.results.find(f=>f.version_id===r.id)||null))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت نسخه‌ها انجام نشد؛ دوباره تلاش کنید.'},{status:503});}}
export async function POST(request:Request){try{
 checkOrigin(request);const actor=await requireAccess('firmware','write');const bytes=await boundedBody(request,20000);
 let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AccessError('مشخصات نسخه معتبر نیست.',400);}
 let data:Record<string,string>;try{data=normalizeFirmware(input);}catch(e){throw new AccessError((e as Error).message,400);}
 const id='firmware:'+await sha256(new TextEncoder().encode(firmwareIdentity(data)));
 const created=new Date().toISOString();data={...data,createdBy:actor.name};const record:Row={id,kind:'firmware',created,data};
 await storage().batch([
  storage().prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)').bind(id,'firmware',JSON.stringify(data),created),
  storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,id,'create_firmware',JSON.stringify(record),created)
 ]);
 return Response.json({record},{status:201});
 }catch(e){const denied=accessResponse(e);if(denied)return denied;if((e as Error).message?.includes('UNIQUE'))return Response.json({error:'این نام و شماره نسخه برای همین مدل دستگاه و برد قبلاً ثبت شده است.'},{status:409});console.error('Firmware metadata save failed');return Response.json({error:'ذخیره نسخه تأیید نشد؛ فهرست را تازه کنید و دوباره بررسی کنید.'},{status:503});}}
