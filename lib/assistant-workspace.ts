import {fields,type Kind} from './model';
// Shared UI draft contract. Drafts never execute a business operation.
export type OperationForm={tool:string;section:string;title:string;args:Record<string,any>;schema:any;actionId?:string;state?:string;result?:any};
const secret=/password|token|secret|cipher|api.?key/i;
export function cleanFormArgs(value:any,depth=0):any{
 if(depth>12)throw new Error('اطلاعات فرم بیش از حد پیچیده است.');
 if(Array.isArray(value))return value.map(v=>cleanFormArgs(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!secret.test(k)&&!['__proto__','constructor','prototype','confirmed'].includes(k)).map(([k,v])=>[k,cleanFormArgs(v,depth+1)]));
 return value;
}
export function operationForm(tool:any,args:any,section:string,title:string):OperationForm{
 if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>16000)throw new Error('اطلاعات فرم معتبر نیست.');
 const schema:any={...tool.inputSchema,properties:Object.fromEntries(Object.entries(tool.inputSchema.properties||{}).filter(([k])=>!secret.test(k)&&k!=='confirmed')),required:(tool.inputSchema.required||[]).filter((k:string)=>!secret.test(k)&&!['confirmed','id','requestId'].includes(k))};
 if(['create_record','update_record'].includes(tool.name)&&fields[args.kind as Kind]){const fs=fields[args.kind as Kind].filter(f=>f.type!=='snapshot');schema.properties.data={type:'object',properties:Object.fromEntries(fs.map(f=>[f.key,{type:'string',title:f.label,...(f.options?{enum:f.options}:{})}])),required:fs.filter(f=>f.required).map(f=>f.key)};}
 return {tool:tool.name,section,title,args:cleanFormArgs(args),schema};
}
