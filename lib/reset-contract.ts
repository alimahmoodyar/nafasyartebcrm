export const resetScopes:Record<string,string>={operations:'پاک‌سازی سوابق و موجودی؛ حفظ تعاریف کالا',full:'پاک‌سازی سوابق، موجودی و تعاریف کالا'};
export const resetPreserved=['عکس‌های پروفایل کاربران (همراه حساب‌ها حفظ می‌شوند)','حساب‌ها، هش و نسخه رمزگذاری‌شده رمز ورود، الزام تغییر رمز اولیه، دسترسی‌ها و سمت‌های کارکنان','هویت نماینده‌های خدمات و ارتباط آن‌ها با حساب کاربران','تنظیمات مدل‌ها، کلیدهای اتصال و هویت سامانه','درخواست‌های توسعه و نتیجه تست‌های ثبت‌شده در آن بخش','سوابق امنیتی و نسخه پشتیبان پاک‌سازی','شرح وظایف و الگوهای برنامه کاری؛ پس از پاک‌سازی غیرفعال می‌شوند'];
export const resetCatalog=['محصولات و نسخه‌های نرم‌افزار دستگاه','تعاریف مواد اولیه، BOM و فرم‌های کنترل کیفیت','ظرفیت تولید، گیرندگان فروش، تعرفه خدمات و خودروها'];
// Ordered children before parents. SQL identifiers and predicates are constant, never caller input.
export const resetTables:Record<string,string>={
 assistant_actions:'فرمان‌های دستیار',assistant_turns:'گفت‌وگوهای دستیار',duty_files:'پیوست‌های وظایف',duty_notices:'اعلان‌های وظایف',duty_runs:'سوابق انجام وظایف',
 service_offsets:'تهاتر خدمات',service_reservations:'رزرو قطعات خدمات',service_files:'پیوست‌های خدمات',service_ledger:'گردش مالی خدمات',service_lots:'موجودی قطعات خدمات',service_activations:'فعال‌سازی گارانتی',sourcing_holds:'تخصیص‌های تأمین',
 quality_files:'پیوست‌های کنترل کیفیت',quality_reports:'نتایج کنترل کیفیت',batch_files:'پیوست‌های بچ',finance_files:'فایل‌های کنترل مالی',finance_notes:'بررسی‌های مالی',
 production_materials:'مصرف مواد تولید',production_receipts:'رسید محصول',production_orders:'برگ‌های تولید',inventory_entries:'گردش انبار',inventory_balances:'موجودی انبار',inventory_batches:'بچ‌های انبار',flow_slots:'محل‌های دارای موجودی',
 serial_reservations:'سریال‌های رزروشده',serial_runs:'نوبت‌های چاپ سریال',inventory_operations:'عملیات کاری ثبت‌شده',quality_templates:'فرم‌های کنترل کیفیت',bom_versions:'نسخه‌های BOM',firmware_files:'فایل‌های نرم‌افزار دستگاه',flow_entities:'گردش‌های کاری و اطلاعات پایه',records:'سوابق دستگاه، کالا، بچ و خدمات'
};
export const resetFlowPreserved=['account_profile','position','duty_template','duty_catalog_install','transport_migration','development_request','as_agent'];
export const resetFlowCatalog=['material','capacity','party','as_tariff','transport_vehicle'];
// Service province/coverage lives inside as_agent (preserved identity) and
// customer province inside as_case (operational reset); existing backup/freeze apply.
export function resetWhere(table:string,scope:string){
 if(scope!=='operations'&&scope!=='full')throw Error('Invalid reset scope');
 if(!Object.hasOwn(resetTables,table))throw Error('Invalid reset table');
 if(table==='flow_entities')return "type NOT IN ("+[...resetFlowPreserved,...(scope==='operations'?resetFlowCatalog:[])].map(t=>"'"+t+"'").join(',')+")";
 if(scope==='operations'&&['quality_templates','bom_versions','firmware_files'].includes(table))return '0=1';
 if(table==='records'&&scope==='operations')return "kind NOT IN ('product','firmware')";
 return '1=1';
}
// replenishment_policy and workflow_health use flow_entities: covered by existing freeze triggers, backup and both reset predicates.
export const resetHelp=[
 'تنظیمات پایش خودکار تأمین، سلامت زمان‌بند و پرونده‌های آن در هر دو محدوده پاک می‌شوند؛ شروع مجدد نیاز به تعیین مسئول‌ها و فعال‌سازی دوباره پایش دارد.',
 'این عملیات همه داده‌های محدوده انتخاب‌شده را حذف می‌کند؛ تشخیص خودکار آزمایشی از واقعی وجود ندارد. ابتدا محدوده و تعداد را با مدیر بررسی کن.',
 'فقط مدیر سامانه: رمز مستقل را در صفحه مدیریت پاک‌سازی تعریف/دریافت کند. رمز هرگز در گفتگو یا ابزار مدل وارد نشود. نگهداری امن رمز با مدیر است.',
 'آماده‌سازی در صفحه امن با رمز: نوشتن داده‌های کاری متوقف می‌شود و قبل از حذف نسخه پشتیبان ساخته می‌شود. مدیر فایل داده و فهرست پیوست‌ها را دریافت و بررسی می‌کند.',
 'اجرای نهایی فقط در صفحه امن با رمز، شناسه پیش‌نمایش، کد تأیید همان پیش‌نمایش و تأیید دریافت پشتیبان است. دستیار داخلی صرفاً وضعیت/پیش‌نمایش بدون رمز و مسیر صفحه را می‌دهد. ابزارهای نوشتنی MCP همان رمز و تأییدها را لازم دارند و فقط برای کلاینت امن مدیریتی‌اند؛ رمز نباید وارد متن مدل شود.',
 'پس از حذف، شروع اصلی قفل پاک‌سازی را برای این نصب می‌بندد. حساب‌ها باقی می‌مانند؛ نشست‌های رمزعبوری و جریان‌های MCP نیاز به اتصال مجدد دارند. داده نمونه آموزشی نمایشی بخشی از داده شرکت نیست.',
 'فایل‌های اصلی پیوست در فضای خصوصی سرور برای بازیابی حفظ می‌شوند؛ JSON دانلودشده شامل متن رکوردها و فهرست فایل‌هاست، نه بایت تمام پیوست‌ها. فایل‌های پشتیبان فقط توسط ادمین قابل دریافت‌اند. بازگردانی با همکار فنی و راهنمای نسخه انجام شود.'
];

// BOM imports use existing bom_versions, material flow_entities and inventory_operations;
// existing freeze triggers and catalog/full reset semantics apply without new tables.
