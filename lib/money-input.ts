// Presentation only: keep API values as exact integer strings, never JS numbers.
export function normalizeMoneyInput(value:string,maxDigits=18):string|null {
 const raw=value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[,٬\s]/g,'');
 return /^\d*$/.test(raw)&&raw.length<=maxDigits?raw:null;
}
export function formatMoneyInput(value:string|number|null|undefined){const text=String(value??'');return /^\d*$/.test(text)?text.replace(/\B(?=(\d{3})+(?!\d))/g,','):text;}
export function moneyCaret(text:string,digits:number){if(digits<=0)return 0;let count=0;for(let i=0;i<text.length;i++)if(/\d/.test(text[i])&&++count===digits)return i+1;return text.length;}
export function moneyDigitsBefore(text:string,caret:number){return text.slice(0,caret).replace(/[^0-9۰-۹٠-٩]/g,'').length;}
