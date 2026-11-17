// Pure local validation: format/check digits never establish ownership or account status.
export function normalizeIranIban(value:unknown){
 if(typeof value!=='string')return '';
 const compact=value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\s/g,'').toUpperCase();
 return compact?(compact.startsWith('IR')?compact:'IR'+compact):'';
}
export function iranIbanDigits(value:unknown){const normalized=normalizeIranIban(value);return normalized.startsWith('IR')?normalized.slice(2):normalized;}
export function validIranIban(value:unknown){
 const iban=normalizeIranIban(value);if(!/^IR\d{24}$/.test(iban))return false;
 let remainder=0;for(const digit of iban.slice(4)+'1827'+iban.slice(2,4))remainder=(remainder*10+Number(digit))%97;
 return remainder===1;
}
export function iranIbanError(value:unknown,required=false){
 const iban=normalizeIranIban(value);if(!iban)return required?'شماره شبا را وارد کنید.':'';
 if(!/^IR\d{24}$/.test(iban))return 'شماره شبا باید ۲۴ رقم باشد؛ IR را جداگانه وارد نکنید.';
 return validIranIban(iban)?'':'رقم کنترلی شبا صحیح نیست؛ شماره را دوباره بررسی کنید.';
}
