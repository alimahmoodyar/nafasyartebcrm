import {requireAccess,accessResponse} from '@/lib/authorization';
import {readFormRecord} from '@/lib/form-control';
import {printFormRecord,formHeaders} from '@/lib/form-control-print';
export async function GET(request:Request){try{const u=await requireAccess(),q=new URL(request.url).searchParams,id=q.get('id')||'',record=await readFormRecord(u,id,q.get('batchId')||'');return q.get('format')==='json'?Response.json({id,...record},{headers:formHeaders}):printFormRecord(id,record);}catch(e){return accessResponse(e)||Response.json({error:'برگه قابل دریافت نیست.'},{status:503,headers:formHeaders});}}
