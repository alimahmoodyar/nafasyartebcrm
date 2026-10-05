import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {salesRead,salesWarehouse,salesScope,salesQuote,salesRows,salesFail} from '@/lib/sales';
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess();if(!salesRead(u))salesFail('دسترسی ندارید.',403);const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,12000))),agent=await salesScope(u,b.agentId);return Response.json(await salesQuote(agent,b.items,await salesRows()),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'پیش‌فاکتور قابل محاسبه نیست.'},{status:400})}}
