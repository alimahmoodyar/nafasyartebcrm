import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {serviceContractWorkspace,applyServiceContract} from '@/lib/service-contracts';
import {syncServiceContractTasks} from '@/lib/service-contract-tasks';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
export async function GET(){try{const u=await requireAccess(),data=await serviceContractWorkspace(u);await syncServiceContractTasks();return json(data);}catch(e){return accessResponse(e)||json({error:'دریافت قرارداد نمایندگی انجام نشد.'},503);}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,16000))),result=await applyServiceContract(u,b);try{await syncServiceContractTasks()}catch{console.error('Contract warning projection deferred');}return json(result);}catch(e){return accessResponse(e)||json({error:/constraint|SQLITE|D1/i.test(String(e))?'قرارداد هم‌زمان تغییر کرده؛ هیچ تغییر ناقصی ثبت نشد.':e instanceof Error?e.message:'ثبت قرارداد انجام نشد.'},409);}}
