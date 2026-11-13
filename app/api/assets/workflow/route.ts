import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {assetList,applyAssetWorkflow} from '@/lib/asset-workflow';
import {syncAssetWorkflowTasks} from '@/lib/asset-workflow-tasks';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
export async function GET(request:Request){try{return Response.json(await assetList(await requireAccess(),new URL(request.url).searchParams),{headers});}catch(e){return accessResponse(e)||Response.json({error:'دریافت اموال ممکن نشد.'},{status:503,headers});}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess();if(request.headers.get('x-asset-account')&&request.headers.get('x-asset-account')!==u.userId)return Response.json({error:'حساب عوض شده است؛ صفحه را تازه کنید.'},{status:409,headers});const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,32000))),result=await applyAssetWorkflow(u,b);let followupPending=false;try{await syncAssetWorkflowTasks()}catch{followupPending=true;}return Response.json({...result,followupPending},{headers});}catch(e){return accessResponse(e)||Response.json({error:'ثبت قطعی نشد؛ قبل از تکرار، پرونده را تازه کنید.'},{status:409,headers});}}
