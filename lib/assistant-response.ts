import {AccessError} from './authorization';

// Compatible gateways may return text blocks instead of a plain content string.
// Never interpret reasoning, tool arguments or arbitrary objects as user-facing text.
export function assistantResponseText(message:any){
 const content=message?.content;
 if(typeof content==='string')return content.trim();
 if(!Array.isArray(content))return '';
 return content.filter(part=>part?.type==='text'||part?.type==='output_text').map(part=>typeof part.text==='string'?part.text:'').join('\n').trim();
}

// Use bounded local reasons, not raw provider payloads, refusals or credentials.
export function assistantEmptyResponseError(payload:any){
 const choice=payload?.choices?.[0],reason=choice?.finish_reason;
 if(reason==='length')return new AccessError('سرویس مدل پیش از آماده‌شدن پاسخ به سقف خروجی رسید. مدیر، سقف پاسخ این مدل را در تنظیمات دستیار بررسی کند. [assistant-output-limit]',502);
 if(reason==='content_filter'||choice?.message?.refusal)return new AccessError('سرویس مدل پاسخ این درخواست را محدود کرده است. [assistant-response-restricted]',502);
 if(reason==='tool_calls'||choice?.message?.tool_calls?.length)return new AccessError('مدل پس از مراحل بررسی، پاسخ نهایی ارائه نکرد. دوباره تلاش کنید یا فرم موردنظر را از فهرست فرم‌ها باز کنید. [assistant-no-final-answer]',502);
 return new AccessError('سرویس مدل پاسخ متنی قابل نمایش برنگرداند. دوباره تلاش کنید؛ در صورت تکرار، مدیر سازگاری مدل و سرویس انتخابی را بررسی کند. [assistant-empty-response]',502);
}
