import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {foreignStatementImport} from '@/lib/foreign-purchase';
import {syncForeignTasks} from '@/lib/foreign-purchase-tasks';
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,350000))),r=await foreignStatementImport(u,b);try{await syncForeignTasks();}catch(e){console.error('Foreign statement task projection deferred',e);}return Response.json(r,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accessResponse(e)||Response.json({error:e instanceof Error?e.message:'ورود حساب انجام نشد.'},{status:409});}}
