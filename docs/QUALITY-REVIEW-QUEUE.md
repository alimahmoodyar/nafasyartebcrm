## 2026-11-12 — Remove driver entry mission gate

- Scope: role-testing-panel navigation/text and local camera test only. No backend authorization, mission visibility or posting changes; selecting an actual review mission remains scoped.
- PASS: role-cartable-ui.cjs verifies direct driver role entry via POST with no mission selector, missionless camera test result without requests, and required actual mission when explicitly opening scoped review. Existing role/cartable/navigation cases remain passing. TypeScript/build/source/live proof recorded with release.
- No mission or other application data was created for camera testing. Physical phone camera testing is still not claimed.

## 2026-11-12 — Transport phone scanner

- Scope: shared camera code scanner, transport-only camera action on existing carton selection, other mission-item matching, authorized batch alias reads and confirmed-operation scan history. New dependency @zxing/browser 0.2.1 is exact-pinned with the pnpm lockfile; decoder import is deferred until a user click. No new table, inventory formula, automatic confirmation or parallel workflow.
- PASS: transport-scanner.cjs decodes an actual generated Persian QR snapshot and Code 128 image, and checks code matching/ambiguity, duplicate frames, click-only camera access, permission refusal, hidden-page/late-permission cleanup. mission-scan-ui.cjs checks manual/camera selection, deduplication, ambiguity/foreign rejection, no automatic submit, and original serial selection.
- PASS: transport.cjs adds invalid/duplicate/stage-inconsistent scan rollback, authorized batch alias verification and recorded scan history to existing driver/agent isolation, inventory, idempotency and MCP tests; transport-unified.cjs remains passing. TypeScript/build and full source/native publication verification recorded with release.
- Batch alias reads are restricted to IDs already in the authorized mission and batched in two bounded queries. Scan quantities come from the mission; repeated product/batch scans are never treated as counted units. No application records were changed by these isolated SQLite and component tests.
- Limits: no physical phone camera/touch/browser validation claimed. Initial decoder download needs connectivity; the existing manual input and explicit local draft workflow remain. Non-serialized scan evidence is optional and is not proof of physical inspection. Pre-existing unbounded transport mission/source lists are unchanged and remain scaling debt.

## 2026-11-12 — Receipt photo crop and confirmation

- Scope: shared camera/editor UI for both sales and service payment forms. No new business API/MCP capability; the existing upload and payment handlers retain all authorization and financial rules.
- PASS: receipt-photo-editor.cjs covers free-crop bounds with extreme movement, source-pixel export, rotated dimensions, zoom independent of crop pixels, pointer and keyboard handles, explicit confirm, retake/cancel and late export after unmount. receipt-camera.cjs verifies no attachment before confirmation and preservation of an existing receipt on cancel, plus media lifecycle checks.
- PASS: service-payments-ui.cjs and sales-role-navigation-ui.cjs verify submit controls/handlers issue no payment request while editing. TypeScript/build and full Git-tree/native publication evidence recorded with release.
- Limits: physical touchscreen/camera/browser rendering are not proven by mocked component tests. Preview zoom is for precise framing, not upscaling the exported image; working images cap the longest edge at 4096 pixels and JPEGs at 10 MiB. No business records were changed for this feature.

## 2026-11-12 — Shared receipt camera in sales bank payments

- Scope: replace sales capture-hint picker with ReceiptAttachment; extend that component with optional PDF selection while leaving service receipt selection image-only. No new business capability or MCP/API change.
- PASS: receipt-camera.cjs (permission/capture/cleanup plus PDF selection without image rendering), sales-role-navigation-ui.cjs (actual payment form uses camera component and retains PDF), service-payments-ui.cjs (existing service integration). TypeScript/build and full source/publication proof recorded with release.
- Physical camera/device permissions remain unverified by mocked tests. Existing sales receipt size and server validation stay unchanged.

## 2026-11-12 — Receipt camera instead of file-picker capture hint

- Scope: service-payment attachment UI only, with live video, JPEG capture, preview URL lifecycle and separate file selection. Existing upload authorization and payment handler unchanged; no new business MCP capability needed.
- PASS: receipt-camera.cjs mocked media API covers click-only access request, rear-camera preference/no audio, capture, preview, denied permissions, late request cancellation, page hiding, unmount cleanup and disabled state; service-payments-ui.cjs confirms attachment component integration. TypeScript and publication evidence are recorded with release.
- Physical device/browser permission and camera hardware are not validated by mocked component tests. Browser permissions may already be remembered or blocked by embedding policy; errors remain visible and file selection remains available separately.

## 2026-11-12 — Finance navigation, history filters and rejected-deposit deletion

- Scope: financial home with open pending-bank list, new/history navigation, combined server-side search/filter/count/page, and audited rejected-only deletion. UI, HTTP and MCP share domain handlers.
- PASS: service-payments.cjs covers cross-agent scope, filtering before pagination, literal wildcard/injection input, combined date/amount/account filters, derived waiting/review classifications including ready bank evidence, invalid filters, delete permission/state/revision, concurrent rollback, retry idempotency, audit retention and unchanged account balance; existing bank import/reversal cases remain passing. UI/dashboard tests cover navigation and search controls plus prior draft lifecycle/permission cases.
- TypeScript/build and full Git-tree/native live-version publication checks recorded with release evidence. No application records entered/deleted during implementation; isolated SQLite test fixtures only. Component tests do not claim browser rendering.
- Pre-existing scaling debt: bankEntities still loads the bank evidence collection for matching/review metadata. New payment rows/counts are SQL-filtered and bounded, but broad-volume performance of the existing bank matcher has not been measured or guaranteed. Account filter choices currently use assigned approved receiving accounts.

## 2026-11-12 — Service-home tracking summary removal

- Scope: remove the repeated home-page tracking summary and its unused presentation-only list/status mapping. Preserve the existing cartable action, payment schedule, payment history and ledger.
- Verification: existing service-dashboard.cjs navigation and financial presentation test; publication/source comparison recorded separately. No new business operations or persistence.

## 2026-11-12 — Populated material catalog / absent agency regression

- Confirmed cause: orderableCodes dereferenced agent.data when an administrator's unassigned service profile read a nonempty shared material catalog. Before the fix, the new API regression returned 503 with the same service-unavailable message as online.
- Fixed only the absent-agency eligibility calculation: no allowed product codes, no data writes or parallel storage. Existing role, domain, ordinary-account denial and financial/stock guards remain active.
- PASS: service-role-preview.cjs with the new material-present/agency-absent read and the existing full shared catalog/BOM/order/receipt/QC chain. TypeScript --noEmit PASS after the final API error-text change; publication evidence is recorded separately.
- Earlier v247 tests covered empty tables and a fully configured agency, but missed this intermediate state. Do not treat prior checks as proof of this case.

## 2026-11-12 — Representative profile without a shared agency

- Confirmed online alerts from account, commercial, contract and payment reads against the unassigned administrator role marker. This was a regression from the preceding shared-data release; the previous full chain test began with an actual agency and missed the empty starting state.
- Added six empty-workspace GET regression cases and ordinary missing-agency denials. No fake agency, ledger, bank account or stock is created, and write checks remain unchanged.
- PASS: shared-role workflow test including empty reads/no implicit data writes and regular-account denials; service dashboard test; service bank/payment matching and reversal test. TypeScript --noEmit PASS.
- Remaining online proof: the same administrator role opens without those alerts, parts/report/contract/payment pages open in their normal empty state, and a subsequent agency entered through its owning form binds to the same shared records. Earlier pending receipt outcome remains unknown and must be read before any retry.
- Terminology correction: the owner meant the existing central/reference warehouse («انبار مرجع»), not a warehouse named after Parand. Reuse the existing warehouse shown in the application.

## 2026-11-12 — Shared service walkthrough correction

- Replaces the earlier assumption that service-role walkthroughs must use isolated training storage. The owner confirmed all current application records are pre-production test data and specifically requested existing central Parand stock/workflows.
- Removed implicit service-role seed/database redirection and the separate setup UI. Existing isolated records are left untouched; records required for the shared walkthrough must be entered through owning forms, not copied with SQL or an API shortcut.
- PASS: automated shared warehouse/catalog/product/BOM/representative/eligibility/catalog approval/credit/price/order/receipt/QC chain, shared bank role visibility and denial tests; service-payment matching, duplicate/reversal tests; role cartable UI. TypeScript --noEmit PASS.
- Online evidence still pending: open Parand warehouse, inspect shared records, then execute receiving/exit/repair/payment through forms. Prior isolated balances do not establish any shared-system balance.
- Admin role-preview approvals remain actions of the actual administrator; not evidence that separately assigned personnel approved.
- No data deletion, reset, schema migration or automatic transfer between datasets is authorized by this correction.

# صف بازبینی کیفیت

## وضعیت مبنا

- آخرین انتشار تأییدشده: نسخه ۲۳۸، پوش گیت‌هاب `b0f2815031db0ebb2fa2331909c7116d43f8a1c0`؛ برابری تمام ۱۰۶۸ فایل با منبع انتشار تأیید شد.
- این انتشار مبنای عملکرد تأییدشده نیست؛ آزمون بار سازمانی و بازیابی جامع انجام نشده است.
- ایراد گزارش‌شده بازنشدن سایت هنوز علت قطعی ندارد؛ موفقیت انتشار به معنی تأیید دسترسی از مرورگر مالک نیست.

## موارد شناسایی‌شده برای بررسی

| اولویت | مورد | شواهد اولیه | اقدام بعدی |
| --- | --- | --- | --- |
| بالا | خواندن کامل تاریخچه در خدمات | `lib/after-sales.ts`: تابع `list` تمام رکوردهای یک نوع را می‌خواند؛ `ledger` گردش و تهاترها را کامل بارگذاری می‌کند؛ همگام‌سازی کارها چند فهرست کامل می‌خواند. | اندازه‌گیری مسیرهای پرتکرار با داده ساختگی؛ طراحی فیلتر/صفحه‌بندی و تجمیع سمت SQL با حفظ نتیجه حساب |
| بالا | ظرفیت پایگاه اصلی | پیکربندی فعلی D1؛ حجم هدف و کاربران هم‌زمان مشخص نیست. | تعیین بار هدف و ارزیابی ادامه D1 یا پایگاه مناسب‌تر؛ هنوز تصمیم یا مهاجرتی انجام نشده |
| بالا | بازیابی و پایداری | شواهد آزمون جامع بازیابی در این بازبینی جمع‌آوری نشده است. | فهرست پشتیبان‌ها و آزمون بازیابی در محیط جدا، بدون تغییر داده شرکت |

## بسته فعلی

- ثبت قواعد کیفیت و روش دستی آخر وقت در راهنمای مخزن؛ فقط مستندات تغییر کرده است.
- بررسی سند و اختلاف گیت کافی است؛ آزمون اجرایی برای این تغییر مستنداتی لازم نیست.
- بررسی سنگین، اصلاح کد عملکردی و مهاجرت پایگاه داده با این ثبت انجام نشده‌اند.
- عبارت «می‌خوام بخوابم» هنگام پایان کار، دستور شروع بازبینی است؛ پس از ثبت گزارش، فعالیت متوقف می‌شود. این دستور دائمی ثبت شده ولی گفت‌وگوی فعلی درباره تعریف آن، بازبینی را شروع نمی‌کند.


## اصلاح در حال طراحی — ریز سررسید نماینده خدمات خانگی

- هوم: مانده حساب و اعتبار باقی بماند؛ ریز هر سفارش/محموله با سررسید، روزشمار و خط زمان جای کارت مبلغ تجمیعی قابل پرداخت را بگیرد.
- ترتیب مصوب: سررسیدگذشته‌ها، سپس سررسیدهای آینده از نزدیک به دور.
- عنوان مصوب ستون: «پرداخت‌ها و مبالغ کسرشده» به‌جای «تسویه / بستانکاری»؛ فقط پرداخت‌ها و بستانکاری‌های ثبت‌شده و معتبر در محاسبه اثر دارند.
- یادآوری داخل سامانه از هفت روز مانده، با شناسه پایدار و به‌روزرسانی همان کار؛ بسته‌شدن پس از رفع واقعی مانده. اجرا وابسته به زمان‌بند موجود است.
- بخشی از منطق برنامه پرداخت و مسیر API/MCP و همگام‌سازی وظایف به‌صورت محلی تغییر کرده، ولی هنوز آزمون و تکمیل نشده است. هیچ انتشار یا پوش برای این تغییر انجام نشده.
- مالک تصویر اصلاح‌شده، آیکون رسید واریز، نوار اعتبار و امتداد قرمز پس از سررسید را تأیید کرد و سپس اجرا، آزمون، کامیت، پوش و انتشار را صریحاً خواست.

- منطق واریزی فروش برای خدمات با دفتر مالی جدا و گزارش هوم پیاده شد؛ شواهد بررسی محدود به این بسته در `quality-reviews/2026-11-12-service-payments.md` ثبت شده است. وضعیت انتشار مستقل از آزمون اعلام می‌شود.

## بسته بعدی رابط سفارش قطعه — فعلاً اجرا/پوش/انتشار نشود

- مالک اصلاح مسیر را تأیید کرد، ولی خواست برای اجرای یک‌جا نگه داشته شود: «خانه ← نماینده خدمات پس از فروش خانگی ← سفارش قطعه»، عنوان صفحه فقط «سفارش قطعه» و بخش‌های قبلی مسیر قابل برگشت.
- مشکل بعدی گزارش‌شده: هم‌تراز نبودن کادر و دکمه جست‌وجوی قطعه.
- پیشنهاد در انتظار نظر مالک: نوار جست‌وجوی یکپارچه و تمام‌عرض با ذره‌بین، راهنمای «نام یا کد قطعه را وارد کنید»، دکمه جست‌وجوی هم‌ارتفاع در انتهای همان نوار، پاک‌کردن متن و پشتیبانی Enter؛ روی موبایل بدون خروج از عرض صفحه. منطق مجوز قطعه حفظ شود و برای هر کلید، درخواست جدید بانک داده ارسال نشود.
- این بخش فقط ثبت خواسته و پیشنهاد است؛ کد رابط تغییر نکرده و برای این بسته پوش/انتشار انجام نشده است.

- ساده‌سازی جست‌وجو: دکمه مستقل پاک‌کردن ضروری نیست؛ در طرح نوار جست‌وجو اضافه نشود.
- پیام نتیجه خالی برای نماینده نباید راهنمای داخلی مجوز مدل/فهرست مصوب/قیمت‌گذاری را نشان دهد. پیشنهاد متن با عبارت جست‌وجو: «قطعه‌ای با این نام یا کد پیدا نشد. عبارت جست‌وجو را بررسی کنید.»؛ بدون عبارت جست‌وجو: «در حال حاضر قطعه‌ای برای سفارش شما نمایش داده نمی‌شود. برای پیگیری با کارشناس خدمات پس از فروش تماس بگیرید.» راهنمای داخلی فقط برای کارشناس و در جای مرتبط بماند.
- همچنان فقط ثبت در بسته بعدی؛ بدون اصلاح کد، پوش یا انتشار تا دستور اجرای یکجا.

- اصلاح صریح مالک درباره زمان پیام: قبل از انجام جست‌وجو، پیام «پیدا نشد» یا توضیح کمبود مجوز/قیمت نمایش داده نشود. پیام نتیجه خالی فقط پس از جست‌وجوی انجام‌شده با عبارت غیرخالی و پاسخ موفق سرور ظاهر شود؛ صرف خالی بودن فهرست اولیه کافی نیست. متن و نتیجه باید به آخرین عبارتِ جست‌وجوشده تعلق داشته باشند، نه عبارتی که هنوز فقط تایپ شده است. حالت بارگذاری و خطای دریافت از نتیجه خالی جدا بمانند.

## اجرای محلی اصلاحات رابط سفارش قطعه

پس از اعتراض مالک به طولانی‌شدن رسیدگی، سه اصلاح فوق یک‌جا در کد محلی اجرا شد: مسیر فلش‌دار قابل برگشت برای نماینده، عنوان کوتاه صفحه و حذف عنوان‌های میانی، نوار جست‌وجوی یکپارچه بدون دکمه پاک‌کردن، و شرط پیام خالی فقط پس از جست‌وجوی موفق با عبارت غیرخالی. جست‌وجوی تکراری ناشی از refresh دوباره نیز حذف شد.
آزمون‌های `tests/service-parts-search-ui.cjs` و `tests/after-sales-domain-ui.cjs` موفق شدند. فعلاً پوش و انتشار این اصلاحات انجام نشده است؛ نسخه آنلاین همچنان ۲۳۹ است.
بررسی نهایی TypeScript نیز موفق شد. اصلاحات همچنان محلی و منتشرنشده‌اند.


## اجرای بسته تأییدشده جست‌وجو و سفارش — 2026-11-12

مالک پیش‌نمایش کارت کالا و خلاصه سفارش را تأیید و صریحاً اجرا، پوش و انتشار آنلاین را خواست؛ محدودیت قبلی اجرای محلی برای این بسته رفع شد. این ورودی جایگزین وضعیت‌های موقت بخش قبلی است.
کارت‌ها از داده و عکس مجاز سامانه استفاده می‌کنند؛ بدون عکس، نماد خنثی نمایش داده می‌شود. انتخاب مقدار و خلاصه مبلغ بین جست‌وجوها حفظ می‌شود؛ محاسبه ریالی صحیح و تلاش مجدد با شناسه ثابت است. سفارش با تعرفه قدیمی در برابر تعرفه جدیدتر فعال، تراکنشی رد می‌شود. مسیرهای UI/HTTP/MCP همچنان از کنترل‌های مشترک دامنه استفاده می‌کنند.
اعتبارسنجی این بسته: جست‌وجوی اولیه/خالی/خطا، محاسبه مقدار اعشاری و ریال بزرگ، حفظ سبد و تلاش دوباره شبکه، عکس محدود به قطعه مجاز، منع افشای اطلاعات خصوصی، رد تعرفه قدیمی و عدم درج گردش مالی. آزمون دستی مرورگر و آزمون بار سراسری برای این بسته انجام نشده‌اند؛ فهرست قدیمی مواد و تعرفه‌ها همچنان بدهی فنی صفحه‌بندی دارد و در این تغییر بازنویسی نشده است. هیچ داده شرکت برای آزمون ساخته نمی‌شود. وضعیت پوش و انتشار باید مستقل از نتیجه آزمون ثبت و گزارش شود.

نتیجه بررسی پیش از انتشار: آزمون‌های service-parts-search-ui، service-parts، service-commercial، service-role-preview و after-sales-domain-ui موفق شدند؛ TypeScript --noEmit نیز بدون خطا پایان یافت.


## اصلاح سبد خرید اختیاری — 2026-11-12

مالک اجرا، آزمون، پوش و انتشار را صریحاً خواست: خلاصه پیش از انتخاب کالا نمایش داده نشود و بعد با دکمه سبد خرید باز شود. چیدمان جست‌وجو و نتایج تک‌ستونه و تمام‌عرض شد؛ دکمه شامل تعداد اقلام و مبلغ است. باز و بسته‌شدن انتخاب‌ها را تغییر نمی‌دهد؛ حذف آخرین قلم و ثبت موفق سبد را پنهان می‌کند. فقط رابط تغییر کرده؛ هیچ API، مجوز، نرخ، ثبت مالی، داده پایدار یا مهاجرتی تغییر ندارد. آزمون متمرکز رفتار سبد و جست‌وجو، TypeScript و ساخت انتشار اجرا می‌شوند. آزمون مرورگر دستی و بار سراسری جزء شواهد این اصلاح نیستند.

آزمون رفتاری service-parts-search-ui و بررسی TypeScript --noEmit موفق شدند؛ نمایش اولیه، باز و بسته‌شدن با دکمه، حفظ انتخاب، حذف آخرین قلم، ثبت موفق و شروع مجدد سبد بسته بررسی شدند.


## رفع گره اجرای سناریوی بین‌نقشی خدمات — 2026-11-12

مالک اجرای قابل مشاهده فرم‌به‌فرم از انبار تا سفارش نماینده و رفع گره‌های پیدا‌شده را خواست. بررسی مرورگر: هوم نماینده، فهرست ۲۷ نقش و پروفایل انبار مرکزی باز شدند؛ تا این مرحله هیچ داده‌ای با مرورگر ثبت نشده است. بررسی کد جدایی دادهٔ خدمات از انبار/فنی را تأیید کرد.
رفع در مسیر مشترک: انبار مرکزی و فنی در سناریوی خدمات وارد دادهٔ مجزای مشترک می‌شوند؛ APIهای کالا/محصول/BOM/خانواده/عکس/فایل و PATCH محصول یکسان مسیریابی می‌شوند. حساب واقعی مدیر جعل نمی‌شود و نقش عملیات حفظ می‌شود. نمایندهٔ تازه‌ساخته‌شده در دادهٔ آزمایشی، در همان تراکنش به سناریوی موجود training-base متصل می‌شود؛ نوع داده یا جدول جدیدی ایجاد نشده است. مسیرهای عادی کاربران تغییر دامنه ندارند؛ MCP از همان handlerها استفاده می‌کند.
آزمون خودکار service-role-preview: تعریف کالا توسط انبار، محصول/BOM توسط فنی، ساخت نماینده توسط مدیر، صلاحیت و پیشنهاد فهرست توسط کارشناس، تأیید مدیرعامل، پیشنهاد و تأیید اعتبار، پیشنهاد و تأیید قیمت توسط مالی و سفارش نماینده موفق شد؛ جدول‌های واقعی records/flow_entities/app_members/password_accounts/service_ledger بدون درج باقی ماندند. آزمون representative-links نیز موفق شد. این شواهد جای اجرای قابل مشاهده آنلاین در مرحله بعد را نمی‌گیرد.

بررسی تکمیلی: TypeScript --noEmit، service-parts، material-photos و material-files نیز موفق شدند. tests/production.cjs در مرحله جانمایی با خطای نبود محل نگهداری شکست خورد؛ همان شکست با همان خطا با بارگذاری تمام فایل‌های تغییرکرده از HEAD پیش از این اصلاح نیز بازتولید شد. این شکست مربوط به تنظیم قدیمی fixture جانمایی است و در این بسته تغییر گردش فیزیکی تولید یا جانمایی اعمال نشد. اجرای آنلاین فرم‌به‌فرم هنوز پس از انتشار لازم است.


## گره دوم اجرای مرورگر: برگشت ناخواسته انتخاب نقش

پس از انتشار اصلاح اشتراک داده، انتخاب انبار مرکزی در مرورگر چند بار به فهرست نقش‌ها برگشت؛ هنوز هیچ کالایی در مرورگر ساخته نشده است. علت: تازه‌سازی دسترسی پیش از تنظیم مقصد، provider دارای کلید دسترسی را بازسازی می‌کرد؛ نصب دوباره فهرست بدون مقصد، به صورت معتبر اما ناخواسته exit_profile می‌فرستاد. مقصد نقش اکنون قبل از تازه‌سازی دسترسی تنظیم می‌شود؛ آزمون رفتاری ترتیب مقصد و refresh به role-cartable-ui اضافه شد. تغییر صرفاً ترتیب رابط است؛ منطق مجوز سمت سرور تغییر ندارد.

آزمون role-cartable-ui با بررسی مقصد نقش هنگام تازه‌سازی دسترسی موفق شد. آزمون representative-profile-ui درباره نمایش نشان عمومی پیوند فروش/خدمات شکست می‌خورد؛ شکست همان assertion با بارگذاری فایل‌های تغییرکرده از HEAD نیز تکرار شد و به ترتیب انتخاب نقش مربوط نیست. بررسی کامل TypeScript برای بسته قبلی موفق است؛ تغییر حاضر فقط ترتیب دو فراخوانی موجود و بدون تغییر نوع است و JSX در آزمون رفتاری و ساخت انتشار بررسی می‌شود.


## گره‌های مشاهده‌شده بعد از ثبت کالا و BOM

دو شناسنامه 99011 و 99012 از فرم نقش انبار ثبت و با جست‌وجو مشاهده شدند. نقش فنی همان دو کالا را در BOM محصول نمونه TP1 افزود؛ پیام موفقیت و نسخه ۲ شامل ۶ قلم تأیید شد. کوشش اولیه ذخیره از کنترل خارج از دید نتیجه نداشت و تنها بعد از کلیک دکمه قابل مشاهده تأیید شد؛ نتیجه اولیه موفق گزارش نمی‌شود.
دو خطای مسیر مشاهده شد: فرم کیفیت محصول نمونه به API داده واقعی می‌رفت و 404 می‌داد؛ و مدیر خدمات با حق مشاهده دو حوزه، از ورودی بدون target وارد صفحه مستقیم با حوزه خالی می‌شد. فرم کیفیت به مسیر مشترک وصل و ورودی نقش به حوزه عملیاتی تعیین‌شده محدود شد؛ حق مشاهده و عمل سمت سرور تغییر نکرد. در مرورگر هنوز نماینده جدید یا سفارش ساخته نشده است.

بررسی ورودی مدیر همچنین نشان داد حالت embedded زبانه تنظیمات را پنهان می‌کند؛ لینک مدیریت مدیر به مقصد صریح service-settings وصل شد تا بخش تعریف نماینده مستقیماً باز شود و دوباره پشت منوی پنهان نماند. آزمون این مقصد و حفظ حوزه خانگی اضافه شد.

آزمون after-sales-domain-ui برای ورودی مدیر و مقصد تنظیمات، آزمون service-role-preview برای فرم کیفیت مشترک و کل زنجیره، و TypeScript --noEmit موفق شدند.

## ادامه سناریوی سه تعمیر و واریزی — 2026-11-12
سه فعال‌سازی فرضی از فرم مدیر ثبت شد (یک گارانتی جاری، دو منقضی). دریافت انبار در مرورگر به نبود انبار دارای سیاست دریافت و قرنطینه برخورد کرد؛ هیچ رسید/خروج/تعمیر/پرداختی برای این ادامه هنوز ثبت نشده است. تنظیم همان انبار از فرم موجود مدیریت به ورودی مجزای آزمون متصل شد؛ فقط admin واقعی و mode=warehouse. حذف انبار از این ورودی عرضه نمی‌شود. مسئولیت پروفایل انبار و کیفیت پس از ورود به storage آزمون دوباره محاسبه می‌شود. نقش مرکزی به مجوز موجود service_inventory حوزه home و کار آماده‌سازی سفارش خدمات متصل شد؛ مجوز مالی یا مدیر اضافه نشد. مسیرهای حرکت، fulfillment و transport نیز wrapper مجزای مشترک دارند. آزمون service-role-preview دریافت و کنترل کیفیت جدید، مرزبندی شرکت/آزمون و رد دسترسی نامجاز را تأیید کرد؛ role-cartable-ui موفق بود. بازخوانی مرورگر و تکمیل سه تعمیر، خروج انبار و تطبیق بانکی هنوز باقی است.
## 2026-11-12 — Direct service payment entry

- Scope: home navigation, explicit new/list payment view, one-time draft opening and explanatory unassigned-profile form. Existing server authorization and financial matching rules are unchanged.
- PASS: service-payments-ui.cjs and service-dashboard.cjs. Tests include disabled/unsubmitted unassigned drafts, preserved inputs after refresh, cancel without reopening, reviewer scope and history routing. TypeScript and native publication/source evidence recorded with the release.
- No business data writes performed for this UI change. Browser rendering is not claimed by the component tests.
