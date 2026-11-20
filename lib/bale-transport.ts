// Server-only provider adapter. No caller-controlled host or remote attachment URL.
export class BaleProviderError extends Error {
 constructor(public outcome:'failed'|'unknown',public code:string){super(code);}
}
export async function baleRequest(token:string,method:'getMe'|'getUpdates'|'getWebhookInfo'|'sendMessage'|'sendDocument',body:Record<string,unknown>|FormData={}){
 let response:Response;
 try{response=await fetch(`https://tapi.bale.ai/bot${token}/${method}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:body instanceof FormData?undefined:{'Content-Type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)});}
 catch{throw new BaleProviderError('unknown','ارتباط با بله نتیجهٔ قطعی نداد.');}
 let data:any;try{data=await response.json();}catch{throw new BaleProviderError('unknown','پاسخ بله قابل تشخیص نبود.');}
 if(!response.ok||data?.ok!==true){
  const definitive=Number.isInteger(data?.error_code)&&data.error_code>=400&&data.error_code<500;
  throw new BaleProviderError(definitive?'failed':'unknown',definitive?`بله درخواست را نپذیرفت (کد ${data.error_code}).`:'نتیجهٔ درخواست بله نامشخص است.');
 }
 return data.result;
}
export function baleFile(bytes:Uint8Array,filename:string,mime:string,caption=''){
 if(!bytes.byteLength||bytes.byteLength>20*1024*1024||!filename||filename.length>180||/[\\/\r\n]/.test(filename)||caption.length>4096)throw new Error('فایل معتبر حداکثر ۲۰ مگابایت لازم است.');
 const form=new FormData();form.set('document',new Blob([new Uint8Array(bytes)],{type:mime||'application/octet-stream'}),filename);if(caption)form.set('caption',caption);return form;
}
