import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {executeTool} from '@/lib/mcp/tools';
import {assistantWriteNames,actionTitles,actionSection} from '@/lib/assistant-policy';
import {boundedBody} from '@/lib/firmware-storage';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export function publicAction(a:any){return {id:a.id,turnId:a.turn_id,tool:a.tool,title:actionTitles[a.tool]||a.tool,args:JSON.parse(a.args),state:a.state==='pending'&&a.expires<new Date().toISOString()?'expired':a.state,result:a.result?JSON.parse(a.result):null,expires:a.expires,section:actionSection(a.tool,JSON.parse(a.args))};}
export async function userActions(owner:string){return (await storage().prepare('SELECT * FROM assistant_actions WHERE owner=? ORDER BY created DESC LIMIT 20').bind(owner).all()).results.map(publicAction);}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();const expected=request.headers.get('x-assistant-account');if(expected&&expected!==u.userId)throw new AccessError('حساب ورود تغییر کرده است؛ گفتگو را دوباره باز کنید.',409);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,2000)));if(typeof b.id!=='string'||!['confirm','cancel'].includes(b.decision))throw new AccessError('فرمان معتبر لازم است.',400);
 const db=storage();let a:any=await db.prepare('SELECT * FROM assistant_actions WHERE id=? AND owner=?').bind(b.id,u.userId).first();if(!a)throw new AccessError('فرمان یافت نشد.',404);
 if(a.state==='succeeded'||a.state==='cancelled')return json({accountId:u.userId,action:publicAction(a)});
 if(a.state!=='pending')throw new AccessError('وضعیت اجرای قبلی قطعی نیست یا اجرای آن پایان نیافته؛ قبل از فرمان جدید سابقه بخش مربوطه را بررسی کنید.',409);
 if(b.decision==='cancel')await db.prepare("UPDATE assistant_actions SET state='cancelled' WHERE id=? AND owner=? AND state='pending'").bind(a.id,u.userId).run();
 else{
 if(b.confirmed!==true)throw new AccessError('تأیید صریح خلاصه فرمان لازم است.',400);
 if(!assistantWriteNames.has(a.tool))throw new AccessError('این عملیات در دستیار مجاز نیست.',403);
 // Atomic claim: no duplicate execution even after network failures or simultaneous confirmations.
 const claim:any=await db.prepare("UPDATE assistant_actions SET state='running' WHERE id=? AND owner=? AND state='pending' AND expires>? RETURNING id").bind(a.id,u.userId,new Date().toISOString()).first();
 if(!claim)throw new AccessError('فرمان منقضی شده یا قبلاً اجرا شده است؛ وضعیت را تازه کنید.',409);
 try{
 const result=await executeTool(a.tool,{...JSON.parse(a.args),confirmed:true},new URL(request.url).origin,{user:u,scope:'read_write',tokenId:null});
 const raw=JSON.stringify(result);await db.prepare("UPDATE assistant_actions SET state='succeeded',result=? WHERE id=? AND owner=?").bind(raw.length>12000?JSON.stringify({notice:'عملیات ثبت شد؛ جزئیات کامل در بخش مربوطه موجود است.'}):raw,a.id,u.userId).run();
 }catch(e){
 // Unknown commit outcomes must never be blindly retried. Domain handlers still enforce roles and revisions.
 await db.prepare("UPDATE assistant_actions SET state='review',result=? WHERE id=? AND owner=?").bind(JSON.stringify({error:e instanceof AccessError?e.message:'نتیجه اجرا قطعی نیست؛ قبل از تکرار، سوابق بخش مربوطه را بررسی کنید.'}),a.id,u.userId).run();
 }
 }
 a=await db.prepare('SELECT * FROM assistant_actions WHERE id=? AND owner=?').bind(b.id,u.userId).first();return json({accountId:u.userId,action:publicAction(a)});
 }catch(e){return accessResponse(e)||json({error:'دریافت نتیجه اجرا ممکن نشد؛ وضعیت فرمان را تازه کنید و دوباره ثبت نکنید.'},503);}}
