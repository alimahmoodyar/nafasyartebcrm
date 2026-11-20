import {session,requireAdmin,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {mcpActor} from '@/lib/mcp/context';
import {baleStatus,saveBaleConfig,inviteBale,confirmBale,unlinkBale,pollBale,testBaleSend} from '@/lib/bale';
import {BaleProviderError} from '@/lib/bale-transport';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const failure=(e:unknown)=>accessResponse(e)||(e instanceof BaleProviderError?json({error:e.outcome==='failed'?'بله توکن را نپذیرفت؛ توکن دریافتی از بازوی پدر را کامل کپی کنید.':'ارتباط با بله برقرار نشد؛ کمی بعد دوباره امتحان کنید.',code:e.outcome==='failed'?'BALE_TOKEN_REJECTED':'BALE_UNREACHABLE'},e.outcome==='failed'?400:502):json({error:/UNIQUE|CHECK|FOREIGN KEY/.test(String(e))?'اطلاعات هم‌زمان تغییر کرده یا این حساب بله قبلاً متصل شده است؛ تازه‌سازی کنید.':'دریافت یا ذخیرهٔ اتصال بله انجام نشد؛ ارتباط سرور با پایگاه داده باید بررسی شود.',code:'BALE_STORAGE_ERROR'},/UNIQUE|CHECK|FOREIGN KEY/.test(String(e))?409:503));
export async function GET(request:Request){try{return json(await baleStatus(await session(),new URL(request.url).searchParams.get('manage')==='1'));}catch(e){return failure(e);}}
export async function PUT(request:Request){try{
 checkOrigin(request);const u=await requireAdmin();if(mcpActor.getStore())throw new AccessError('توکن را فقط در فرم امن تنظیمات وارد کنید.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,8000)));return json(await saveBaleConfig(u,b));
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await session(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,8000)));if(b.confirmed!==true)throw new AccessError('تأیید اقدام لازم است.',400);
 switch(b.mode){case 'configure':return json(await saveBaleConfig(u,{revision:b.revision,enabled:b.enabled,confirmed:true}));case 'invite':return json(await inviteBale(u,b));case 'confirm':return json(await confirmBale(u,b));case 'unlink':return json(await unlinkBale(u,b));case 'poll':return json(await pollBale(u));case 'test':return json(await testBaleSend(u,b.id));default:throw new AccessError('اقدام معتبر نیست.',400);}
 }catch(e){return failure(e);}}
