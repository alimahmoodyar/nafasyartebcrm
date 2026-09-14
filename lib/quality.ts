import {asciiDigits} from './batch-number';
export type QField={key:string;label:string;type:'number'|'text'|'result';unit:string;min:string;max:string;required:boolean};
export type QTemplate={id:string;product_id:string;version:number;title:string;fields:QField[];created:string;created_by:string};
export type QReport={id:string;device_id:string;template_id:string;values:Record<string,string>;verdict:'pass'|'fail';notes:string;created:string;created_by:string;template:QTemplate};
export function qualityFields(input:unknown):QField[]{
 if(!Array.isArray(input)||input.length<1||input.length>40)throw new Error('فرم باید ۱ تا ۴۰ معیار داشته باشد.');
 const keys=new Set<string>();return input.map(f=>{if(!f||typeof f!=='object'||['key','label','type','unit','min','max'].some(k=>typeof f[k]!=='string')||typeof f.required!=='boolean')throw new Error('مشخصات معیار معتبر نیست.');
 const key=f.key.trim(),label=f.label.trim();if(!/^[a-z][a-z0-9_]{0,39}$/.test(key)||keys.has(key)||!label||label.length>120||f.unit.length>40||!['number','text','result'].includes(f.type))throw new Error('کد انگلیسی یکتا، عنوان و نوع معتبر برای هر معیار وارد کنید.');keys.add(key);
 const min=asciiDigits(f.min).trim(),max=asciiDigits(f.max).trim();if(f.type==='number'&&[min,max].some(v=>v!==''&&!Number.isFinite(Number(v))))throw new Error('حدود پذیرش باید عدد باشند.');if(f.type==='number'&&min!==''&&max!==''&&Number(min)>Number(max))throw new Error('حد پایین نمی‌تواند از حد بالا بیشتر باشد.');
 return {key,label,type:f.type,unit:f.type==='number'?f.unit.trim():'',min:f.type==='number'?min:'',max:f.type==='number'?max:'',required:f.required};});
}
export function qualityValues(fields:QField[],input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('مقادیر فرم معتبر نیست.');const raw=input as Record<string,unknown>,values:Record<string,string>={};let failed=false;
 if(Object.keys(raw).some(k=>!fields.some(f=>f.key===k)))throw new Error('معیار خارج از فرم ارسال شده است.');
 for(const f of fields){const v=raw[f.key]??'';if(typeof v!=='string'||v.length>2000)throw new Error('مقدار معیار معتبر نیست.');let value=v.trim();if(f.required&&!value)throw new Error(f.label+' الزامی است.');
 if(value&&f.type==='number'){value=asciiDigits(value);const n=Number(value);if(!Number.isFinite(n))throw new Error(f.label+' باید عدد باشد.');if(f.min!==''&&n<Number(f.min)||f.max!==''&&n>Number(f.max))failed=true;value=String(n);}
 if(value&&f.type==='result'){if(!['pass','fail'].includes(value))throw new Error('نتیجه معیار معتبر نیست.');if(value==='fail')failed=true;}values[f.key]=value;}
 return {values,failed};}
