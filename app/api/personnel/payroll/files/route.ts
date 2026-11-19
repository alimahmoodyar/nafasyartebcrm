import {requireAccess,accessResponse} from '@/lib/authorization';
import {readPayrollSlip,payrollMissionFileScope} from '@/lib/personnel-payroll-read';
import {storage} from '@/lib/storage';
import {hrFail} from '@/lib/personnel';
import {firmwareBucket} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
export async function GET(request:Request){try{
 const user=await requireAccess(),q=new URL(request.url).searchParams,{slip}=await readPayrollSlip(user,q.get('slipId')||''),raw:any=await storage().prepare("SELECT f.* FROM flow_entities f WHERE f.id=? AND f.type='staff_mission_file' AND "+payrollMissionFileScope).bind(q.get('id')||'').first();
 if(!raw)hrFail('پیوست در دسترس نیست.',404);const d=JSON.parse(raw.data);if(!slip.data.missions?.some((m:any)=>m.id===d.missionId))hrFail('پیوست متعلق به این فیش نیست.',404);
 const object=await firmwareBucket().get(d.objectKey);if(!object)hrFail('پیوست موجود نیست.',404);const bytes=await object!.arrayBuffer();if(bytes.byteLength!==d.byteSize||await sha256(bytes)!==d.sha256)hrFail('یکپارچگی پیوست تأیید نشد.',503);
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(d.filename),'Cache-Control':'private, no-store','Content-Security-Policy':"sandbox; default-src 'none'",'X-Content-Type-Options':'nosniff'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت پیوست انجام نشد.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
