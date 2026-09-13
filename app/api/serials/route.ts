import {requireAccess,can,checkOrigin,accessResponse,AccessError} from "@/lib/authorization";
import {storage} from "@/lib/storage";
import {receiptDay} from "@/lib/batch-number";
import {tehranDay,serialPrefix,nextSerials,parseRun} from "@/lib/serials";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){try{
 await requireAccess("device");const db=storage(),url=new URL(request.url),id=url.searchParams.get("id");
 if(id){const run:any=await db.prepare("SELECT * FROM serial_runs WHERE id=?").bind(id).first();if(!run)throw new AccessError("نوبت تولید سریال پیدا نشد.",404);
 const rows=await db.prepare("SELECT s.serial,r.id AS deviceId FROM serial_reservations s LEFT JOIN records r ON r.id='device:'||s.serial AND r.kind='device' WHERE s.run_id=? ORDER BY s.serial").bind(id).all();return Response.json({run:parseRun(run),serials:rows.results},{headers});}
 const day=url.searchParams.get("day")||tehranDay();receiptDay(day);
 const rows=await db.prepare("SELECT * FROM serial_runs WHERE day=? ORDER BY created DESC,id LIMIT 200").bind(day).all();return Response.json({runs:rows.results.map(parseRun),day},{headers});
 }catch(e){console.error(e);return accessResponse(e)||Response.json({error:"دریافت سوابق سریال انجام نشد؛ دوباره تلاش کنید."},{status:503,headers});}}
export async function POST(request:Request){try{
 checkOrigin(request);const actor=await requireAccess("device","write");if(!can(actor,"product","read"))throw new AccessError("دسترسی مشاهده محصولات برای تولید سریال لازم است.",403);
 const body=await request.json() as {requestId:string;productId:string;count:number}|null;if(!body)throw new AccessError("اطلاعات درخواست معتبر نیست.",400);const {requestId,productId,count}=body;
 if(typeof requestId!=="string"||!/^[a-f0-9-]{36}$/.test(requestId)||typeof productId!=="string"||!Number.isInteger(count)||count<1||count>100)throw new AccessError("محصول و تعداد صحیح بین ۱ تا ۱۰۰ را وارد کنید.",400);
 const db=storage();
 for(let attempt=0;attempt<4;attempt++){
 const prior:any=await db.prepare("SELECT * FROM serial_runs WHERE id=?").bind(requestId).first();if(prior){if(prior.actor!==actor.userId||prior.product_id!==productId||JSON.parse(prior.payload).count!==count)throw new AccessError("شناسه درخواست قبلاً برای اطلاعات دیگری استفاده شده است.",409);return Response.json({run:parseRun(prior),replayed:true},{headers});}
 const product:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(productId).first();if(!product)throw new AccessError("محصول پیدا نشد.",400);const p=JSON.parse(product.payload);if(p.status!=="فعال")throw new AccessError("محصول متوقف شده است؛ محصول فعال انتخاب کنید.",400);
 const day=tehranDay(),prefix=serialPrefix(p.code,day);
 // Range scan uses the reservation PK; device IDs use the existing records PK.
 const existing=await db.prepare("SELECT serial FROM serial_reservations WHERE serial>=? AND serial<? UNION ALL SELECT substr(id,8) AS serial FROM records WHERE id>=? AND id<? AND kind='device'").bind(prefix,prefix+'\uffff','device:'+prefix,'device:'+prefix+'\uffff').all<{serial:string}>();
 const serials=nextSerials(prefix,existing.results.map(r=>r.serial),count),created=new Date().toISOString();
 const data={name:p.name,model:p.model,code:p.code,count,operator:actor.name,jalaliDate:receiptDay(day).display};
 try{await db.batch([
 db.prepare("INSERT INTO serial_runs(id,product_id,actor,day,payload,created) SELECT ?,?,?,?,?,? FROM records WHERE id=? AND kind='product' AND payload=?").bind(requestId,productId,actor.userId,day,JSON.stringify(data),created,productId,product.payload),
 ...serials.map(serial=>db.prepare("INSERT INTO serial_reservations(serial,run_id,product_id) VALUES(CASE WHEN EXISTS(SELECT 1 FROM records WHERE id=? AND kind='device') THEN NULL ELSE ? END,?,?)").bind('device:'+serial,serial,requestId,productId)),
 db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.userId,requestId,"reserve_device_serials",JSON.stringify({productId,...data,first:serials[0],last:serials.at(-1)}),created)
 ]);return Response.json({run:{id:requestId,productId,day,created,data}},{status:201,headers});
 }catch(e){if(attempt<3&&/constraint|SQLITE_BUSY/i.test(String(e)))continue;throw e;}
 }
 throw new AccessError("ثبت هم‌زمان انجام شد؛ دوباره تلاش کنید.",409);
 }catch(e){console.error(e);return accessResponse(e)||Response.json({error:"تولید سریال انجام نشد یا پاسخ دریافت نشد؛ با همان اطلاعات دوباره تلاش کنید تا درخواست قبلی بررسی شود."},{status:503,headers});}}
