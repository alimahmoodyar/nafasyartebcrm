import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {normalizeDistribution,previewDistribution,normalizeSerial,distributionFields,type DistributionPreview} from '@/lib/distribution';
import type {Row} from '@/lib/model';
import type {Session} from '@/lib/permissions';
const parse=(r:any):Row=>({id:r.id,kind:r.kind,created:r.created,data:JSON.parse(r.payload)});
async function state(){const r=await storage().prepare("SELECT * FROM records WHERE kind IN ('device','distribution')").all();const rows=r.results.map(parse);return{devices:rows.filter(r=>r.kind==='device'),existing:rows.filter(r=>r.kind==='distribution')};}
function fail(error:unknown){const denied=accessResponse(error);if(denied)return denied;const message=error instanceof Error?error.message:'';console.error('Distribution operation failed');return Response.json({error:/D1|SQLITE|Database/.test(message)?'ذخیره انجام نشد؛ پیش‌نمایش را دوباره بررسی کنید.':message||'درخواست معتبر نیست.'},{status:/D1|SQLITE|Database/.test(message)?503:400});}
export async function GET(request:Request){try{await requireAccess('distribution');const device=new URL(request.url).searchParams.get('device');if(!device)throw new Error('دستگاه را انتخاب کنید.');const target='distribution:'+device;const audit=await storage().prepare("SELECT action, before, after, at FROM access_audit WHERE target = ? ORDER BY at DESC LIMIT 30").bind(target).all();return Response.json({history:audit.results.map((r:any)=>({...r,before:r.before?JSON.parse(r.before):null,after:JSON.parse(r.after)}))},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
async function save(data:Record<string,string>,device:string,previous:string,actor:Session,source:string,reason:string){
 const db=storage(),id='distribution:'+device;const current=await db.prepare('SELECT * FROM records WHERE id=?').bind(id).first<any>();
 if((current?.payload||'')!==previous)throw new AccessError('اطلاعات این سریال تغییر کرده؛ پیش‌نمایش یا فرم را تازه کنید.',409);
 const now=new Date().toISOString();const next={...data,device,updatedAt:now,updatedBy:actor.name,source,reason};const row:Row={id,kind:'distribution',created:current?.created||now,data:next};
 try{if(current){const result=await db.batch([
 db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM records WHERE id=? AND payload=?').bind(crypto.randomUUID(),actor.userId,id,'update_distribution',previous,JSON.stringify(next),now,id,previous),
 db.prepare('UPDATE records SET payload=? WHERE id=? AND payload=?').bind(JSON.stringify(next),id,previous)]);if(!result[1].meta.changes)throw new AccessError('رکورد هم‌زمان تغییر کرده؛ دوباره بررسی کنید.',409);
 }else await db.batch([db.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?)').bind(id,'distribution',JSON.stringify(next),now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,id,'create_distribution',JSON.stringify(next),now)]);
 }catch(e){if((e as Error).message?.includes('UNIQUE'))throw new AccessError('این سریال هم‌زمان ثبت شده؛ پیش‌نمایش را تازه کنید.',409);throw e;}return row;
}
export async function POST(request:Request){try{
 checkOrigin(request);const actor=await requireAccess('distribution','write');await requireAccess('device');
 const text=await request.text();if(text.length>2_000_000)throw new Error('حجم اطلاعات زیاد است؛ فایل را بخش‌بندی کنید.');const body=JSON.parse(text);const snapshot=await state();
 if(body.mode==='manual'){
 const data=normalizeDistribution(body.data);const matched=snapshot.devices.filter(d=>normalizeSerial(d.data.code)===data.serial);if(matched.length!==1)throw new Error('سریال باید دقیقاً یک شناسنامه ثبت‌شده داشته باشد.');
 const current=snapshot.existing.find(r=>r.data.device===matched[0].id);if(typeof body.previous!=='string')throw new Error('فرم را دوباره باز کنید.');
 const reason=typeof body.reason==='string'?body.reason.trim():'';if(reason.length>500)throw new Error('دلیل اصلاح حداکثر ۵۰۰ نویسه است.');if(current&&reason.length<3)throw new Error('برای تکمیل یا اصلاح، دلیل تغییر را ثبت کنید.');
 return Response.json({record:await save(data,matched[0].id,body.previous,actor,'ثبت دستی',reason||'ثبت اولیه')});
 }
 if(!['preview','import'].includes(body.mode)||!Array.isArray(body.rows)||body.rows.length>500)throw new Error('هر فایل حداکثر ۵۰۰ ردیف دارد.');
 if(body.mode==='import'&&body.rows.length>25)throw new Error('هر مرحله ذخیره حداکثر ۲۵ ردیف دارد.');
 const seen=new Set<string>();const preview:DistributionPreview[]=body.rows.map((r:any,i:number)=>{
 const row=previewDistribution(r.data,Number.isInteger(r.row)?r.row:i+2,snapshot.devices,snapshot.existing);const serial=typeof row.data.serial==='string'?normalizeSerial(row.data.serial):'';
 if(serial&&seen.has(serial))return {...row,status:'invalid',message:'این سریال در همین فایل تکرار شده؛ فقط یک ردیف برای هر دستگاه نگه دارید.'};seen.add(serial);return row;});
 if(body.mode==='preview')return Response.json({preview},{headers:{'Cache-Control':'no-store'}});
 const bad=preview.filter(r=>!['new','complete','same'].includes(r.status));if(bad.length)return Response.json({error:'بعضی ردیف‌ها دیگر قابل ثبت نیستند؛ پیش‌نمایش را تازه کنید.',preview},{status:409});
 const source=typeof body.filename==='string'?'اکسل: '+body.filename.slice(0,180):'ورود اکسل';const results=[];
 for(const row of preview){if(row.status==='same'){results.push({row:row.row,status:'same',message:row.message});continue;}
 const prior=snapshot.existing.find(r=>r.data.device===row.device);const merged={...prior?.data};for(const f of distributionFields)if(row.data[f.key])merged[f.key]=row.data[f.key];
 try{const record=await save(normalizeDistribution(merged),row.device!,row.previous||'',actor,source,row.status==='complete'?'تکمیل فیلدهای خالی از اکسل':'ثبت اولیه از اکسل');results.push({row:row.row,status:'saved',record});}
 catch(e){results.push({row:row.row,status:'error',message:e instanceof AccessError?e.message:'این ردیف ذخیره نشد؛ دوباره بررسی کنید.'});}
 }
 return Response.json({results});
 }catch(e){return fail(e);}}
