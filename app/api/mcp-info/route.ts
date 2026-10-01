import {requireAdmin,accessResponse} from '@/lib/authorization';
import {discoverTools} from '@/lib/mcp/tools';
export async function GET(){try{await requireAdmin();return Response.json({tools:discoverTools()},{headers:{'Cache-Control':'no-store'}});}catch(e){return accessResponse(e)||Response.json({error:'Unavailable'},{status:503});}}
