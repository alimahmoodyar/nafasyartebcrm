import {storage} from '@/lib/storage';
import {requireAccess,can,accessResponse} from '@/lib/authorization';
import {localDay} from '@/lib/device-analytics';
import {WARRANTY_CODE_ISSUED} from '@/lib/warranty';
export async function GET(){try{
 const user=await requireAccess('device'),db=storage();
 const production=await db.prepare("SELECT json_extract(payload,'$.date') AS date, COUNT(*) AS count FROM records WHERE kind='device' GROUP BY json_extract(payload,'$.date') ORDER BY date").all<{date:string;count:number}>();
 const activationAllowed=can(user,'distribution','read');const dates=new Map<string,number>();
 if(activationAllowed){const issued=await db.prepare("SELECT MIN(a.at) AS at FROM access_audit a JOIN records d ON a.target='warranty:' || d.id AND d.kind='device' WHERE a.action=? GROUP BY d.id").bind(WARRANTY_CODE_ISSUED).all<{at:string}>();
 for(const row of issued.results){const day=localDay(row.at);if(day)dates.set(day,(dates.get(day)||0)+1);}}
 return Response.json({production:production.results.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')),activation:activationAllowed?[...dates].map(([date,count])=>({date,count})):null},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت گزارش انجام نشد؛ دوباره تلاش کنید.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
