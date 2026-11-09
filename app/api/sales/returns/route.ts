import {withRepresentativeSample} from '@/lib/representative-sample';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {returnActor,returnWorkspace,applyReturnAction} from '@/lib/sales-return-workflow';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
function failed(error:unknown){const known=accessResponse(error);if(known)return known;console.error('Sales return operation failed',error);return json({error:'رسیدگی به پرونده مرجوعی انجام نشد.'},503);}
async function get(request:Request){
 try{
  const q=new URL(request.url).searchParams;
  return json(await returnWorkspace(await returnActor(await requireAccess()),q.get('id')||'',q.get('device')||''));
 }catch(error){return failed(error);}
}
async function post(request:Request){
 try{
  checkOrigin(request);
  const u=await returnActor(await requireAccess()),body=JSON.parse(new TextDecoder().decode(await boundedBody(request,24000)));
  return json(await applyReturnAction(u,body));
 }catch(error){return failed(error);}
}

export const GET=withRepresentativeSample(get);
export const POST=withRepresentativeSample(post);
