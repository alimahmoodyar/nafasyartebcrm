import {accessResponse} from '@/lib/authorization';
import {usageReport} from '@/lib/llm-usage';
export async function GET(request:Request){try{return Response.json(await usageReport(new URL(request.url).searchParams),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});}catch(e){return accessResponse(e)||Response.json({error:'دریافت گزارش مصرف مدل انجام نشد.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
