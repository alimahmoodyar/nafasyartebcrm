import {AccessError,session} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {trainingContext} from '@/lib/training-context';
import {isIsoDay,localDay} from '@/lib/persian-date';
import type {Session} from '@/lib/permissions';

export type UsageContext={user:Session;requestId:string;source:'assistant'|'hospital_assistant'|'connection_test';round:number};
const integer=(v:unknown):number|null=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
// Keep only numeric usage metadata, never arbitrary provider text, prompts or credentials.
export function usageNumbers(v:unknown,depth=0):Record<string,unknown>|null {
 if(!v||typeof v!=='object'||Array.isArray(v)||depth>4)return null;
 const out:Record<string,unknown>={};
 for(const [k,n] of Object.entries(v).slice(0,100)){
  if(!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(k))continue;
  if(integer(n)!==null)out[k]=n;
  else {const child=usageNumbers(n,depth+1);if(child&&Object.keys(child).length)out[k]=child;}
 }
 return Object.keys(out).length?out:null;
}
export function normalizeUsage(value:any){
 const raw=usageNumbers(value),input=integer(value?.prompt_tokens)??integer(value?.input_tokens),output=integer(value?.completion_tokens)??integer(value?.output_tokens);
 const reportedTotal=integer(value?.total_tokens),sum=input!==null&&output!==null?input+output:null;
 const total=sum!==null&&Number.isSafeInteger(sum)?sum:reportedTotal;
 return {input,output,total,reportedTotal,raw,complete:input!==null&&output!==null&&total!==null,
 cached:integer(value?.prompt_tokens_details?.cached_tokens)??integer(value?.input_tokens_details?.cached_tokens)??integer(value?.cache_read_input_tokens),
 reasoning:integer(value?.completion_tokens_details?.reasoning_tokens)??integer(value?.output_tokens_details?.reasoning_tokens),
 mismatch:sum!==null&&reportedTotal!==null&&sum!==reportedTotal};
}
export function assertCompanyUsage(){if(trainingContext.getStore())throw new AccessError('گزارش و مصرف واقعی مدل در محیط آموزش در دسترس نیست.',403);}
export async function beginUsage(profile:any,c:UsageContext,attempt:number){
 assertCompanyUsage();if(!c?.user?.userId)throw new AccessError('هویت مصرف‌کننده مدل مشخص نیست.',500);
 const id=crypto.randomUUID(),started=new Date().toISOString();
 await storage().prepare(`INSERT INTO llm_usage(id,request_id,user_id,user_name,username,profile_id,profile_name,model,source,round,attempt,day,started_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`).bind(id,c.requestId,c.user.userId,c.user.name||c.user.username||'کاربر',c.user.username||'',profile.id,profile.name,profile.model,c.source,c.round,attempt,localDay(started),started).run();
 return {id,started};
}
export async function finishUsage(ticket:{id:string;started:string},result:{status:string;httpStatus:number|null;payload?:any;errorCode?:string}){
 const n=normalizeUsage(result.payload?.usage),finished=new Date().toISOString(),safeId=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,200}$/.test(v)?v:null;
 await storage().prepare(`UPDATE llm_usage SET finished_at=?,duration_ms=?,status=?,http_status=?,error_code=?,response_id=?,response_model=?,input_tokens=?,output_tokens=?,total_tokens=?,reported_total_tokens=?,cached_tokens=?,reasoning_tokens=?,usage_json=?,usage_complete=?,total_mismatch=? WHERE id=? AND status='pending'`).bind(finished,Math.max(0,Date.parse(finished)-Date.parse(ticket.started)),result.status,result.httpStatus,safeId(result.errorCode),safeId(result.payload?.id),safeId(result.payload?.model),n.input,n.output,n.total,n.reportedTotal,n.cached,n.reasoning,n.raw?JSON.stringify(n.raw):null,n.complete?1:0,n.mismatch?1:0,ticket.id).run();
}
const sums=`COUNT(*) AS requests,COALESCE(SUM(input_tokens),0) AS inputTokens,COALESCE(SUM(output_tokens),0) AS outputTokens,COALESCE(SUM(total_tokens),0) AS totalTokens,COALESCE(SUM(usage_complete=0),0) AS unknownUsage,COALESCE(SUM(status='pending'),0) AS pending,COALESCE(SUM(status NOT IN ('pending','succeeded')),0) AS failures,COALESCE(SUM(total_mismatch),0) AS mismatches`;
function positive(v:string|null,fallback:number,max:number){if(v===null||v==='')return fallback;const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>max)throw new AccessError('شماره یا اندازه صفحه معتبر نیست.',400);return n;}
export async function usageReport(params:URLSearchParams){
 assertCompanyUsage();const user=await session();const end=params.get('to')||localDay();if(!isIsoDay(end))throw new AccessError('تاریخ پایان معتبر نیست.',400);const start=params.get('from')||new Date(Date.parse(end+'T12:00:00Z')-29*86400000).toISOString().slice(0,10);
 if(!isIsoDay(start)||!isIsoDay(end)||start>end||Date.parse(end)-Date.parse(start)>365*86400000)throw new AccessError('بازه تاریخ معتبر تا حداکثر ۳۶۶ روز انتخاب کنید.',400);
 const requested=params.get('userId')||'';if(!user.isAdmin&&requested&&requested!==user.userId)throw new AccessError('فقط گزارش مصرف حساب خودتان قابل مشاهده است.',403);
 const owner=user.isAdmin?requested:user.userId;if(owner.length>200)throw new AccessError('کاربر معتبر نیست.',400);
 const page=positive(params.get('page'),1,1000000),userPage=positive(params.get('userPage'),1,1000000),pageSize=positive(params.get('pageSize'),25,100);
 const db=storage(),where='day>=? AND day<=?'+(owner?' AND user_id=?':''),args=[start,end,...(owner?[owner]:[])];
 // One D1 batch gives counts, graphs and pagination the same database snapshot.
 const statements=[
  db.prepare(`SELECT ${sums} FROM llm_usage WHERE ${where}`).bind(...args),
  db.prepare(`SELECT COUNT(DISTINCT user_id) AS total FROM llm_usage WHERE ${where}`).bind(...args),
  db.prepare(`SELECT * FROM llm_usage WHERE ${where} ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...args,pageSize,(page-1)*pageSize),
  db.prepare(`SELECT day,${sums} FROM llm_usage WHERE ${where} GROUP BY day ORDER BY day`).bind(...args),
  db.prepare(`SELECT user_id AS userId,MAX(user_name) AS userName,MAX(username) AS username,${sums} FROM llm_usage WHERE ${where} GROUP BY user_id ORDER BY totalTokens DESC,user_id LIMIT ? OFFSET ?`).bind(...args,pageSize,(userPage-1)*pageSize),
  db.prepare(`SELECT user_id AS userId,MAX(user_name) AS userName,${sums} FROM llm_usage WHERE ${where} GROUP BY user_id ORDER BY totalTokens DESC,user_id LIMIT 10`).bind(...args),
 ];
 const r=await db.batch(statements),summary:any=r[0].results[0],userCount=Number((r[1].results[0] as any).total),byDay=new Map(r[3].results.map((d:any)=>[d.day,d]));
 const daily=[];for(let d=start;d<=end;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10))daily.push(byDay.get(d)||{day:d,requests:0,inputTokens:0,outputTokens:0,totalTokens:0,unknownUsage:0,failures:0,pending:0,mismatches:0});
 return {scope:user.isAdmin?'all':'own',accountId:user.userId,from:start,to:end,asOf:new Date().toISOString(),summary,daily,topUsers:r[5].results,users:r[4].results,userCount,userPage,userPages:Math.ceil(userCount/pageSize),page,pageSize,pages:Math.ceil(summary.requests/pageSize),rows:r[2].results.map((v:any)=>({...v,usage:v.usage_json?JSON.parse(v.usage_json):null,usage_json:undefined})),notice:'هر ردیف یک فراخوانی واقعی سرویس است؛ مراحل یک پیام و تلاش‌های مجدد جدا هستند. ارقام نامشخص در جمع مصرف منظور نمی‌شوند. جزئیات کش و استدلال زیرمجموعه‌اند و دوباره جمع نمی‌شوند. سوابق پیش از فعال‌شدن ثبت مصرف قابل بازیابی نیستند.'};
}
