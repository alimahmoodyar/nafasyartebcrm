// Office reception, immutable estimate/workLog performer+recorder snapshots and permanent serial QR use existing as_case JSON, records and service_files/R2. Both reset scopes, existing backup ordering, resetFiles and generic 0016 freeze cover them; no new table/type/FK, migration or data-source split. Labels/read lookups never write.
// Driver pickupPackageReceipts is existing sale JSON, synchronized collectedDeviceIds/history is transport JSON; existing operational reset/backup and 0016 freeze cover both atomically, no new persistence.
// Finished shippingPackages/sender/recipient snapshots are sale JSON; package receipt history is transport JSON. Existing operational backup/delete and 0016 flow/inventory freeze cover them atomically. Product packageCapacity is catalog JSON preserved by operations reset. No new table/FK/blob.
// as_return_parcel is operational packaging/custody JSON linked to existing as_claim; both reset scopes back up/delete it and generic 0016 freeze guards atomic parcel/claim writes. as_return_destination is catalog contact configuration preserved in operations reset. Labels are generated read-only; no new table, FK or R2 object.
// representative_identity and representative_identity_file are preserved agency identity data in both reset scopes, like sales_agent/as_agent. Generic 0016 flow/inventory freeze protects every write. Private R2 originals are included by resetFiles in backup; no new table or FK.
// transport_receipt is operational flow_entities JSON: both scopes back up/delete receipt custody/history and as_case links. Generic 0016 flow/inventory freeze protects atomic writes. No new table, FK or R2 object; printing is read-only.
// Service bank claims reuse sales_payment with serviceDomain/serviceAgentId; receipts reuse sales_file. Journal entries use existing service_ledger. Existing operational reset/backup, private sales-files cleanup, FK-safe offsets-first deletion and generic freeze cover all of them; no new table or exemption.
// Payment requests, supplier credits/offsets, shipment manifests, receipt links, return movements and delivery decisions are JSON on existing purchase_payable, purchase_order and receipt entities. Existing operational backup/reset and freeze also cover linked files and inventory movements.
// Contractual delivery extension decisions and deadlines stay inside existing purchase_order JSON; backup, reset and 0016 freeze already cover them.
// CEO quote returns and order terms amendments use existing operational quote/order JSON; 0016 freeze and both backup/reset scopes cover them and their history.
// Shelving placementConfirmation is receipt JSON in flow_entities; existing
// operational backup/delete and 0016 freeze cover it and stock atomically.
// Receipt observation/note responses, shipment comparison and unverified delivery clue
// are operational receipt/receipt_observation JSON; inbox threads use existing cleanup.
// Staged/attached receipt_evidence manifests use flow_entities + R2; resetFiles includes
// all their blobs in backup/deletion for both scopes. Existing generic 0016 freeze
// guards receipt, evidence linkage, inbox and stock atomically. No new tables/FKs.
// Person-independent production_position, worker_buffer, worker_count_policy/round,
// worker_output/worker_finished_receipt/worker_nonconforming/worker_count, line_return,
// scrap_transfer/scrap_sale_request, project_final_bom, stock_discrepancy,
// inventory_count_policy/inventory_count/stocktake_authorization are operational
// flow_entities: both reset scopes back up/delete them. Worker/line transit, scrap,
// disputed and line_finished balances use existing inventory_* cleanup. Generic
// 0016 reset freeze guards their atomic writes; 0023 adds stocktake holds only,
// no new tables, FKs, blobs or preservation exemption. Role profile catalog is code.
// Approval inbox routing changes only existing duty_runs.data sourceSection/sourceId/history; sourcePlanId and workflow flags remain authoritative for deletion. Existing full-JSON backup/reset and duty freeze triggers cover routing updates; no new table/entity/FK/blob.
// Proforma quoteDate/validityDays/derived validUntil use existing sourcing_quote and order snapshots; existing backup/reset and 0016 freeze cover them. No new table/entity/blob.
// Day-based sourcing_quote/purchase_order deliveryDays, deliveryStart, requiredAdvanceRial, purchaseConfirmedAt/By/reference, deliveryStartedOn, immutable promisedEta and advanceEvidence remain in existing operational JSON. Tracking/task due changes append history. Both reset scopes/backup and migration 0016 flow/inventory freeze cover quote, confirmation, tasks and audit atomically; no new table/FK/blob. Legacy absolute-date orders are preserved.
// Additional supplier RFQs append snapshot entries to existing sourcing_plan.supplierTargets and create independent operational sourcing_quote JSON; old quotes/approvals stay unchanged. Existing scopes back up/delete both and their history/tasks, existing 0016 freeze guards atomic writes. No new table/FK/blob.
// Domestic freight terms remain in sourcing_quote/order snapshots; pickup evidence in immutable order history and actual freight resolution/expenses in purchase_settlement JSON. Existing backup/reset and 0016 freeze cover all atomically; no new entity/table/blob.
// Supplier deletion metadata and immutable lifecycleHistory remain in supplier flow_entities JSON; existing backup/reset and migration 0016 freeze cover archive/restore atomically. No physical deletion or new table.
// Empty warehouse deletion stores deletedAt/deletedBy/deletionOperationId in catalog material_warehouse JSON; IDs/names/history remain. Operations reset preserves tombstones and full reset backs up/deletes them. inventory_operations/access_audit record deletion; existing 0016 flow/inventory freeze guards parent+managed-quarantine+unlink writes. No new table/FK/blob.
// Project-material sourcing cases/source links, workOwners and order remainder/identity decisions use existing operational flow_entities JSON; holds transfer atomically to original projects. Existing reset scopes, backups and 0016 generic freeze cover these, their duties/notices and audit. No new table/FK/blob.

// Receiving permission/type and linked managed quarantine children live in catalog material_warehouse JSON: operations preserve both, full backs up/deletes both. Receipt policy/QC/location snapshots are operational receipt JSON in both scopes. Existing 0016 flow/inventory freeze guards the atomic parent/child definition and all ingress. No new table/FK/blob or data rewrite.
// Per-line procurement search/escalation/decision history remains operational sourcing_plan JSON; existing backups, both reset scopes and 0016 freeze cover it. No new table/FK/blob. Design edits still use existing technical controls; frozen serial BOMs are untouched.
// Pre-finance purchase-request deletion removes existing sourcing_plan/quotes/unissued orders and holds atomically, cancels (preserves) duty evidence, and retains access_audit/inventory_operations. Existing reset scopes and 0016 freeze cover every write; no new table, FK or blob.
// Manual warehouse supply requests, review/return/confirmation history and snapshots stay in operational sourcing_plan JSON. Both reset scopes back up/delete these and existing sourcing_holds/duty_runs. Generic 0016 flow/inventory freeze covers the atomic transaction; no new table, FK or blob.
// bom_effectivity stores execution policy/history in flow_entities: backed up and removed in both reset scopes. Generic 0016 flow/inventory freeze covers atomic writes; no new table, FK or blob. Existing builds and BOM snapshots are never rewritten.
// hr_employee.productionEligible is an audited operational profile flag. Both reset scopes back up/delete it with hr_employee under existing flow_entities freeze; no new table/FK/blob. Production-role defaults are derived from preserved accounts after reset.
// routine_plan and scheduled/cancelled routine_job live in operational flow_entities. Both reset scopes back up/delete them with routine_lot; generic 0016 freeze covers atomic plans, worker/QC audit and line inventory writes. No new table/FK/blob or preservation exemption.
// sale.sourceWarehouses is the dispatch-time origin snapshot in existing operational sale JSON;
// both reset scopes, backups and 0016 freeze already cover it, with no new table/FK.
// build_project request.planningClaims references the same project receipt/stock holds; existing operational JSON backup/reset/freeze and sourcing_holds child-first deletion cover both.
// Pending-QC receipt claims reuse sourcing_holds (source_type=receipt); existing backup, FK-safe deletion and real/training freeze triggers cover them in both reset scopes.
// Warehouse parentId/serviceDomain/serviceOwner live inside material_warehouse JSON.
// Existing catalog backup/preservation/full deletion and 0016 freeze cover them; no new table or FK.
// Compact receipt details and batch-filtered form archives are read-only views of existing records/snapshots. No new persistent data, files, tables or reset exemptions.
// warehouse_transfer, physical slot moves and build.warehouseId use existing flow_entities, flow_slots and inventory_* tables. Both reset scopes back up/delete transfers, in-transit balances and locations; generic 0016 freeze covers atomic writes. No new table/FK/blob. Catalog warehouses remain preserved in operations reset.
// Batch barcode/QR labels render existing records on demand. No saved image, print job, identity, balance, table or blob; reset/backup/freeze coverage is unchanged.
// warehouseResponsibilities are preserved account/profile assignments, referring to catalog warehouses.
// Role choices are derived from material_warehouse; old hidden owners are compatibility-only until profile save.
// Receipt QC selection/history is operational; both resets back it up/delete it. Existing generic 0016 freeze applies; no new tables/FKs.
// Document bindings stay in catalog qms_record (operations preserved, full deleted).
// Immutable form_record answer/code snapshots are operational in both resets;
// existing backup and migration 0016 flow_entities/inventory_operations freeze cover them atomically. No new tables/FKs/blobs.
// Physical material_warehouse definitions are catalog flow entities. Receipt warehouse snapshots and scoped slot keys use existing backup/reset/freeze tables (0016); no new table/FK/blob. Operations reset preserves definitions, full reset deletes them.
// Compact hospital coverage dates and per-device servicePlans are embedded in operational hospital_asset/hospital_job. Contract follow-ups are derived, their duty_runs use existing backup/delete/freeze; no new table, FK, blob or persistence exemption. Legacy catalogs and snapshots retain current reset policy.
// Contract-specific hospital warranty snapshots live in existing build_intake/build_project/hospital_asset entities; generic flow reset backup/delete/freeze covers them. Home product warranty unchanged, no new tables or FK.
// Manual installed equipment, warranty/contract snapshots and actual installed filter batch labels live in hospital_asset; shared filter technical codes remain hospital_service_kit. Existing reset scopes and generic flow freeze cover both. No new manufacturing records or inventory batches are fabricated.
// hospital_profile_template and hospital_service_kit are service catalogs: operations preserve them, full reset backs up/deletes them. Technical profile and immutable periodic quote snapshots remain in operational hospital_asset/hospital_job. Generic migration 0016 freezes all flow_entities mutations atomically; no new table/FK/blob.
// Bank and POS coverage use sales_bank_statement and sales_bank_pos_row; representative custody uses sales_custody_item and existing sales_bank_terminal and sales_agent rows. The existing flow_entities freeze covers all new data; resetFiles backs up and removes the private original workbooks in both reset scopes.
// Province/city and reciprocal representative links are embedded in preserved sales_agent/as_agent profiles; both reset scopes preserve and back them up together. Existing migration 0016 flow/inventory freeze protects atomic link and account writes; no new tables, blobs or migrations.
// Sales receiving accounts, terminals, statements and bank rows are operational flow entities. Both reset scopes delete them with sales payments; private statement originals are backed up/removed by resetFiles. Existing 0016 flow/inventory freeze makes reconciliation atomic during maintenance. Terminal links are removed when their receiving bank accounts are reset.
// Buyer-category discount, productPrices and fixed/promotion effective dates are embedded in versioned sales_template; quote/order/invoice price snapshots remain in existing sales_* flow_entities. Existing backup, reset predicates and migration 0016 flow freeze cover these JSON fields; no new tables or entity types.
// business_contract: operational flow entity, backed up and deleted in both reset scopes; migration 0016 freeze protects writes.
// New shipments reference sales_agent profiles directly; historical party rows remain covered by the existing reset scopes.
// Automatic representative identities use preserved app_members/password_accounts and as_agent/sales_agent; existing flow/inventory operation freeze triggers protect the atomic mutation. No new tables. Credential changes clear ciphertext and revoke sessions/tokens.
// Intake contact fields are embedded in as_case; existing backup, both reset scopes and flow freeze cover them.
// purchase_service is operational flow_entities data: both resets delete it; 0016 freezes it. Output files reuse payable_file backup/object cleanup; private design remains in qms_file under existing rules.
// Development test results, closure identity and attention flags remain embedded in preserved development_request; existing backup and 0016 freeze apply.
// CEO payment approval, decision and basis are embedded in treasury_request; existing flow_entities backup, both reset scopes and 0016 freeze cover them.
// Staff account base profiles are operational hr_employee flow_entities (no new table): both reset scopes back up/delete them; existing flow_entities freeze rolls back atomic account/profile creation during maintenance. Preserved accounts can explicitly recreate missing bases without invented employment data.
// Service part Excel imports use catalog material/as_tariff and inventory_operations.
// consumerPriceRial and estimate tariff snapshots are existing JSON fields.
// Operations reset preserves the definitions/prices; full reset backs up/deletes them.
// Migration 0016 flow/inventory freeze guards the whole import; no new tables or blobs.
export const resetScopes:Record<string,string>={operations:'پاک‌سازی سوابق و موجودی؛ حفظ تعاریف کالا',full:'پاک‌سازی سوابق، موجودی و تعاریف کالا'};
// build_intake, approval/specification versions and linked build_project are operational
// flow_entities: both scopes back up/delete them; generic 0016 freezes all mutations.
// Product customer-order templates remain qms_record catalogs; attachments reuse sales_file
// manifests and existing private storage. No new table/FK/blob type or migration is needed.
export const resetPreserved=['محیط آزمایش نقش‌ها (جدول‌های training_* و فایل‌های training/v1/) مستقل است و با پاک‌سازی شرکت تغییر نمی‌کند','عکس‌های پروفایل و اطلاعات تماس کاربران (همراه حساب‌ها حفظ می‌شوند)','حساب‌ها، هش و نسخه رمزگذاری‌شده رمز ورود، الزام تغییر رمز اولیه، دسترسی‌ها و سمت‌های کارکنان','هویت نماینده‌های فروش و شرایط پایه اعتباری و ارتباط حساب آن‌ها','هویت نماینده‌های خدمات و ارتباط آن‌ها با حساب کاربران','تنظیمات مدل‌ها، کلیدهای اتصال و هویت سامانه','درخواست‌های توسعه و نتیجه تست‌های ثبت‌شده در آن بخش','سوابق امنیتی و نسخه پشتیبان پاک‌سازی','شرح وظایف و الگوهای برنامه کاری؛ پس از پاک‌سازی غیرفعال می‌شوند'];
// Technical controls/history are embedded in catalog material and supplier_material;
// operations reset preserves them, full reset backs up/deletes them; 0016 freeze covers both.
export const resetCatalog=['قیمت‌های فروش نمایندگان','پرونده تأمین‌کنندگان، مدارک نسخه‌دار، اقدامات اصلاحی، ارتباط کالا و ارزیابی','محصولات و نسخه‌های نرم‌افزار دستگاه','تعاریف مواد اولیه، BOM و فرم‌های کنترل کیفیت','فرم مشخصات مدل دستگاه و فهرست فیلترهای سرویس کمپرسورها','ظرفیت تولید، گیرندگان فروش، تعرفه خدمات و خودروها'];
// Ordered children before parents. SQL identifiers and predicates are constant, never caller input.
export const resetTables:Record<string,string>={
 personal_reminders:'یادآورهای شخصی و اعلان‌های آن‌ها',llm_usage:'مصرف درخواست‌های مدل',assistant_actions:'فرمان‌های دستیار',assistant_turns:'گفت‌وگوهای دستیار',duty_files:'پیوست‌های وظایف',duty_notices:'اعلان‌های وظایف',duty_runs:'سوابق انجام وظایف',
 service_offsets:'تهاتر خدمات',service_reservations:'رزرو قطعات خدمات',service_files:'پیوست‌های خدمات',service_ledger:'گردش مالی خدمات',service_lots:'موجودی قطعات خدمات',service_activations:'فعال‌سازی گارانتی',sourcing_holds:'تخصیص‌های تأمین؛ قابل مصرف، منتظر کنترل و خرید باز',
 quality_files:'پیوست‌های کنترل کیفیت',quality_reports:'نتایج کنترل کیفیت',batch_files:'پیوست‌های بچ',finance_files:'فایل‌های کنترل مالی',finance_notes:'بررسی‌های مالی',
 production_materials:'مصرف مواد تولید',production_receipts:'رسید محصول',production_orders:'برگ‌های تولید',inventory_entries:'گردش انبار',inventory_balances:'موجودی انبار',inventory_batches:'بچ‌های انبار',flow_slots:'محل‌های دارای موجودی',
 serial_reservations:'سریال‌های رزروشده',serial_runs:'نوبت‌های چاپ سریال',inventory_operations:'عملیات کاری ثبت‌شده',quality_templates:'فرم‌های کنترل کیفیت',bom_versions:'نسخه‌های BOM',firmware_files:'فایل‌های نرم‌افزار دستگاه',flow_entities:'گردش‌های کاری و اطلاعات پایه',records:'سوابق دستگاه، کالا، بچ و خدمات'
};
// Member contacts are preserved account identity data, keyed by app_members.id.
// Existing 0016 generic flow_entities freeze protects their atomic writes; no new migration.
export const resetFlowPreserved=['representative_identity','representative_identity_file','hospital_center','account_profile','member_contact','position','duty_template','duty_catalog_install','transport_migration','development_request','as_agent','sales_agent'];
// material_photo is catalog data: active and removed originals/thumbnails survive operations reset with material; full reset backs up both object keys and deletes all photo rows. Generic 0016 flow/inventory freeze protects upload/removal; no new table/FK. Training uses existing flow and bucket isolation.
// Shared print layouts are configuration; existing flow_entities freeze and backup apply.
// Service representation contract versions and current pointers on as_agent: operations preserve catalog/history; full reset removes contracts and leaves explicit missing-reference state, never invents validity. Generic flow freeze covers atomic renewal/termination and warning closure; no new table/FK/blob.
// Service work timing, CEO labor policy and approval requests are versioned catalogs in flow_entities. Operations reset preserves them; full reset backs them up/deletes them. Approved credit snapshots remain on preserved as_agent. Existing 0016 freeze covers every write; no new table/FK/blob.
export const resetFlowCatalog=['as_return_destination','as_service_part_catalog','as_service_catalog_request','as_service_collection_policy','as_service_contract','as_service_work','as_service_labor_policy','as_commercial_request','label_template','material_file','material_photo','material_warehouse','hospital_profile_template','hospital_service_kit','pricing_cost','pricing_policy','pricing_approval','qms_record','qms_file','qms_part','purchase_specification','routine_route','routine_policy','semi_bom','cost_material','cost_standard','sales_price','sales_resource','supplier_document','supplier_capa','supplier','supplier_material','supplier_review','material','capacity','party','as_tariff','transport_vehicle'];
// Driver checklists, blockers and vehicle observations are embedded in operational
// transport entities: backup, both reset scopes and 0016 freeze cover them.
// Vehicle catalog stays preserved for operations-only reset. Browser drafts are local,
// account-scoped, expire after seven days, and are never company backup records.
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
// as_part_repair is operational in both scopes; generic 0016 flow_entities freeze,
// service_lots/ledger/inventory and duty_runs backup/delete order cover every stage.
// No new tables, FKs or file blobs; entrusted originals stay in the flow receipt.
export const resetHelp=['قطعات و قیمت مصرف‌کننده واردشده از اکسل: پاک‌سازی سوابق آن‌ها را حفظ می‌کند؛ پاک‌سازی کامل پس از پشتیبان‌گیری تعاریف و قیمت‌ها را حذف می‌کند. فایل‌ها و داده‌های آزمایشی از واقعی خودکار تفکیک نمی‌شوند.','قطعات تعمیری نمایندگان: رسید امانی، نتیجهٔ تعمیر، تصمیم گارانتی، هزینهٔ پذیرفته‌شده، ارسال و تأیید دریافت در هر دو محدوده پاک و پشتیبان‌گیری می‌شوند؛ موجودی جایگزین، گردش مالی و وظایف با جداول موجود و قفل پاک‌سازی پوشش دارند.','خزانه: حساب‌ها، درخواست‌ها، پرداخت و دریافت، چک‌ها، تنخواه، صورتحساب و تطبیق‌ها در هر دو محدوده پاک و پشتیبان‌گیری می‌شوند؛ مدارک خصوصی خزانه در فهرست فایل‌های پشتیبان هستند.','پروژه‌های ساخت، BOM اختصاصی، رزرو، مصرف، زمان، هزینه و گزارش‌ها در هر دو محدوده پاک و پشتیبان‌گیری می‌شوند. رزرو sourcing_holds و وظایف پیش از پروژه حذف می‌شوند؛ موجودی project نیز همراه گردش موجودی پاک می‌شود.','پرونده بدهی و پرداخت خرید، تخصیص‌ها، اقساط و سوابق تأیید در هر دو محدوده پاک و پشتیبان‌گیری می‌شوند؛ کارتابل‌ها قبل از پرونده حذف می‌شوند.','مدارک تشخیص هزینه و قواعد تأییدشده همراه عملیات در هر دو محدوده حذف و در پشتیبان ثبت می‌شوند.','تسویه خرید، مدارک، تخصیص مالی و تاریخچه تأییدها در هر دو محدوده با عملیات حذف می‌شوند؛ فایل‌ها در فهرست پشتیبان هستند. قیمت حاصل همراه cost_price حذف می‌شود.','مقایسه تعداد فاکتور و دریافت واقعی، تصویر تعداد سفارش و مغایرت‌های انبار همراه receipt در پشتیبان و هر دو محدوده پاک‌سازی و قفل flow_entities موجود پوشش دارند.','درخواست قطعه بیمارستانی، حواله، ارسال و رسید تکنسین همراه موجودی در انتظار ارسال، در راه و نزد تکنسین در هر دو محدوده حذف و در پشتیبان ثبت می‌شوند؛ قفل‌های موجود flow_entities و inventory_* تمام مراحل را پوشش می‌دهند. رسید تحویل به معنی مصرف یا سند مالی نیست.','تنخواه مأموریت: سیاست سقف‌ها و زنجیره تأیید، هزینه‌ها و مدارک در هر دو محدوده حذف و در پشتیبان منظور می‌شوند. جدول جدید ندارد؛ قفل عمومی flow_entities و ترتیب حذف وظایف و مدارک برقرار است.','قطعات مهم دستگاه بیمارستانی، قرائت‌های ساعت، تنظیمات و پیش‌بینی سرویس و پرونده‌های سرویس دوره‌ای در هر دو محدوده پاک‌سازی می‌شوند؛ در پشتیبان و قفل عمومی flow_entities پوشش دارند.','هویت مرکز بیمارستانی و حساب مسئول مرکز حفظ می‌شوند؛ دستگاه‌های متصل، مأموریت‌ها، پیش‌فاکتورها، فاکتورها، پرداخت‌ها، راهنماها، فرم‌ها و پاسخ‌های دستیار در هر دو محدوده پاک می‌شوند. پرونده و مدارک بیمارستانی در پشتیبان منظور می‌شوند.',
 'اهداف مصوب فروش، گزارش‌های مدیریتی، هشدارها، ارتباط وصول جایگزین چک و تنظیمات پایش در هر دو محدوده پاک می‌شوند؛ پس از پاک‌سازی باید هدف‌ها و قواعد بررسی شوند. هویت نماینده و مسئول‌های پرونده حفظ می‌شوند.',
 'پوزهای متصل به خریداران، گردش‌های واردشده بانک و تطبیق‌های وصول در هر دو پاک‌سازی حذف می‌شوند؛ فایل اصلی اکسل در پشتیبان است. پس از پاک‌سازی حساب‌ها و اتصال پوز دوباره تعریف می‌شوند.',
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
// Catalog-only material_import creates existing material flow_entities plus inventory_operations/access_audit.
// Operations reset preserves material passports; full reset backs up/deletes them. Existing 0016 freeze triggers
// cover the atomic import and its audit. No new table, FK, blob, stock or preservation exception.

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

// hr_* records are operational in both scopes; generic 0016 flow freeze applies.
// duty notices/runs precede HR records; immutable hr_file manifests participate in R2 backups.
resetHelp.push("پرونده پرسنلی، احکام، شیفت، درخواست‌ها، تردد، فیش و پرداخت پرسنلی و مدارک در هر دو محدوده پشتیبان و پاک می‌شوند؛ حساب کاربران و دسترسی‌ها حفظ می‌شوند. وظایف پیش از پرونده‌ها حذف می‌شوند.");

// sales_template/contact/case/contract/commission_settlement: operational in both reset scopes; generic 0016 flow freeze and backup apply, no new FKs/blobs.
resetHelp.push('الگوهای فروش، تماس و همکاری، قرارداد و تسویه پورسانت در هر دو محدوده پشتیبان و حذف می‌شوند؛ هویت و مسئول شریک فروش حفظ می‌شود.');

resetHelp.push('چک‌لیست راننده، موانع و موعد پیگیری و گزارش‌های خودرو داخل مأموریت حمل در هر دو محدوده پشتیبان و حذف می‌شوند و قفل عمومی عملیات را دارند؛ مشخصات خودرو در پاک‌سازی عملیات حفظ می‌شود. پیش‌نویس‌های مرورگر جدا از پشتیبان سرورند و پس از هفت روز منقضی می‌شوند.');

// Advance requestMonth/limitAssessment are embedded in hr_request: generic 0016 freeze, existing backup and both reset scopes apply; no new table or FK.

// purchase_shipment/shipment_file: operational flow records, generic 0016 freeze and backups; no new FKs. purchase_specification retained with catalogs in operations reset.
resetHelp.push('مشخصات نسخه‌دار کالا و تأمین‌کننده همراه تعاریف حفظ می‌شوند؛ محموله، پکینگ، ثبت سفارش و اصلاحات و مدارک خصوصی در هر دو محدوده پشتیبان و حذف می‌شوند.');

// QMS product records, immutable forms, files and chunks are one retained catalog in operations reset. Full reset backs up all three and removes them together. Generic 0016 flow_entities freeze covers all writes; no new FKs.
resetHelp.push("پرونده‌های کیفیت و طراحی، نسخه‌های فرم و قطعه‌های فایل در پاک‌سازی عملیات حفظ می‌شوند؛ پاک‌سازی کامل همه را با فهرست قطعه‌های فایل پشتیبان می‌گیرد. پشتیبان محرمانه فقط با نقش صریح طراحی قابل دریافت است.");

// foreign_selection/file/statement/statement_row and foreign shipment stages are operational flow_entities. Generic 0016 freeze and both reset scopes cover all; duty children first, private foreign_file manifests backed up. No new schema/FKs.
resetHelp.push('انتخاب منبع خارجی، نمونه، مراحل ارز، اکسل صراف، رفع تعهد و خرید و حمل در هر دو محدوده پشتیبان و حذف می‌شوند؛ سمت مدیر بازرگانی و حساب‌ها حفظ می‌شوند.');

// Activation-code audit uses inventory_operations: existing 0016 freeze triggers, backup and deletion ordering apply.
resetHelp.push('سوابق تولید دستی کد پنج‌رقمی همراه inventory_operations در هر دو محدوده پشتیبان‌گیری و حذف می‌شوند؛ حساب‌ها و دسترسی کاربران حفظ می‌شوند.');

// asset_item, asset_clearance, asset_confirmation and asset_file are operational flow_entities.
// Both reset scopes include them; existing 0016 freeze triggers and generic backups apply.
// asset_file is included in private R2 backup manifests; duty children are removed first.
// The asset-custodian position is preserved with other positions, with members/permissions unchanged.

// Invoice type, uploaded-document links and manual taxpayer tracking live in purchase_payable; follow-ups use duty_runs/notices. Existing 0016 freezes and child-first reset order cover all changes.
resetHelp.push('نوع رسمی یا غیررسمی، سند متصل و سابقه پیگیری مؤدیان همراه پرونده خرید در هر دو محدوده پشتیبان‌گیری و حذف می‌شوند؛ اعلان‌ها و وظایف هفت‌روزه قبل از پرونده حذف می‌شوند.');

// treasury_* entities and treasury_file use flow_entities: 0016 generic freeze, both reset scopes and backup include every request, movement, match and document.

// personal_reminders: private owner-facing reminders and captured event facts; both reset scopes, backup and 0020 maintenance freeze apply. No new foreign keys.

// Test profile messages use reserved sender/recipient addresses in the existing inbox entities.
// Both reset scopes and backups include them, and generic 0016 freeze triggers also protect their attachments.

// Scheduled delegation configuration is in personal_reminders; resulting inbox_thread/message/state are operational flow_entities. Existing 0020/0016 freeze and both reset backups/deletions cover them; no new table or migration.

// Job-role assignments are embedded in preserved app_members.permissions; no new table or reset deletion is introduced.
// Service diagnosis traceStatus is embedded in as_case data; existing full-JSON backup, reset scope and freeze rules cover it without a new table.

// sales_payment staff_entry attribution is embedded in the existing operational entity;
// both reset scopes, backup and generic 0016 freeze apply. No new table, FK or file type.
// Pricing cost/policy/approval snapshots are price catalogs preserved with sales_price
// by operations reset; full reset removes all four. Generic 0016 flow freeze and
// full flow_entities backups cover these types; no new table, FK or file blob.

resetHelp.push("فرم‌های مشخصات سفارش مشتری، نسخه‌های تأیید و اتصال قرارداد و پروژه در هر دو محدوده پشتیبان‌گیری و حذف می‌شوند؛ الگوهای مصوب محصول در پاک‌سازی عملیات حفظ می‌شوند. پیوست‌های سفارش از مدارک خصوصی فروش در پشتیبان هستند.");
resetHelp.push('راهنماهای عیب‌یابی محصول، تاریخچه تأیید و دفترچه‌های پیوست‌شده بخشی از پرونده‌های کیفیت‌اند؛ در پاک‌سازی عملیات حفظ و در پاک‌سازی کامل با فهرست قطعه‌های فایل پشتیبان‌گیری و حذف می‌شوند.');

// material_file technical drawings/documents share material catalog preservation with material_photo. Full reset includes active/removed private objects; generic 0016 flow/inventory freeze and existing training wrappers apply. No new tables/FKs.

// Shared production work-study extends routine_route (catalog) with productId/crewSize.
// Reviewed final schedules/worker identities are embedded in operational plan/build;
// generic flow_entities freeze, all-row backup and both resets already include them.
// No new table, FK or blob. Operations reset preserves work-study/time/label catalogs.

// Receipt purchase completion/resolution, registeredBy/time and resulting inbox closure
// remain inside receipt/receipt_observation/inbox flow_entities and records payloads.
// No new tables/blobs: existing full flow backup, delete order and reset freeze apply.

// Incoming identity correction history and relabel confirmations remain in receipt JSON,
// the existing records/inventory_batches rows, form archive and existing inbox cases.
// Full backups, existing delete order and generic reset freeze cover all of them.

// Receipt qcStartedAt/By, editRequests and extended identityHistory use existing operational receipt JSON.
// Both scopes back up/delete these with receipt observations/inbox, stock, forms and audit.
// Existing 0016 flow/inventory freeze protects atomic edits; no new schema, files or reset category.

// Exact-master receipt template synchronization uses existing operational receipt JSON,
// inventory_operations and access_audit. Both reset scopes cover these; existing 0016
// freeze prevents partial activation. Read filters/history and catalog storage events add no business table or blob.
// Versioned sales returns and replacement sales use existing flow_entities; both reset scopes back up and delete them. Existing freeze guards cover duties, inventory and sales-file waybills.

// hospital_gas_survey uses operational flow_entities. Both scopes back up/delete questionnaires; 0016 freezes all create, revoke and answer writes. No new tables, files or foreign keys.

// Sales calls use existing sales_contact and sales_call_policy records and duty_runs.

// Passkey credentials/challenges are authentication infrastructure preserved with app_members/password_accounts by both business reset scopes. No business-reset freeze applies, like password sessions; account deletion cascades credentials and expired challenges are purged on issuance. Account-version changes invalidate old keys.

// Service role preview uses existing training_* tables and training R2 prefix, preserved by both company reset scopes. No new account/person binding, schema or company-data fixture is created.
