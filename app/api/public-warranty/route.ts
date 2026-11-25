import {accessResponse,checkOrigin} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {confirmPublicWarranty,publicWarrantyReady,requestPublicWarranty} from '@/lib/public-warranty';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply({ready:publicWarrantyReady()});}
export async function POST(request:Request){
 let stage='request';
 try{
  checkOrigin(request);
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000)));
  const client=(request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||'shared').slice(0,64);
  if(body?.mode==='request'){stage='send';return reply(await requestPublicWarranty(body.details,client));}
  if(body?.mode==='confirm'){stage='confirm';return reply(await confirmPublicWarranty(body.details,body.token,body.code,client));}
  return reply({error:'نوع عملیات معتبر نیست.'},400);
 }catch(error){
  const known=accessResponse(error);
  if(known)return known;
  if(error instanceof SyntaxError)return reply({error:'اطلاعات درخواست معتبر نیست.'},400);
  if(/UNIQUE|inventory_operation_guard/i.test(String(error)))return reply({error:'وضعیت دستگاه تغییر کرده است. دوباره بررسی کنید یا با پشتیبانی تماس بگیرید.'},409);
  const reason=String(error).match(/D1_ERROR|SQLITE_[A-Z_]+|no such table|no such column|not authorized|permission denied|database unavailable/i)?.[0]||'unexpected';
  console.error('public-warranty',stage,reason);
  return reply({error:'نتیجهٔ درخواست مشخص نشد. صفحه را باز نگه دارید و دوباره تلاش کنید.'},503);
 }
}
