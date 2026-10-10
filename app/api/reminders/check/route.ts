import {checkOrigin,accessResponse} from '@/lib/authorization';
import {reminderActor,reminderFail,syncReminders} from '@/lib/reminders';
export async function POST(request:Request){try{checkOrigin(request);const u=await reminderActor();const account=request.headers.get('x-assistant-account');if(account&&account!==u.userId)reminderFail('حساب ورود تغییر کرده است.',409);await syncReminders(u);return Response.json({checked:true,accountId:u.userId},{headers:{'Cache-Control':'no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'بررسی یادآورها انجام نشد.'},{status:503});}}
