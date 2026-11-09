import {withRepresentativeSample} from '@/lib/representative-sample';
import {requireAccess,accessResponse} from '@/lib/authorization';
import {workflowGuide} from '@/lib/workflow-guidance-server';
async function get(request:Request){try{const u=await requireAccess(),q=new URL(request.url).searchParams;return Response.json(await workflowGuide(u,{taskId:q.get('taskId')||undefined,threadId:q.get('threadId')||undefined}),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});}catch(e){return accessResponse(e)||Response.json({error:'بررسی راهنمای کار ممکن نشد؛ دوباره تلاش کنید.'},{status:503});}}

export const GET=withRepresentativeSample(get);
