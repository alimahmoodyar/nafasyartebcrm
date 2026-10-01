import {env} from 'cloudflare:workers';
import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {tickDuties} from '@/lib/duties';
import {storage} from '@/lib/storage';
import {installDutyStarter} from '@/lib/duty-starter-install';
import {sha256} from '@/lib/firmware';
export async function POST(request:Request){try{
 let source='interactive';const supplied=request.headers.get('authorization');
 if(supplied){if(!env.TASK_SCHEDULER_TOKEN||await sha256(new TextEncoder().encode(supplied).buffer)!==await sha256(new TextEncoder().encode('Bearer '+env.TASK_SCHEDULER_TOKEN).buffer))throw new AccessError('دسترسی زمان‌بند مجاز نیست.',401);source='background';}else{checkOrigin(request);const user=await requireAccess();if(user.isAdmin)await installDutyStarter(user);}
 const last:any=await storage().prepare("SELECT updated FROM flow_entities WHERE id='duty_scheduler'").first();if(last&&Date.now()-Date.parse(last.updated)<60000)return Response.json({skipped:true,at:last.updated},{headers:{'Cache-Control':'no-store'}});
 return Response.json(await tickDuties(new Date(),source),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'زمان‌بند اجرا نشد؛ مهاجرت 0013 و تنظیمات سرور را بررسی کنید.'},{status:503})}}
