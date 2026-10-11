import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {readPartRepairs,applyPartRepair} from '@/lib/part-repairs';
import {syncServiceTasks} from '@/lib/after-sales';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
export async function GET(request:Request){try{const u=await requireAccess(),q=new URL(request.url).searchParams;return json(await readPartRepairs(u,q.get('domain')||'home',q.get('repair')||''));}catch(e){return accessResponse(e)||json({error:'اطلاعات قطعات تعمیری در دسترس نیست.'},503);}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,30000))),result=await applyPartRepair(u,b);try{await syncServiceTasks()}catch{console.error('Part repair task projection deferred');}return json(result);}catch(e){return accessResponse(e)||json({error:/constraint|SQLITE|D1/i.test(String(e))?'پرونده یا موجودی هم‌زمان تغییر کرده؛ ثبت ناقص انجام نشد.':e instanceof Error?e.message:'ثبت قطعه انجام نشد.'},409);}}
