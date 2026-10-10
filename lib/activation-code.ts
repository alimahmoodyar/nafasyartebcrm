// Server only: compatibility with Activation.vb GenerateActivationCode(..., True).
// The tenth digit is deliberately discarded by the original algorithm.
export function normalizeActivationInput(value:unknown):string {
 if(typeof value!=='string')throw new Error('کد دستگاه باید متن ۱۰رقمی باشد.');
 const code=value.trim().replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632)));
 if(!/^[0-9]{10}$/.test(code))throw new Error('کد نمایش‌داده‌شده روی دستگاه را دقیقاً با ۱۰ رقم وارد کنید.');
 if(!/[0-3]/.test(code[3]))throw new Error('رقم چهارم کد دستگاه باید صفر، یک، دو یا سه باشد.');
 return code;
}
export function generateActivationCode(value:unknown):string {
 const code=normalizeActivationInput(value),a=Number(code.slice(0,5)),b=Math.floor(Number(code.slice(5))/10);
 const coefficients=[[427,123],[742,485],[72,363],[10,742],[537,181],[763,211],[219,431],[745,521],[436,858],[910,435]];
 const [x,y]=coefficients[(a*a+b*b)%10];
 // Integer intermediates are below 2^53 for all ten-digit inputs.
 return String((x*a*a+y*b)%100000).padStart(5,'0');
}
