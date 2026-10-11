import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {applySalesBank,readSalesBank} from '@/lib/sales-bank';
import {MAX_SALES_BANK_BYTES} from '@/lib/sales-bank-contract';
import {syncSalesTasks} from '@/lib/sales-tasks';
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(){try{return json(await readSalesBank(await requireAccess()));}catch(e){return accessResponse(e)||json({error:'دریافت تطبیق بانکی انجام نشد.'},503);}}
export async function POST(request:Request){try{checkOrigin(request);const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,Math.ceil(MAX_SALES_BANK_BYTES/3)*4+1024*1024))),result=await applySalesBank(await requireAccess(),body);let followupPending=false;try{await syncSalesTasks();}catch{followupPending=true;}return json({...result,followupPending});}catch(e){return accessResponse(e)||json({error:'تطبیق انجام نشد؛ اطلاعات هم‌زمان تغییر کرده یا فایل معتبر نیست. فهرست را تازه‌سازی کنید.'},409);}}
