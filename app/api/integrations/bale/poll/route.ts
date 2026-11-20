import {env} from 'cloudflare:workers';
import {pollBale} from '@/lib/bale';
import {accessResponse} from '@/lib/authorization';
export async function POST(request:Request){
 if(!env.TASK_SCHEDULER_TOKEN||request.headers.get('authorization')!=='Bearer '+env.TASK_SCHEDULER_TOKEN)return Response.json({error:'دسترسی مجاز نیست.'},{status:403});
 try{return Response.json(await pollBale());}catch(e){return accessResponse(e)||Response.json({error:'دریافت پیام‌های بله انجام نشد.'},{status:503});}
}
