import {env} from 'cloudflare:workers';
import {AccessError} from '@/lib/authorization';

export type AssistantStage='auth'|'storage'|'profiles'|'history'|'actions'|'check_duplicate'|'rate_limit'|'select_profile'|'decrypt_key'|'record_turn'|'provider'|'save_answer';
type Context={method:'GET'|'POST';route:'/api/assistant'|'/api/assistant/profiles'|'/api/assistant/actions';stage:AssistantStage};
const knownTables=['llm_configs','assistant_turns','assistant_actions','login_attempts','llm_usage','app_members','local_sessions'];
const knownColumns=['id','owner','question','answer','model','created','turn_id','tool','title','args','state','result','expires','name','base_url','token_ciphertext','system_prompt','permissions'];
const stages:Record<AssistantStage,string>={auth:'بررسی ورود',storage:'اتصال دیتابیس',profiles:'فهرست مدل‌ها',history:'سابقه گفتگو',actions:'فرمان‌های دستیار',check_duplicate:'بررسی پیام قبلی',rate_limit:'کنترل تعداد پیام',select_profile:'تنظیمات مدل',decrypt_key:'خواندن کلید مدل',record_turn:'ثبت پیام',provider:'فراخوانی مدل و ثبت مصرف',save_answer:'ثبت پاسخ'};

// Internal details are returned only after server-side admin authentication.
// Nothing is written to console or persisted as part of this diagnostic path.
export function assistantStorageError(error:unknown,context:Context={method:'GET',route:'/api/assistant',stage:'storage'},options:{admin?:boolean;secrets?:string[]}={}):AccessError{
 const parts:string[]=[];const codes:string[]=[];let e:any=error;
 for(let i=0;e&&i<4;i++,e=e.cause){parts.push(String(e.message||''));if(typeof e.code==='string'&&/^(?:SQLITE_[A-Z_]+|ERR_SQLITE_[A-Z_]+|D1_ERROR|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)$/.test(e.code))codes.push(e.code);}
 const message=parts.join(' '),tables=knownTables.filter(t=>new RegExp('\\b'+t+'\\b','i').test(message));
 const missingTable=/(?:no such table|invalid object name|relation .*does not exist)/i.test(message);
 const missingColumn=/(?:no such column|has no column named|invalid column name|column .*does not exist)/i.test(message);
 const reason=missingTable?'missing_table':missingColumn?'missing_column':/database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(message)?'database_locked':/readonly|read.only database/i.test(message)?'database_readonly':/database unavailable/i.test(message)?'database_unavailable':/FOREIGN KEY/i.test(message)?'foreign_key':/UNIQUE constraint/i.test(message)?'unique_constraint':/CHECK constraint/i.test(message)?'check_constraint':/bind|parameter count/i.test(message)?'binding_error':(error as any)?.name==='SyntaxError'?'invalid_json':(error as any)?.name==='TypeError'?'runtime_type_error':'internal_error';
 const reference=crypto.randomUUID();

 const debug=options.admin===true&&!/^(false|0|off)$/i.test(String(env.ASSISTANT_DEBUG||''));
 let hint='دریافت یا ثبت اطلاعات دستیار انجام نشد. کد پیگیری را برای بررسی خطا ارسال کنید.';
 if(missingTable&&tables.includes('assistant_actions'))hint='جدول فرمان‌های دستیار آماده نیست؛ مسئول سرور وضعیت مهاجرت 0012 را روی همین دیتابیس بررسی کند.';
 else if(missingTable&&tables.includes('assistant_turns'))hint='جدول سابقه دستیار آماده نیست؛ مسئول سرور وضعیت مهاجرت 0010 را روی همین دیتابیس بررسی کند.';
 else if(missingTable&&tables.includes('llm_usage'))hint='جدول ثبت مصرف مدل آماده نیست؛ مسئول سرور وضعیت مهاجرت 0019 را روی همین دیتابیس بررسی کند.';
 return new AccessError(hint+' مرحله: '+stages[context.stage]+' · کد پیگیری: '+reference+(debug?'\n\n[DEBUG — مدیر]\n'+context.method+' '+context.route+'\nStage: '+context.stage+' | Reason: '+reason+(codes.length?' | Codes: '+[...new Set(codes)].join(', '):'')+'\n'+debugDetails(error,options.secrets||[]):''),503);
}


function debugDetails(error:unknown,extraSecrets:string[]):string{
 const runtimeSecrets=[env.LLM_CONFIG_ENCRYPTION_KEY,env.PASSWORD_VAULT_KEY,env.INITIAL_ADMIN_PASSWORD,env.TASK_SCHEDULER_TOKEN,...extraSecrets].filter((s):s is string=>typeof s==='string'&&s.length>0);
 const allowedQuoted=new Set([...knownTables,...knownColumns,'results','reverse','map','data','length','prepare','bind','all','first']);
 function redact(value:unknown){
  let text=String(value||'');
  for(const secret of runtimeSecrets)text=text.split(secret).join('[REDACTED]');
  text=text.replace(/https?:\/\/[^\s<>"']+/gi,v=>{try{const u=new URL(v);u.username='';u.password='';u.search='';u.hash='';return u.toString()}catch{return '[URL]'}})
   .replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi,'[AUTH REDACTED]')
   .replace(/(?:github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]+)/g,'[TOKEN REDACTED]')
   .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[SESSION REDACTED]')
   .replace(/\b(?:api[_-]?key|token(?:_ciphertext)?|password|secret|authorization|cookie|set-cookie)\b["']?\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;\n]+)/gi,'[CREDENTIAL REDACTED]')
   .replace(/(?:^|\n)\s*(?:params?|parameters?|bindings?|values?)\s*:[\s\S]*/gi,'\n[QUERY VALUES REDACTED]')
   .replace(/(["'])(?:\\.|(?!\1)[^\\\r\n])*?\1/g,v=>allowedQuoted.has(v.slice(1,-1))?v:'"[REDACTED]"');
  return text.slice(0,5000);
 }
 const out:string[]=[];let e:any=error;
 for(let i=0;e&&i<4;i++,e=e.cause){const name=['Error','TypeError','SyntaxError','RangeError','ReferenceError','DOMException'].includes(e.name)?e.name:'Error';const message=name+': '+redact(e.message??e);const stack=typeof e.stack==='string'?redact(e.stack).split('\n').slice(1,7).join('\n'):'';out.push((i?'Caused by: ':'')+message+(stack?'\n'+stack:''));}
 return out.join('\n\n').slice(0,16000);
}
