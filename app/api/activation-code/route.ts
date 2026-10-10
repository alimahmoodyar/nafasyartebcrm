import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {trainingContext} from '@/lib/training-context';
import {canGenerateActivationCode} from '@/lib/activation-code-access';
import {generateActivationCode,normalizeActivationInput} from '@/lib/activation-code';
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function actor(request:Request){
 const u=await requireAccess(),db=storage();
 if(trainingContext.getStore())fail('تولید کد فقط در محیط اطلاعات شرکت مجاز است.',403);
 if(request.headers.get('x-assistant-account')&&request.headers.get('x-assistant-account')!==u.userId)fail('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);
 const member:any=u.isAdmin?null:await db.prepare("SELECT id,subject,permissions,status FROM app_members WHERE subject=? OR id=?").bind(u.userId,u.userId.startsWith('local:')?u.userId.slice(6):'').first();
 if(!u.isAdmin&&(!member||member.status!=='active'))fail('حساب فعال شرکت لازم است.',403);
 if(!canGenerateActivationCode(u)||!canGenerateActivationCode(member?{...u,permissions:JSON.parse(member.permissions)}:u))fail('تولید کد فقط برای مدیر فروش و کارشناسان خدمات خانگی مجاز است.',403);
 return {u,db,member};
}
export async function GET(request:Request){try{
 const {u,db}=await actor(request);
 const rows=(await db.prepare("SELECT id,payload,created FROM inventory_operations WHERE kind='activation_code' AND actor=? ORDER BY created DESC,id DESC LIMIT 20").bind(u.userId).all()).results;
 return json({accountId:u.userId,history:rows.map((r:any)=>{const p=JSON.parse(r.payload);return {id:r.id,deviceCode:p.deviceCode,reason:p.reason,created:r.created,activationCode:generateActivationCode(p.deviceCode)}})});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت سابقه ممکن نشد.'},{status:503})}}
export async function POST(request:Request){try{
 checkOrigin(request);const {u,db,member}=await actor(request);
 let b:any;try{b=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000)))}catch{fail('درخواست معتبر نیست.');}
 if(!b||Array.isArray(b)||typeof b!=='object'||Object.keys(b).some(k=>!['id','confirmed','deviceCode','reason'].includes(k)))fail('فیلد درخواست معتبر نیست.');
 if(b.confirmed!==true)fail('تأیید تولید کد لازم است.');
 if(typeof b.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id))fail('شناسه عملیات معتبر نیست.');
 let deviceCode:string;try{deviceCode=normalizeActivationInput(b.deviceCode)}catch(e){fail((e as Error).message)}
 if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>500)fail('علت تولید کد را تا ۵۰۰ نویسه وارد کنید.');
 const reason=b.reason.trim(),payload=JSON.stringify({deviceCode:deviceCode!,reason});
 const previous:any=await db.prepare('SELECT kind,actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(previous&&(previous.kind!=='activation_code'||previous.actor!==u.userId||previous.payload!==payload))fail('شناسه عملیات قبلاً برای درخواست دیگری استفاده شده است.',409);
 if(!previous){
 const writes=[db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'activation_code',?,?,?,1)").bind(b.id,payload,u.userId,new Date().toISOString())];
 // Revoke or change permissions during the request: roll back the audit and return no code.
 if(member)writes.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=? AND subject IS ?) THEN 1 ELSE 0 END WHERE id=?").bind(member.id,member.permissions,member.subject,b.id));
 await db.batch(writes);
 }
 return json({accountId:u.userId,id:b.id,deviceCode:deviceCode!,activationCode:generateActivationCode(deviceCode!),repeated:!!previous});
 }catch(e){return accessResponse(e)||Response.json({error:'تولید کد تأیید نشد؛ با همان درخواست دوباره تلاش کنید.'},{status:409})}}
