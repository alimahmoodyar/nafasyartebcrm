import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {applySalesBank,readSalesBank,previewSalesBank} from '@/lib/sales-bank';
import {MAX_SALES_BANK_BYTES} from '@/lib/sales-bank-contract';
import {syncSalesTasks} from '@/lib/sales-tasks';
import {AccessError} from '@/lib/authorization';
import {bankTestBuyer,bankTestBuyers,openBankTestBuyer,runBankProfileTest} from '@/lib/sales-bank-profile-test';
import {salesRows} from '@/lib/sales';
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(request?:Request){try{
 const actor=await requireAccess();
 if(!request||new URL(request.url).searchParams.get('roleTest')!=='true')return json(await readSalesBank(actor));
 const buyers=actor.profileReview?.id==='sales-finance'?await bankTestBuyers():[];
 return await runBankProfileTest(actor,async()=>{
  const data=await readSalesBank(actor);
  if(actor.profileReview?.id!=='sales-finance')return json(data);
  const profiles=(await salesRows()).filter(row=>row.type==='sales_agent');
  return json({...data,assignableAgents:buyers.map(buyer=>{
   const profile=profiles.find(row=>row.data.profileTestBuyerId===buyer.id);
   return {id:buyer.id,revision:profile?.revision||0,data:{name:buyer.name,kind:buyer.kind,active:true,receivingAccountIds:profile?.data.receivingAccountIds||[]}};
  })});
 });
}catch(e){return accessResponse(e)||json({error:'دریافت تطبیق بانکی انجام نشد.'},503);}}
export async function POST(request:Request){try{
 checkOrigin(request);const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,Math.ceil(MAX_SALES_BANK_BYTES/3)*4+1024*1024))),actor=await requireAccess();
 const test=body?.roleTest===true||new URL(request.url).searchParams.get('roleTest')==='true';
 if(test){
  const role=actor.profileReview?.id;
  if(role!=='sales-finance'&&role!=='treasurer')throw new AccessError('پروفایل مالی فروش یا خزانه‌دار لازم است.',403);
  if(body?.mode==='preview'&&role!=='treasurer')throw new AccessError('خواندن اکسل آزمایشی با خزانه‌دار است.',403);
  const buyer=body?.mode==='receiving_accounts'&&role==='sales-finance'?await bankTestBuyer(actor,body.agentId):null;
  return await runBankProfileTest(actor,async()=>{
   if(body?.mode==='preview')return json(await previewSalesBank(actor,body));
   if(buyer){
    const created=(await salesRows()).find(row=>row.id===buyer.id);
    if(!created){
     if(body.revision!==0||body.confirmed!==true)throw new AccessError('پرونده آزمون تغییر کرده است؛ فهرست را تازه کنید.',409);
     await openBankTestBuyer(buyer);
    }
    return json(await applySalesBank(actor,{...body,agentId:buyer.id,revision:body.revision===0?1:body.revision}));
   }
   return json(await applySalesBank(actor,body));
  });
 }
 if(body?.mode==='preview')return json(await previewSalesBank(actor,body));
 const result=await applySalesBank(actor,body);let followupPending=false;
 try{await syncSalesTasks();}catch{followupPending=true;}
 return json({...result,followupPending});
}catch(e){return accessResponse(e)||json({error:'تطبیق انجام نشد؛ اطلاعات هم‌زمان تغییر کرده یا فایل معتبر نیست. فهرست را تازه‌سازی کنید.'},409);}}
