export const resetScopes:Record<string,string>={operations:'پاک‌سازی سوابق و موجودی؛ حفظ تعاریف کالا',full:'پاک‌سازی سوابق، موجودی و تعاریف کالا'};
export const resetPreserved=['محیط آزمایش نقش‌ها (جدول‌های training_* و فایل‌های training/v1/) مستقل است و با پاک‌سازی شرکت تغییر نمی‌کند','عکس‌های پروفایل کاربران (همراه حساب‌ها حفظ می‌شوند)','حساب‌ها، هش و نسخه رمزگذاری‌شده رمز ورود، الزام تغییر رمز اولیه، دسترسی‌ها و سمت‌های کارکنان','هویت نماینده‌های فروش و شرایط پایه اعتباری و ارتباط حساب آن‌ها','هویت نماینده‌های خدمات و ارتباط آن‌ها با حساب کاربران','تنظیمات مدل‌ها، کلیدهای اتصال و هویت سامانه','درخواست‌های توسعه و نتیجه تست‌های ثبت‌شده در آن بخش','سوابق امنیتی و نسخه پشتیبان پاک‌سازی','شرح وظایف و الگوهای برنامه کاری؛ پس از پاک‌سازی غیرفعال می‌شوند'];
export const resetCatalog=['قیمت‌های فروش نمایندگان','پرونده تأمین‌کنندگان، مدارک نسخه‌دار، اقدامات اصلاحی، ارتباط کالا و ارزیابی','محصولات و نسخه‌های نرم‌افزار دستگاه','تعاریف مواد اولیه، BOM و فرم‌های کنترل کیفیت','ظرفیت تولید، گیرندگان فروش، تعرفه خدمات و خودروها'];
// Ordered children before parents. SQL identifiers and predicates are constant, never caller input.
export const resetTables:Record<string,string>={
 llm_usage:'مصرف درخواست‌های مدل',assistant_actions:'فرمان‌های دستیار',assistant_turns:'گفت‌وگوهای دستیار',duty_files:'پیوست‌های وظایف',duty_notices:'اعلان‌های وظایف',duty_runs:'سوابق انجام وظایف',
 service_offsets:'تهاتر خدمات',service_reservations:'رزرو قطعات خدمات',service_files:'پیوست‌های خدمات',service_ledger:'گردش مالی خدمات',service_lots:'موجودی قطعات خدمات',service_activations:'فعال‌سازی گارانتی',sourcing_holds:'تخصیص‌های تأمین',
 quality_files:'پیوست‌های کنترل کیفیت',quality_reports:'نتایج کنترل کیفیت',batch_files:'پیوست‌های بچ',finance_files:'فایل‌های کنترل مالی',finance_notes:'بررسی‌های مالی',
 production_materials:'مصرف مواد تولید',production_receipts:'رسید محصول',production_orders:'برگ‌های تولید',inventory_entries:'گردش انبار',inventory_balances:'موجودی انبار',inventory_batches:'بچ‌های انبار',flow_slots:'محل‌های دارای موجودی',
 serial_reservations:'سریال‌های رزروشده',serial_runs:'نوبت‌های چاپ سریال',inventory_operations:'عملیات کاری ثبت‌شده',quality_templates:'فرم‌های کنترل کیفیت',bom_versions:'نسخه‌های BOM',firmware_files:'فایل‌های نرم‌افزار دستگاه',flow_entities:'گردش‌های کاری و اطلاعات پایه',records:'سوابق دستگاه، کالا، بچ و خدمات'
};
export const resetFlowPreserved=['hospital_center','account_profile','position','duty_template','duty_catalog_install','transport_migration','development_request','as_agent','sales_agent'];
export const resetFlowCatalog=['routine_route','routine_policy','cost_material','cost_standard','sales_price','supplier_document','supplier_capa','supplier','supplier_material','supplier_review','material','capacity','party','as_tariff','transport_vehicle'];
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
// Supplier documents and CAPA (including receipt snapshots) are catalog data; full reset includes file manifests.
// Supplier entities use the generic flow_entities freeze triggers from migration 0016.
export const resetHelp=['پروژه‌های ساخت، BOM اختصاصی، رزرو، مصرف، زمان، هزینه و گزارش‌ها در هر دو محدوده پاک و پشتیبان‌گیری می‌شوند. رزرو sourcing_holds و وظایف پیش از پروژه حذف می‌شوند؛ موجودی project نیز همراه گردش موجودی پاک می‌شود.','پرونده بدهی و پرداخت خرید، تخصیص‌ها، اقساط و سوابق تأیید در هر دو محدوده پاک و پشتیبان‌گیری می‌شوند؛ کارتابل‌ها قبل از پرونده حذف می‌شوند.','مدارک تشخیص هزینه و قواعد تأییدشده همراه عملیات در هر دو محدوده حذف و در پشتیبان ثبت می‌شوند.','تسویه خرید، مدارک، تخصیص مالی و تاریخچه تأییدها در هر دو محدوده با عملیات حذف می‌شوند؛ فایل‌ها در فهرست پشتیبان هستند. قیمت حاصل همراه cost_price حذف می‌شود.','مقایسه تعداد فاکتور و دریافت واقعی، تصویر تعداد سفارش و مغایرت‌های انبار همراه receipt در پشتیبان و هر دو محدوده پاک‌سازی و قفل flow_entities موجود پوشش دارند.','درخواست قطعه بیمارستانی، حواله، ارسال و رسید تکنسین همراه موجودی در انتظار ارسال، در راه و نزد تکنسین در هر دو محدوده حذف و در پشتیبان ثبت می‌شوند؛ قفل‌های موجود flow_entities و inventory_* تمام مراحل را پوشش می‌دهند. رسید تحویل به معنی مصرف یا سند مالی نیست.','تنخواه مأموریت: سیاست سقف‌ها و زنجیره تأیید، هزینه‌ها و مدارک در هر دو محدوده حذف و در پشتیبان منظور می‌شوند. جدول جدید ندارد؛ قفل عمومی flow_entities و ترتیب حذف وظایف و مدارک برقرار است.','قطعات مهم دستگاه بیمارستانی، قرائت‌های ساعت، تنظیمات و پیش‌بینی سرویس و پرونده‌های سرویس دوره‌ای در هر دو محدوده پاک‌سازی می‌شوند؛ در پشتیبان و قفل عمومی flow_entities پوشش دارند.','هویت مرکز بیمارستانی و حساب مسئول مرکز حفظ می‌شوند؛ دستگاه‌های متصل، مأموریت‌ها، پیش‌فاکتورها، فاکتورها، پرداخت‌ها، راهنماها، فرم‌ها و پاسخ‌های دستیار در هر دو محدوده پاک می‌شوند. پرونده و مدارک بیمارستانی در پشتیبان منظور می‌شوند.',
 'اهداف مصوب فروش، گزارش‌های مدیریتی، هشدارها، ارتباط وصول جایگزین چک و تنظیمات پایش در هر دو محدوده پاک می‌شوند؛ پس از پاک‌سازی باید هدف‌ها و قواعد بررسی شوند. هویت نماینده و مسئول‌های پرونده حفظ می‌شوند.',
 'هویت نماینده فروش و حساب ورود و شرایط پایه او حفظ می‌شود. سفارش‌ها، فاکتورها، پرداخت‌ها، تخصیص‌ها، برگشتی‌ها، افتتاحیه و تارگت‌ها در هر دو محدوده پاک می‌شوند؛ قیمت‌های فروش فقط در پاک‌سازی کامل حذف می‌شوند. فایل رسیدها در فهرست پشتیبان هستند. ارتباط گیرنده ارسال در اولین حواله جدید بازسازی می‌شود.',
 'پاک‌سازی عملیات، تأمین‌کنندگان و ارزیابی‌های مستند را حفظ می‌کند؛ شاخص‌های جاری با حذف رسید و سفارش از نو محاسبه می‌شوند. پاک‌سازی کامل این تعاریف و ارزیابی‌ها را هم حذف می‌کند.',
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

// sales_* flow entities use the generic freeze triggers (0016); sales_file is included in reset file manifests. No separate ledger tables.

// Sales delegation: managerId remains in preserved sales_agent; submission metadata, transport receipt evidence and task supervisors follow existing operational rows and private transport_file manifests. Generic 0016 freeze triggers cover all writes; no new table or delete ordering.

// sales_goal, sales_alert, sales_report, sales_check_recovery, sales_monitor_policy and workflow_health use existing operational flow_entities. duty_runs/notices remain children-first. Generic 0016 freeze covers every new write; neither reset scope preserves these operational snapshots. No new schema or R2 data.

// Isolated training_* schema (0018) is explicitly preserved by both company reset scopes.
// No training table has a foreign key to a company table; training file keys are separately prefixed.
// Company reset freeze triggers remain limited to company operations by design.

// expense_policy, expense_claim and expense_file use flow_entities; generic 0016 freeze triggers cover every write. No new tables/FKs. expense_file manifests included in system-reset. Training isolated by existing wrappers.

// Dedicated technician training fixtures use only training_* tables; existing company reset preservation is unchanged. Presets use existing app_members permissions, no schema changes.

// Costing uses flow_entities only. Existing 0016 freeze triggers and backup apply to all cost_* types.
// cost_material/cost_standard are catalog preserved by operational reset with BOM/materials.
// cost_price/time/period/close and cost operations/audit reset with production; no new FKs or file manifests.

// purchase_settlement/settlement_file use generic flow_entities freeze triggers (0016), no new table or FK. Both reset scopes remove them with operational cost_price; file manifest includes settlement_file. Training wrappers isolate tables and R2 keys.

// expense_register and expense_rule are operational flow_entities; both reset scopes, generic 0016 freeze triggers, backup and training isolation apply. No new FKs or file blobs.

// purchase_payable uses existing flow_entities: generic 0016 freeze, both reset scopes and backup apply. No new FK/table/blob. duty_runs remains children-first; training wrappers isolate storage.

// payable_file immutable R2 manifests are included by system-reset; generic flow freeze and both reset scopes apply.

// build_project uses generic flow_entities freeze (0016), operational reset in both scopes and backups. sourcing_holds FK child deleted first; project:* balances/entries follow existing inventory reset. No new tables or blobs.

// routine_route/policy are versioned catalogs, retained by operations reset; full reset removes them.
// routine_lot/job and cost_price are operational: generic 0016 freeze, backup and reset apply.
// Output uses existing records, receipt and inventory tables, children-first reset order unchanged. Training is explicitly blocked.

// llm_usage: numeric metadata only; included in both reset backups/deletions, no FKs. Migration adds maintenance freeze triggers. Training is explicitly blocked.

// bank_guarantee and guarantee_file are operational in both scopes, covered by flow freeze.
resetHelp.push("پرونده‌های ضمانت‌نامه، تاریخچه تأیید، تمدید و استرداد و مدارک در هر دو محدوده پشتیبان و حذف می‌شوند؛ وظایف قبل از پرونده حذف می‌شوند و جایگاه‌های سازمانی حفظ می‌شوند.");

// sales_lead is operational in both scopes. Generic 0016 flow freeze applies; no new tables.
resetHelp.push("سرنخ‌ها، فرصت‌های فروش، تماس‌ها و سوابق ارجاع و تبدیل به سفارش در هر دو محدوده پشتیبان و حذف می‌شوند؛ اعلان‌ها و وظایف قبل از پرونده‌ها حذف می‌شوند. حساب‌ها و سمت‌های فروش حفظ می‌شوند.");
