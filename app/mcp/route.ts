import {authenticateMcp,validateOrigin} from '@/lib/mcp/auth';
import {dispatchRpc,readRpc,transportFailure,versions} from '@/lib/mcp/protocol';
import {AccessError} from '@/lib/authorization';
export async function POST(request:Request){try{
 validateOrigin(request);const version=request.headers.get('mcp-protocol-version');if(version&&!versions.includes(version))throw new AccessError('Unsupported MCP protocol version.',400);
 const message=await readRpc(request);const discovery=['initialize','ping','tools/list','notifications/initialized'].includes(message?.method);
 // Discovery contains schema only, allowing the host to provision the Site plugin.
 const explicitToken=new URL(request.url).searchParams.has('token')||request.headers.get('authorization')?.startsWith('Bearer nfy_');
 const principal=!discovery||explicitToken?await authenticateMcp(request):undefined;
 const result=await dispatchRpc(message,new URL(request.url).origin,principal);if(result===null)return new Response(null,{status:202});return Response.json(result,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){return transportFailure(e);}}
export async function GET(request:Request){try{validateOrigin(request);return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});}catch(e){return transportFailure(e);}}
