// Public staff numbers are separate from immutable dossier/account identifiers.
export const automaticLegacyPersonnelCode=(value:unknown)=>typeof value==='string'&&/^P-[0-9a-f]{32}$/i.test(value);
export function personnelCodeKey(value:unknown){
 if(typeof value!=='string'||value.length>200)throw Error('کد پرسنلی معتبر نیست.');
 const code=value.trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[a-z]/g,c=>c.toUpperCase());
 return /^\d+$/.test(code)?BigInt(code).toString():code;
}
export function personnelCodeLabel(value:unknown){
 if(!value)return 'کد پرسنلی تعیین نشده';
 if(automaticLegacyPersonnelCode(value))return 'در حال تخصیص کد پرسنلی';
 return 'کد پرسنلی: '+String(value).replace(/[0-9]/g,c=>'۰۱۲۳۴۵۶۷۸۹'[Number(c)]);
}
