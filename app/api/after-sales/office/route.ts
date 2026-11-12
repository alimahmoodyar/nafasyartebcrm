import {requireAccess,accessResponse} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {readOfficeService} from '@/lib/service-office';
async function get(r:Request){try{return Response.json(await readOfficeService(await requireAccess(),new URL(r.url).searchParams),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})}catch(e){return accessResponse(e)||Response.json({error:'اطلاعات خدمات دفتر دریافت نشد.'},{status:503})}}
export const GET=withServiceRolePreview(get);
