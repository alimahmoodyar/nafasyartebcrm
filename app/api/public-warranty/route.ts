import {accessResponse,checkOrigin} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {confirmPublicWarranty,publicWarrantyReady,requestPublicWarranty} from '@/lib/public-warranty';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply({ready:publicWarrantyReady()});}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000)));
  const client=(request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||'shared').slice(0,64);
  if(body?.mode==='request')return reply(await requestPublicWarranty(body.details,client));
  if(body?.mode==='confirm')return reply(await confirmPublicWarranty(body.details,body.token,body.code,client));
  return reply({error:'نوع عملیات معتبر نیست.'},400);
 }catch(error){
  const known=accessResponse(error);
  if(known)return known;
  if(error instanceof SyntaxError)return reply({error:'اطلاعات درخواست معتبر نیست.'},400);
  if(/UNIQUE|inventory_operation_guard/i.test(String(error)))return reply({error:'وضعیت دستگاه تغییر کرده است. دوباره بررسی کنید یا با پشتیبانی تماس بگیرید.'},409);
  return reply({error:'نتیجهٔ درخواست مشخص نشد. صفحه را باز نگه دارید و دوباره تلاش کنید.'},503);
 }
}
