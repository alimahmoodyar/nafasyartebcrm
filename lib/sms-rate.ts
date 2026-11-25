import {AccessError} from './authorization';
import {storage} from './storage';
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export async function rate(scope:string,value:string,limit:number,windowMs:number){
 const db=storage(),now=new Date().toISOString(),key='public-warranty:'+scope+':'+await hash(value);
 const row=await db.prepare('INSERT INTO login_attempts(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count')
  .bind(key,new Date(Date.now()+windowMs).toISOString(),now,now).first<{count:number}>();
 if(!row||row.count>limit)throw new AccessError('تعداد درخواست زیاد است. کمی صبر کنید و دوباره تلاش کنید.',429);
}
