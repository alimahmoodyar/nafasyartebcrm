import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {readNetwork,readBuyerAssignments,applyNetwork} from '@/lib/sales-network';
import {syncSalesTasks} from '@/lib/sales-tasks';
export async function GET(request?:Request){try{const u=await requireAccess(),assignments=request&&new URL(request.url).searchParams.get('assignments')==='1';return Response.json(assignments?await readBuyerAssignments(u):await readNetwork(u),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'دریافت شبکه فروش انجام نشد.'},{status:503});}}
export async function POST(request:Request){try{checkOrigin(request);const result=await applyNetwork(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(request,24000))));let followupPending=false;try{await syncSalesTasks();}catch{followupPending=true;}return Response.json({...result,followupPending});}catch(e){return accessResponse(e)||Response.json({error:'ثبت انجام نشد؛ داده را تازه‌سازی کنید.'},{status:409});}}
