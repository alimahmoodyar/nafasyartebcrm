import {addDeliveryDays} from './sourcing-delivery';
export function quoteValidity(quoteDate:string,value:unknown){
 if(!/^\d{1,4}$/.test(String(value)))throw Error('اعتبار پیش‌فاکتور باید تعداد روز صحیح از ۱ تا ۳۶۵۰ باشد.');
 const days=Number(value);if(days<1||days>3650)throw Error('اعتبار پیش‌فاکتور باید تعداد روز صحیح از ۱ تا ۳۶۵۰ باشد.');
 return {quoteDate,validityDays:days,validUntil:addDeliveryDays(quoteDate,days)};
}
