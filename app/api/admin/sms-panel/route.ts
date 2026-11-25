import {sendPublicWarrantyTestSms} from '@/lib/panel-test-sms';
import {accessResponse,AccessError,checkOrigin,requireAdmin} from '@/lib/authorization';
import {panelConfig,publicFields,savePanel} from '@/lib/sms-panel';
import {boundedBody} from '@/lib/firmware-storage';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request?:Request){
 try{
  if(request)checkOrigin(request);
  const user=await requireAdmin();
  if(user.rolePreview||user.profileReview)throw new AccessError('با حساب مدیر وارد شوید.',403);
  if(request?.method==='POST')return reply(await sendPublicWarrantyTestSms());
  if(!request)return reply(publicFields(await panelConfig()));
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000)));
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'اطلاعات تنظیمات معتبر نیست.'},400);
  return reply(await savePanel(body));
 }catch(error){
  return accessResponse(error)??reply({error:error instanceof SyntaxError?'اطلاعات تنظیمات قابل خواندن نیست.':'دسترسی به تنظیمات پیامک در سرور ممکن نشد.'},error instanceof SyntaxError?400:503);
 }
}
export function GET(){return handle();}
export function PUT(request:Request){return handle(request);}

export function POST(request:Request){return handle(request);}
