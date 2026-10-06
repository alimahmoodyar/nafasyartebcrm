import {AccessError} from '@/lib/authorization';

export type AssistantStage='auth'|'storage'|'profiles'|'history'|'actions'|'check_duplicate'|'rate_limit'|'select_profile'|'decrypt_key'|'record_turn'|'provider'|'save_answer';
type Context={method:'GET'|'POST';route:'/api/assistant'|'/api/assistant/profiles';stage:AssistantStage};
const knownTables=['llm_configs','assistant_turns','assistant_actions','login_attempts','llm_usage','app_members','local_sessions'];
const knownColumns=['id','owner','question','answer','model','created','turn_id','tool','title','args','state','result','expires','name','base_url','token_ciphertext','system_prompt','permissions'];
const stages:Record<AssistantStage,string>={auth:'بررسی ورود',storage:'اتصال دیتابیس',profiles:'فهرست مدل‌ها',history:'سابقه گفتگو',actions:'فرمان‌های دستیار',check_duplicate:'بررسی پیام قبلی',rate_limit:'کنترل تعداد پیام',select_profile:'تنظیمات مدل',decrypt_key:'خواندن کلید مدل',record_turn:'ثبت پیام',provider:'فراخوانی مدل و ثبت مصرف',save_answer:'ثبت پاسخ'};

// Only allowlisted diagnostic facts leave the exception. Never log raw SQL,
// parameters, stack paths, messages, conversation text, cookies or provider keys.
export function assistantStorageError(error:unknown,context:Context={method:'GET',route:'/api/assistant',stage:'storage'}):AccessError{
 const parts:string[]=[];const codes:string[]=[];let e:any=error;
 for(let i=0;e&&i<4;i++,e=e.cause){parts.push(String(e.message||''));if(typeof e.code==='string'&&/^(?:SQLITE_[A-Z_]+|ERR_SQLITE_[A-Z_]+|D1_ERROR|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)$/.test(e.code))codes.push(e.code);}
 const message=parts.join(' '),tables=knownTables.filter(t=>new RegExp('\\b'+t+'\\b','i').test(message));
 const missingTable=/(?:no such table|invalid object name|relation .*does not exist)/i.test(message);
 const missingColumn=/(?:no such column|has no column named|invalid column name|column .*does not exist)/i.test(message);
 const reason=missingTable?'missing_table':missingColumn?'missing_column':/database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(message)?'database_locked':/readonly|read.only database/i.test(message)?'database_readonly':/database unavailable/i.test(message)?'database_unavailable':/FOREIGN KEY/i.test(message)?'foreign_key':/UNIQUE constraint/i.test(message)?'unique_constraint':/CHECK constraint/i.test(message)?'check_constraint':/bind|parameter count/i.test(message)?'binding_error':(error as any)?.name==='SyntaxError'?'invalid_json':(error as any)?.name==='TypeError'?'runtime_type_error':'internal_error';
 const reference=crypto.randomUUID();
 const diagnostic={event:'assistant_error',version:1,reference,at:new Date().toISOString(),...context,reason,tables,columns:missingColumn?knownColumns.filter(c=>new RegExp('\\b'+c+'\\b','i').test(message)):[],codes:[...new Set(codes)]};
 console.error('[assistant-error]',JSON.stringify(diagnostic));
 let hint='دریافت یا ثبت اطلاعات دستیار انجام نشد. مسئول سرور گزارش [assistant-error] را با کد پیگیری زیر بررسی کند.';
 if(missingTable&&tables.includes('assistant_actions'))hint='جدول فرمان‌های دستیار آماده نیست؛ مسئول سرور وضعیت مهاجرت 0012 را روی همین دیتابیس بررسی کند.';
 else if(missingTable&&tables.includes('assistant_turns'))hint='جدول سابقه دستیار آماده نیست؛ مسئول سرور وضعیت مهاجرت 0010 را روی همین دیتابیس بررسی کند.';
 else if(missingTable&&tables.includes('llm_usage'))hint='جدول ثبت مصرف مدل آماده نیست؛ مسئول سرور وضعیت مهاجرت 0019 را روی همین دیتابیس بررسی کند.';
 return new AccessError(hint+' مرحله: '+stages[context.stage]+' · کد پیگیری: '+reference,503);
}
