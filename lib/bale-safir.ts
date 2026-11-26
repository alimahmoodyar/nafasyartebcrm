import {env} from 'cloudflare:workers';
import {AccessError} from './authorization';
import {asciiDigits} from './batch-number';
import {encryptToken,decryptToken} from './llm-secrets';
import {trainingContext} from './training-context';

const objectKey='private-settings/bale-safir.v1';
const sendUrl='https://safir.bale.ai/api/v3/send_message';
type SafirSettings={botId:number;apiKey:string;enabled:boolean};

async function settings():Promise<SafirSettings|null>{
 const object=await env.BUCKET?.get(objectKey);
 if(!object)return null;
 const cipher=new TextDecoder().decode(await object.arrayBuffer());
 return JSON.parse(await decryptToken(cipher,objectKey)) as SafirSettings;
}

function view(config:SafirSettings|null){
 return {botId:config?.botId??null,hasKey:!!config?.apiKey,enabled:!!config?.enabled};
}

export async function safirStatus(){return view(await settings());}

export async function saveSafirSettings(input:{botId?:unknown;apiKey?:unknown;enabled?:unknown}){
 const digits=typeof input.botId==='string'?asciiDigits(input.botId.trim()):'';
 const botId=Number(digits);
 if(!/^[1-9]\d*$/.test(digits)||!Number.isSafeInteger(botId))throw new AccessError('شناسهٔ عددی بازو را وارد کنید.',400);
 if(typeof input.enabled!=='boolean')throw new AccessError('وضعیت ارسال را مشخص کنید.',400);
 const supplied=typeof input.apiKey==='string'?input.apiKey.trim():'';
 const apiKey=supplied||(await settings())?.apiKey||'';
 if(!/^[!-~]{1,2048}$/.test(apiKey))throw new AccessError('کلید دسترسی سفیر بله را وارد کنید.',400);
 if(!env.BUCKET)throw new AccessError('فضای ذخیرهٔ تنظیمات در دسترس نیست.',503);

 const config={botId,apiKey,enabled:input.enabled};
 const cipher=await encryptToken(JSON.stringify(config),objectKey);
 await env.BUCKET.put(objectKey,new TextEncoder().encode(cipher));
 return view(config);
}

export async function mirrorBaleSms(mobile:string,text:string,otp?:string){
 if(trainingContext.getStore()||!/^09\d{9}$/.test(mobile))return;
 try{
  const config=await settings();
  if(!config?.enabled)return;
  const messageData=otp&&/^\d{5,6}$/.test(otp)?{otp_message:{otp}}:{message:{text}};
  const response=await fetch(sendUrl,{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),
   headers:{'api-access-key':config.apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({request_id:crypto.randomUUID(),bot_id:config.botId,phone_number:'98'+mobile.slice(1),message_data:messageData}),
  });
  const result=await response.json() as {message_id?:string;error_data?:{code?:number}[]|null};
  const code=result.error_data?.[0]?.code;
  // Safir code 17 means the recipient has no Bale account.
  if(code===17)return;
  if(!response.ok||!result.message_id||result.error_data?.length)
   console.warn('Bale Safir did not accept a message.',{status:response.status,code:Number.isInteger(code)?code:undefined});
 }catch{
  // The SMS receipt remains authoritative when the optional mirror is unavailable.
  console.warn('Bale Safir delivery unavailable.');
 }
}