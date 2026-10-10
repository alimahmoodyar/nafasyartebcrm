import {AccessError} from './authorization';
const digits=(v:unknown)=>String(v??'').trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
export function intakeContact(b:any){
 const phone=digits(b.delivererPhone),national=digits(b.delivererNationalId),address=String(b.delivererAddress??'').trim();
 if(phone.length>40||!/^[+\d\s()-]+$/.test(phone))throw new AccessError('شماره تماس تحویل‌دهنده را وارد کنید.',400);
 const normalized=phone.replace(/[\s()-]/g,'');
 if(!/^\+?\d{8,15}$/.test(normalized))throw new AccessError('شماره تماس تحویل‌دهنده معتبر نیست؛ شماره را با پیش‌شماره وارد کنید.',400);
 if(national&&!/^\d{10}$/.test(national))throw new AccessError('کد ملی تحویل‌دهنده باید ۱۰ رقم باشد یا خالی بماند.',400);
 if(address.length>4000)throw new AccessError('آدرس تحویل‌دهنده بیش از حد طولانی است.',400);
 return {delivererPhone:normalized,delivererNationalId:national,delivererAddress:address};
}
