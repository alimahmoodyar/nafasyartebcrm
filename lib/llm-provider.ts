import {AccessError} from '@/lib/authorization';
export function providerBase(base:string){const u=new URL(base);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new AccessError('نشانی سرویس مدل معتبر نیست.',400);u.pathname=u.pathname.replace(/\/(chat\/completions|models)\/?$/,'').replace(/\/$/,'');return u.toString().replace(/\/$/,'');}
export function completionBody(profile:any,messages:any[],extra:Record<string,unknown>={}){
 const body:any={model:profile.model,messages,temperature:Number(profile.temperature),max_tokens:Math.min(profile.max_tokens,4096),...extra};
 const reasoning=new URL(profile.base_url).hostname==='api.openai.com'&&/^(gpt-5|o[134](?:-|$))/.test(profile.model);
 if(reasoning){delete body.temperature;delete body.max_tokens;body.max_completion_tokens=Math.min(profile.max_tokens,4096);}
 // GPT-6 Luna/Sol require none for Chat Completions function calling.
 // Keep it on every round, including the final round with tool history but no tools.
 // Match dated snapshots too; apply to compatible gateways serving these model IDs.
 // https://developers.openai.com/api/docs/models/gpt-6-luna
 if(/^gpt-6-(?:luna|sol)(?:-\d{4}-\d{2}-\d{2})?$/.test(profile.model)){
  body.reasoning_effort='none';
  delete body.max_tokens;body.max_completion_tokens=Math.min(profile.max_tokens,4096);
 }
 return body;
}
// Expose only bounded machine identifiers, never provider messages or request bodies.
export function providerErrorDetail(error:any,body:any){
 const safe=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_.\[\]-]{1,120}$/.test(value)?value:'';
 const code=safe(error?.code),param=safe(error?.param);
 const match=param.match(/^tools(?:\[(\d+)\]|\.(\d+))(?:\.|$)/);
 const tool=match?safe(body?.tools?.[Number(match[1]??match[2])]?.function?.name):'';
 return [code&&'کد: '+code,param&&'پارامتر: '+param,tool&&'ابزار: '+tool].filter(Boolean).join(' · ');
}
export async function providerRequest(profile:any,key:string,path:string,body?:any){
 const endpoint=providerBase(profile.base_url)+path;let attemptBody=body?{...body}:undefined;
 for(let attempt=0;attempt<3;attempt++){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);let r:Response,d:any;
 try{r=await fetch(endpoint,{method:body?'POST':'GET',redirect:'manual',signal:controller.signal,headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(attemptBody)}:{})});if(r.status>=300&&r.status<400)throw new AccessError('نشانی سرویس هدایت برگرداند؛ Base URL مستقیم API را وارد کنید.',502);try{d=await r.json()}catch{if(r.ok)throw new AccessError('سرویس به‌جای JSON پاسخ دیگری داد؛ Base URL را بررسی کنید.',502);d={};}}
 catch(e){if(e instanceof AccessError)throw e;throw new AccessError('اتصال به سرویس مدل برقرار نشد یا پس از ۶۰ ثانیه پاسخ نداد؛ شبکه و Base URL را بررسی کنید.',502)}finally{clearTimeout(timer)}
 if(r.ok)return d;
 const code=typeof d?.error?.code==='string'?d.error.code:'',param=d?.error?.param;
 // Only retry explicit parameter rejection: no retry of a successful or ambiguous request.
 if(r.status===400&&attemptBody&&attempt<2&&['unsupported_parameter','unsupported_value'].includes(code)){
 if(param==='temperature'&&'temperature' in attemptBody){delete attemptBody.temperature;continue;}
 if(param==='max_tokens'&&'max_tokens' in attemptBody){attemptBody.max_completion_tokens=attemptBody.max_tokens;delete attemptBody.max_tokens;continue;}
 }
 const message=code==='model_not_found'||r.status===404?'مدل «'+profile.model+'» یا مسیر API پیدا نشد یا این کلید به آن دسترسی ندارد. در تنظیمات، «مدل‌های سرویس» را بررسی کنید.':code==='insufficient_quota'?'اعتبار یا سهمیه API این حساب تمام شده است.':r.status===401?'کلید API معتبر نیست؛ توکن همین پروفایل را بررسی کنید.':r.status===403?'سرویس به این کلید، مدل یا محل اتصال مجوز نمی‌دهد.':r.status===429?'سرویس محدودیت تعداد درخواست یا سهمیه اعلام کرده است.':r.status===400?'سرویس تنظیمات درخواست را نپذیرفت'+(['temperature','max_tokens','max_completion_tokens','tools','tool_choice','messages'].includes(param)?'؛ پارامتر '+param:'')+'؛ جزئیات زیر برای بررسی سازگاری درخواست است.':'سرویس مدل پاسخ ناموفق داد.';
 const detail=providerErrorDetail(d?.error,attemptBody);
 throw new AccessError(message+' (HTTP '+r.status+')'+(detail?' — '+detail:'')+' [llm-errors-2]',502);
 }
 throw new AccessError('تنظیمات درخواست مدل سازگار نیست.',502);
}
