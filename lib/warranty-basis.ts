/** Blank is unknown; zero is an explicit agreement for no warranty. */
export function agreedWarrantyMonths(value:unknown):number|null{
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='number'&&typeof value!=='string')throw Error('مدت گارانتی توافق‌شده معتبر نیست.');
 const raw=typeof value==='string'?value.trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))):value;if(raw==='')return null;
 const n=Number(raw);if(!Number.isSafeInteger(n)||n<0||n>120)throw Error('مدت گارانتی توافق‌شده باید بین صفر و ۱۲۰ ماه باشد.');return n;
}
