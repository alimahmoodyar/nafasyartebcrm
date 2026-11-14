import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {issueSubcontractLink} from '@/lib/subcontract-public';
export async function POST(r:Request){try{checkOrigin(r);return Response.json(await issueSubcontractLink(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,15000)))),{headers:{'Cache-Control':'no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'صدور لینک انجام نشد.'},{status:409});}}
