import {AccessError,accessResponse,requireAdmin} from '@/lib/authorization';
import {panelConfig} from '@/lib/sms-panel';
import {listSmsReports,reportMessageId} from '@/lib/sms-report';
import {rate} from '@/lib/sms-rate';
import {trainingContext} from '@/lib/training-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers});

async function lookup(entry:string,actor:string){
 const id=await reportMessageId(entry);
 await rate('admin-sms-delivery-report',actor,30,60000);
 const {apiKey}=await panelConfig();
 if(!apiKey)throw new AccessError('کلید پنل برای استعلام تحویل تنظیم نشده است.',503);
 // This provider response includes OTP/message text and the full mobile. Project only the delivery code.
 const response=await fetch('https://api.sms.ir/v1/send/'+id,{
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{'X-API-KEY':apiKey,Accept:'application/json'},
 }).catch(()=>null);
 if(!response)throw new AccessError('ارتباط با پنل برای استعلام تحویل برقرار نشد.',503);
 const result=await response.json().catch(()=>null) as {
  status?:unknown;data?:{messageId?:unknown;deliveryState?:unknown}|null
 }|null;
 if(!response.ok||result?.status!==1||result.data?.messageId!==id){
  const code=typeof result?.status==='number'&&Number.isInteger(result.status)&&result.status>=0&&result.status<=9999?result.status:null;
  throw new AccessError('پنل وضعیت تحویل را برنگرداند.'+(code===null?'':' کد پنل '+code+'.'),502);
 }
 const state=result.data.deliveryState;
 return {deliveryState:typeof state==='number'&&Number.isInteger(state)&&state>=0&&state<=255?state:null};
}

export async function GET(request:Request){
 try{
  const user=await requireAdmin();
  if(user.rolePreview||user.profileReview||trainingContext.getStore())throw new AccessError('با حساب مدیر وارد شوید.',403);
  const query=new URL(request.url).searchParams,entry=query.get('entry');
  return respond(entry===null?await listSmsReports(query):await lookup(entry,user.userId));
 }catch(error){
  const expected=accessResponse(error);
  if(expected){
   for(const [key,value] of Object.entries(headers))expected.headers.set(key,value);
   return expected;
  }
  return respond({error:'دریافت گزارش پیامک در حال حاضر ممکن نیست.'},503);
 }
}
