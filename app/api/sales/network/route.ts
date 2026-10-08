import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {readNetwork,applyNetwork} from '@/lib/sales-network';
import {syncSalesTasks} from '@/lib/sales-tasks';
export async function GET(){try{return Response.json(await readNetwork(await requireAccess()),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'دریافت شبکه فروش انجام نشد.'},{status:503});}}
export async function POST(request:Request){try{checkOrigin(request);const result=await applyNetwork(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(request,24000))));let followupPending=false;try{await syncSalesTasks();}catch{followupPending=true;}return Response.json({...result,followupPending});}catch(e){return accessResponse(e)||Response.json({error:'ثبت انجام نشد؛ داده را تازه‌سازی کنید.'},{status:409});}}
