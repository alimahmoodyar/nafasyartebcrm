import {bankEntities} from '@/lib/sales-bank';
import {bankMatch} from '@/lib/sales-bank-contract';
import {syncServicePaymentTasks} from '@/lib/service-payment-tasks';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {applySalesBank,readSalesBank,previewSalesBank,downloadSalesBankStatement} from '@/lib/sales-bank';
import {MAX_SALES_BANK_BYTES} from '@/lib/sales-bank-contract';
import {syncSalesTasks} from '@/lib/sales-tasks';
import {syncTreasuryTasks} from '@/lib/treasury-tasks';
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(request?:Request){try{
 const actor=await requireAccess();
 const query=request?new URL(request.url).searchParams:null,statementId=query?.get('statement');
 // Legacy roleTest links use the same authenticated business handler and data.
 return statementId?await downloadSalesBankStatement(actor,statementId):json(await readSalesBank(actor));
}catch(e){return accessResponse(e)||json({error:'دریافت تطبیق بانکی انجام نشد.'},503);}}
export async function POST(request:Request){try{
 checkOrigin(request);const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,Math.ceil(MAX_SALES_BANK_BYTES/3)*4+1024*1024))),actor=await requireAccess();

 if(body?.mode==='preview')return json(await previewSalesBank(actor,body));
 const result=await applySalesBank(actor,body);let followupPending=false;
 if(body.mode==='import')try{let autoMatched=0;for(let n=0;n<20;n++){const all=await bankEntities(),ids=all.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending').filter(r=>{const m=bankMatch(r,all);return m.status==='ready'&&all.some(p=>p.id===m.paymentId&&p.data.serviceDomain==='home')}).slice(0,25).map(r=>r.id);if(!ids.length)break;const more=await applySalesBank(actor,{id:crypto.randomUUID(),mode:'reconcile',confirmed:true,rowIds:ids});autoMatched+=more.matched||0;}if(autoMatched){const latest=await bankEntities();Object.assign(result,{matched:(result.matched||0)+autoMatched,reconciled:(result.reconciled||0)+autoMatched,pendingReady:latest.filter(r=>r.type==='sales_bank_row'&&r.data.status==='pending'&&bankMatch(r,latest).status==='ready').length});}}catch{followupPending=true;}
 try{await syncServicePaymentTasks()}catch{followupPending=true;}
 try{await syncSalesTasks();}catch{followupPending=true;}
 if(['import','archive_pos'].includes(body?.mode))try{await syncTreasuryTasks();}catch{followupPending=true;}
 return json({...result,followupPending});
}catch(e){return accessResponse(e)||json({error:'تطبیق انجام نشد؛ اطلاعات هم‌زمان تغییر کرده یا فایل معتبر نیست. فهرست را تازه‌سازی کنید.'},409);}}
