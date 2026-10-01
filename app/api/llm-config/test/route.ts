import {requireAdmin,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {decryptToken} from '@/lib/llm-secrets';
import {providerRequest,completionBody} from '@/lib/llm-provider';
import {boundedBody} from '@/lib/firmware-storage';
export async function POST(request:Request){try{
 checkOrigin(request);const user=await requireAdmin();const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,2000)));if(typeof b.id!=='string'||!['models','probe'].includes(b.mode)||b.mode==='probe'&&b.confirmed!==true)throw new AccessError('پروفایل ذخیره‌شده و نوع آزمون لازم است.',400);
 const db=storage(),p:any=await db.prepare('SELECT * FROM llm_configs WHERE id=?').bind(b.id).first();if(!p)throw new AccessError('پروفایل یافت نشد؛ فهرست را تازه کنید.',404);
 const now=new Date().toISOString();const rate:any=await db.prepare('INSERT INTO login_attempts(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count AS n').bind('llm-test:'+user.userId,new Date(Date.now()+60000).toISOString(),now,now).first();if(rate.n>6)throw new AccessError('حداکثر شش آزمون در دقیقه مجاز است.',429);
 const key=p.token_ciphertext?await decryptToken(p.token_ciphertext,p.id):'';
 if(b.mode==='models'){const d=await providerRequest(p,key,'/models');if(!Array.isArray(d.data))throw new AccessError('سرویس فهرست مدل سازگار برنگرداند؛ آزمون پاسخ را امتحان کنید.',502);const models=d.data.map((v:any)=>v.id).filter((v:any)=>typeof v==='string'&&v.length<200).slice(0,500).sort();return Response.json({profileId:p.id,models,listed:models.includes(p.model),notice:'فهرست دریافت شد؛ وجود مدل در فهرست به معنی پشتیبانی از ابزار نیست. آزمون پاسخ را هم اجرا کنید.'},{headers:{'Cache-Control':'no-store'}});}
 const result=await providerRequest({...p,max_tokens:Math.min(p.max_tokens,512)},key,'/chat/completions',completionBody({...p,max_tokens:Math.min(p.max_tokens,512)},[{role:'user',content:'Call connection_check with ok=true. This is a connection test; no company data.'}],{tools:[{type:'function',function:{name:'connection_check',description:'Harmless connection test',parameters:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}}}],tool_choice:{type:'function',function:{name:'connection_check'}}}));
 const call=result.choices?.[0]?.message?.tool_calls?.find((c:any)=>c.function?.name==='connection_check');let ok=false;try{ok=JSON.parse(call?.function?.arguments||'{}').ok===true}catch{}
 if(!ok)throw new AccessError('سرویس پاسخ داد ولی فراخوانی ابزار معتبر برنگرداند؛ این مدل برای اجرای فرمان تأیید نشد.',502);
 return Response.json({profileId:p.id,ok:true,model:p.model,message:'اتصال و فراخوانی ابزار موفق بود.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'آزمون انجام نشد؛ تنظیمات سرور را بررسی کنید.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
