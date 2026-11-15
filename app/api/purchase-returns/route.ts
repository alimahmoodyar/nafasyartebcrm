import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {purchaseReturnsView,purchaseReturnApply,purchaseReturnMaterials} from '@/lib/purchase-returns';
import {drainAccountingQueue} from '@/lib/accounting';
import {syncPurchaseTreasury} from '@/lib/purchase-treasury';
export async function GET(request:Request){try{const u=await requireAccess(),q=new URL(request.url).searchParams;return Response.json(q.get('view')==='materials'?await purchaseReturnMaterials(u,q.get('query')||''):await purchaseReturnsView(u,q.get('caseId')||'',q.get('returnId')||'',q.get('after')||''),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'خواندن برگشت خرید ممکن نشد.'},{status:503})}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,60000))),result=await purchaseReturnApply(u,b);let treasuryPending=false;try{await syncPurchaseTreasury()}catch{treasuryPending=true}await drainAccountingQueue().catch(()=>{});return Response.json({...result,treasuryPending});}catch(e){return accessResponse(e)||Response.json({error:'برگشت خرید ثبت نشد؛ نسخه و وضعیت پرونده را بازخوانی کنید.'},{status:409})}}
