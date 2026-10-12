import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {readableBuildIntakes} from '@/lib/build-intake';
import {buildIntakeRoles} from '@/lib/build-intake-access';
import {salesVisible} from '@/lib/sales';
import {firmwareBucket} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
export async function GET(request:Request){try{
 const {u,source,intakes}=await readableBuildIntakes(await requireAccess()),id=new URL(request.url).searchParams.get('id'),file=source.rows.find((r:any)=>r.type==='sales_file'&&r.id===id);
 const attached=file&&intakes.some((r:any)=>(r.data.fileIds||[]).includes(file.id)),agent=file&&source.rows.find((r:any)=>r.type==='sales_agent'&&r.id===file.data.agentId);
 if(!file||!attached&&!(buildIntakeRoles(u).sales&&agent&&await salesVisible(u,agent)))throw new AccessError('فایل در دسترسی شما نیست.',404);
 const object=await firmwareBucket().get(file.data.objectKey);if(!object)throw new AccessError('فایل در دسترس نیست.',503);const bytes=await object.arrayBuffer();if(bytes.byteLength!==file.data.size||await sha256(bytes)!==file.data.sha256)throw new AccessError('یکپارچگی فایل تأیید نشد.',503);
 return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=customer-specification; filename*=UTF-8''"+encodeURIComponent(file.data.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت مدرک ممکن نشد.'},{status:503});}}
