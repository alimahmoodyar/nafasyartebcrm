import {requireAccess,accessResponse} from '@/lib/authorization';
import {assetRegistration} from '@/lib/asset-registration';
export async function GET(request:Request){try{const user=await requireAccess(),{group,items}=await assetRegistration(user,new URL(request.url).searchParams.get('id')||'');return Response.json({id:group.id,name:group.data.name,items},{headers:{'Cache-Control':'private, no-store'}})}catch(e){return accessResponse(e)||Response.json({error:'گروه ثبت در دسترس نیست.'},{status:503})}}
