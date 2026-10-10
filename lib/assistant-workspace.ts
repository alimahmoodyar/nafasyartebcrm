import {formPresentation} from './assistant-form-presentation';
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
 return {tool:tool.name,section,...formPresentation(tool.name,cleanFormArgs(args),schema,title),args:cleanFormArgs(args)};
}

// Opening a requested draft must not depend on the model calling a display tool.
export function requestedOperationForm(message:string,previous:any,available:any[]):OperationForm|undefined{
 const text=message.replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/\u200c/g,' ');
 const createUser=/(کاربر|حساب کاربری|اکانت)/.test(text)&&/(جدید|ایجاد|بساز|ساخت|تعریف)/.test(text)&&!/(حذف|پاک|نساز|ایجاد نکن)/.test(text);
 const reopen=/(فرم)/.test(text)&&/(باز|بیار|بیاور|نمایش|نشان)/.test(text);
 const continuing=previous?.tool==='create_password_user'&&!/(لغو|بیخیال|بی خیال|ببند|منصرف|تمام شد)/.test(text);
 const name=createUser?'create_password_user':reopen||continuing?previous?.tool:undefined;
 const tool=available.find(t=>t.name===name&&t.write);
 if(!tool)return;
 const args=(!createUser||reopen)&&previous?.tool===name&&previous.args&&typeof previous.args==='object'?previous.args:{};
 return operationForm(tool,args,createUser?'users':previous.section||'',createUser?'ایجاد کاربر جدید':'فرم عملیات');
}
