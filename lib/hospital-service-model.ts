export const hospitalModelKey=(value:string)=>value.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200e\u200f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();

export const hospitalOxygenProduct=(p:any)=>/اکسیژن|oxygen/i.test([p?.name,p?.group,p?.model].join(' '));
export const hospitalSerialKey=(value:string)=>value.normalize('NFKC').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim().toUpperCase();
