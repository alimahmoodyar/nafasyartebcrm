export const identityStates:Record<string,string>={incomplete:'ناقص',pending:'در انتظار بررسی',approved:'تأییدشده',returned:'نیازمند اصلاح'};
export const identityFields=[
 ['personType','نوع شخص'],['name','نام شخص / نام شرکت'],['tradeName','نام تجاری نمایندگی'],
 ['nationalId','کد ملی'],['companyId','شناسه ملی شرکت'],['registrationNo','شماره ثبت شرکت'],
 ['contactName','نام مسئول'],['contactRole','سمت مسئول'],['mobile','شماره همراه اصلی'],
 ['phone','تلفن ثابت'],['alternatePhone','شماره جایگزین'],['email','ایمیل'],
 ['province','استان'],['city','شهر'],['address','نشانی نمایندگی'],['postalCode','کد پستی']
] as const;
export const emptyIdentity=()=>Object.fromEntries(identityFields.map(([key])=>[key,key==='personType'?'natural':'']));
// Only an explicit, reciprocal representation link shares an identity. Names or
// national identifiers never silently merge independently owned agency accounts.
export function linkedIdentityId(a:any,b:any){
 const one=a?.identityId||'',two=b?.identityId||'';
 if(one&&two&&one!==two)throw Error('دو شناسنامهٔ مستقل موجود است؛ پیش از اتصال، مدیر سامانه باید یکسان‌سازی آن‌ها را بررسی کند.');
 return one||two;
}
