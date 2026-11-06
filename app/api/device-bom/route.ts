import {requireAccess,can,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const u=await requireAccess();if(!can(u,'device','read')||!can(u,'product','read'))throw new AccessError('مشاهده BOM سریال به دسترسی مشاهده دستگاه و محصول نیاز دارد.',403);
 const deviceId=new URL(request.url).searchParams.get('deviceId')||'';if(!deviceId||deviceId.length>200)throw new AccessError('دستگاه معتبر انتخاب کنید.',400);
 const db=storage(),device:any=await db.prepare("SELECT * FROM records WHERE id=? AND kind='device'").bind(deviceId).first();if(!device)throw new AccessError('دستگاه یافت نشد.',404);
 const build:any=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='build'").bind(deviceId).first(),order:any=await db.prepare('SELECT bom_id,created FROM production_orders WHERE device_id=?').bind(deviceId).first(),bound=build?JSON.parse(build.data):null;
 if(bound?.projectFinalBomId){const final:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='project_final_bom'").bind(bound.projectFinalBomId).first();const snapshot=final?JSON.parse(final.data):null;if(!snapshot||snapshot.deviceId!==deviceId||snapshot.productId!==JSON.parse(device.payload).product)throw new AccessError('BOM نهایی پروژه با این سریال منطبق نیست.',409);return json({deviceId,serial:JSON.parse(device.payload).code,bom:{id:final.id,version:1,kind:'project',created:final.created,lines:snapshot.lines,projectId:snapshot.projectId,approval:snapshot.approval},notice:'BOM واقعی و نهایی همین پروژه و سریال؛ BOM پایه محصول تغییر نکرده است.'});}
 if(bound?.bomId&&order?.bom_id&&bound.bomId!==order.bom_id)throw new AccessError('ارتباط BOM سریال ناسازگار است و باید بررسی شود؛ نسخه‌ای حدس زده نمی‌شود.',409);
 const bomId=bound?.bomId||order?.bom_id,record=JSON.parse(device.payload);
 if(!bomId)return json({deviceId,serial:record.code,bom:null,notice:'برای این سریال نسخه BOM ثبت نشده است. آخرین BOM محصول به گذشته نسبت داده نمی‌شود.'});
 const bom:any=await db.prepare('SELECT * FROM bom_versions WHERE id=? AND product_id=?').bind(bomId,record.product).first();if(!bom)throw new AccessError('نسخه متصل به این سریال پیدا نشد یا متعلق به محصول دیگری است.',409);
 return json({deviceId,serial:record.code,state:bound?.state||'production_sheet',bom:{id:bom.id,version:bom.version,created:bom.created,lines:JSON.parse(bom.lines)},notice:'این فهرست نسخهٔ متصل به همین سریال است؛ تغییر BOM جاری محصول آن را تغییر نمی‌دهد. مقادیر، مصرف استاندارد هستند.'});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت BOM دستگاه ممکن نشد.'},{status:503})}}
