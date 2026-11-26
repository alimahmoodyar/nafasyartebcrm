import {AccessError,accessResponse,checkOrigin,requireAdmin} from '@/lib/authorization';
import {saveSafirSettings,safirStatus} from '@/lib/bale-safir';
import {boundedBody} from '@/lib/firmware-storage';
import {mcpActor} from '@/lib/mcp/context';
import {trainingContext} from '@/lib/training-context';

const headers={'Cache-Control':'private, no-store'};

async function requireSettingsAdmin(){
 if(mcpActor.getStore()||trainingContext.getStore())throw new AccessError('تنظیم سفیر بله فقط در پنل مدیر سامانه انجام می‌شود.',403);
 await requireAdmin();
}

function failure(error:unknown){
 return accessResponse(error)||Response.json({error:'دریافت یا ذخیرهٔ تنظیمات سفیر بله انجام نشد.'},{status:503,headers});
}

export async function GET(){
 try{
  await requireSettingsAdmin();
  return Response.json(await safirStatus(),{headers});
 }catch(error){return failure(error);}
}

export async function PUT(request:Request){
 try{
  checkOrigin(request);
  await requireSettingsAdmin();
  const data=JSON.parse(new TextDecoder().decode(await boundedBody(request,4096)));
  if(!data||typeof data!=='object'||Array.isArray(data))throw new AccessError('تنظیمات معتبر نیست.',400);
  return Response.json(await saveSafirSettings(data),{headers});
 }catch(error){return failure(error);}
}