import {salesRoles as salesPermissionTitles} from './sales-contract';
import {materialUnitLabels} from './material-units';
import {jobRoles} from './permissions';
import {supplyRoles} from './sourcing-labels';
import {reminderLinks,reminderTriggers,reminderModes,reminderConditions,reminderFields,reminderDelegationKinds} from './reminder-contract';
// Enumerated wire values with display-only Persian captions. Keys include the full field path.
export const toolOptions:Record<string,Record<string,Record<string,string>>>={
 "routine_production_apply": {
  "mode": {
   "policy": "نسخه تنظیم زمان مفید",
   "route": "نسخه مسیر ساخت و کارسنجی",
   "lot": "بچ ساخت قطعه واسط",
   "assign": "تخصیص کار روزانه",
   "adjust": "اصلاح زمان در دسترس",
   "output": "ثبت خروجی و مصرف",
   "close": "بستن کار روز",
   "reason": "توضیح کارگر",
   "review": "نتیجه بررسی سرکارگر",
   "quality": "تأیید کیفیت و رسید نیمه‌ساخته",
   "cost": "نهایی‌سازی بهای بچ"
  }
 },

 "get_system_reset_status": {
  "scope": {
   "operations": "اطلاعات عملیاتی",
   "full": "تمام اطلاعات"
  }
 },
 "prepare_system_reset": {
  "scope": {
   "operations": "اطلاعات عملیاتی",
   "full": "تمام اطلاعات"
  }
 },
 "get_development_requests": {
  "queue":{"all":"همه درخواست‌ها و بایگانی","inbox":"کارتابل جاری","waiting":"منتظر پاسخ و تست کاربر"},
  "state": {
   "": "انتخاب نشده",
   "new": "جدید",
   "reviewing": "در حال بررسی",
   "needs_info": "نیاز به توضیح کاربر",
   "planned": "برنامه‌ریزی‌شده",
   "done": "انجام‌شده — منتظر تأیید کاربر",
   "in_progress": "در حال توسعه",
   "ready_test": "آماده تست و تأیید درخواست‌کننده",
   "changes_requested": "نیازمند اصلاح پس از تست",
   "declined": "پذیرفته‌نشده",
   "closed": "بسته‌شده"
  }
 },
 "submit_development_request": {
  "kind": {
   "feature": "قابلیت جدید",
   "improvement": "بهبود قابلیت موجود",
   "bug": "اشکال فنی",
   "access": "درخواست دسترسی"
  }
 },
 "review_development_request": {
  "state": {
   "new": "جدید",
   "reviewing": "در حال بررسی",
   "needs_info": "نیاز به توضیح کاربر",
   "planned": "برنامه‌ریزی‌شده",
   "done": "انجام‌شده — منتظر تأیید کاربر",
   "in_progress": "در حال توسعه",
   "ready_test": "آماده تست و تأیید درخواست‌کننده",
   "changes_requested": "نیازمند اصلاح پس از تست",
   "declined": "پذیرفته‌نشده",
   "closed": "بسته‌شده"
  }
 },
 "respond_development_request": {"decision":{"accept":"نیاز برطرف شد؛ پایان درخواست","return":"هنوز برطرف نشده؛ بازگشت به توسعه"}},
 "get_record_schema": {
  "kind": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  }
 },
 "list_records": {
  "kind": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  }
 },
 "create_record": {
  "kind": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی"
  }
 },
 "print_serials": {
  "layout": {
   "a4": "برگه A4",
   "thermal": "چاپگر حرارتی"
  },
  "label": {
   "large": "بزرگ",
   "small": "کوچک"
  }
 },
 "create_quality_template": {
  "fields.*.type": {
   "number": "عدد",
   "text": "متن",
   "result": "نتیجه"
  }
 },
 "record_quality_report": {
  "verdict": {
   "pass": "قبول",
   "fail": "رد"
  },
  "cause": {
   "part": "قطعه",
   "assembly": "مونتاژ",
   "design": "طراحی",
   "test": "آزمون",
   "unknown": "نامشخص"
  }
 },
 "get_finance_period": {
  "cadence": {
   "daily": "روزانه",
   "weekly": "هفتگی"
  }
 },
 "add_finance_note": {
  "cadence": {
   "daily": "روزانه",
   "weekly": "هفتگی"
  },
  "kind": {
   "result": "نتیجه",
   "question": "پرسش",
   "answer": "پاسخ",
   "closure": "بستن پرونده"
  }
 },
 "create_user": {
  "status": {
   "active": "فعال",
   "disabled": "غیرفعال"
  },
  "permissions.qmsRoles.*": {
   "qa": "مدیر تضمین کیفیت",
   "documents": "کارشناس تضمین کیفیت و کنترل مدارک",
   "qc": "مسئول کنترل کیفیت",
   "regulatory": "کارشناس مجوزها",
   "technical": "مسئول فنی",
   "calibration": "مسئول تجهیزات آزمون",
   "auditor": "ممیز داخلی",
   "observer": "ممیز بیرونی — فقط مشاهده"
  },
  "permissions.personnelRoles.*": {
   "hr": "اداری و منابع انسانی",
   "payroll": "تهیه حقوق‌ودستمزد",
   "approver": "تأیید حقوق و احکام",
   "finance": "تأیید پرداخت پرسنلی",
   "treasury": "ثبت پرداخت پرسنلی",
   "executive_viewer": "گزارش‌خوان مرخصی مدیرعامل",
   "reporter": "گزارش‌خوان اداری مرخصی"
  },
  "permissions.salesRoles.*": {
   "manager": "مدیر فروش",
   "staff": "کارشناس فروش",
   "finance": "مالی فروش",
   "viewer": "گزارش فروش",
   "agent": "نماینده فروش"
  },
  "permissions.transportRoles.*": {
   "manager": "مسئول تدارکات و حمل‌ونقل",
   "driver": "کارشناس تدارکات و حمل‌ونقل"
  },
  "permissions.serviceRoles.*": {
   "manager": "مدیر خدمات",
   "support": "پاسخ‌گویی",
   "intake": "پذیرش",
   "technician": "تعمیرکار",
   "coordinator": "مسئول نمایندگان",
   "inventory": "انبار خدمات",
   "finance": "مالی خدمات",
   "agent": "نماینده خدمات"
  },
  "permissions.serviceDomains.*": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  },
  "permissions.supplyRoles.*": {
   "sales": "فروش / درخواست تولید",
   "ceo": "مدیرعامل / تأیید",
   "engineering": "تحقیق و توسعه",
   "inventory": "کنترل موجودی",
   "finance": "برنامه مالی",
   "domestic": "بازرگانی داخلی",
   "foreign": "بازرگانی خارجی"
  },
  "permissions.warehouses.*": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق",
   "finished": "محصول نهایی"
  },
  "permissions.flowRoles.*": {
   "inventory": "انبار",
   "qc": "کنترل کیفیت",
   "production": "تولید",
   "procurement": "تأمین",
   "sales": "فروش",
   "logistics": "تدارکات"
  },
  "permissions.read.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.write.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.eventStages.*": {
   "مصرف قطعه": "مصرف قطعه",
   "مونتاژ": "مونتاژ",
   "آزمون نهایی": "آزمون نهایی",
   "بسته‌بندی": "بسته‌بندی",
   "تحویل": "تحویل"
  },
  "permissions.finance": {
   "none": "بدون دسترسی",
   "read": "مشاهده",
   "write": "ثبت و ویرایش"
  }
 },
 "update_user": {
  "status": {
   "active": "فعال",
   "disabled": "غیرفعال"
  },
  "permissions.qmsRoles.*": {
   "qa": "مدیر تضمین کیفیت",
   "documents": "کارشناس تضمین کیفیت و کنترل مدارک",
   "qc": "مسئول کنترل کیفیت",
   "regulatory": "کارشناس مجوزها",
   "technical": "مسئول فنی",
   "calibration": "مسئول تجهیزات آزمون",
   "auditor": "ممیز داخلی",
   "observer": "ممیز بیرونی — فقط مشاهده"
  },
  "permissions.personnelRoles.*": {
   "hr": "اداری و منابع انسانی",
   "payroll": "تهیه حقوق‌ودستمزد",
   "approver": "تأیید حقوق و احکام",
   "finance": "تأیید پرداخت پرسنلی",
   "treasury": "ثبت پرداخت پرسنلی",
   "executive_viewer": "گزارش‌خوان مرخصی مدیرعامل",
   "reporter": "گزارش‌خوان اداری مرخصی"
  },
  "permissions.salesRoles.*": {
   "manager": "مدیر فروش",
   "staff": "کارشناس فروش",
   "finance": "مالی فروش",
   "viewer": "گزارش فروش",
   "agent": "نماینده فروش"
  },
  "permissions.transportRoles.*": {
   "manager": "مسئول تدارکات و حمل‌ونقل",
   "driver": "کارشناس تدارکات و حمل‌ونقل"
  },
  "permissions.serviceRoles.*": {
   "manager": "مدیر خدمات",
   "support": "پاسخ‌گویی",
   "intake": "پذیرش",
   "technician": "تعمیرکار",
   "coordinator": "مسئول نمایندگان",
   "inventory": "انبار خدمات",
   "finance": "مالی خدمات",
   "agent": "نماینده خدمات"
  },
  "permissions.serviceDomains.*": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  },
  "permissions.supplyRoles.*": {
   "sales": "فروش / درخواست تولید",
   "ceo": "مدیرعامل / تأیید",
   "engineering": "تحقیق و توسعه",
   "inventory": "کنترل موجودی",
   "finance": "برنامه مالی",
   "domestic": "بازرگانی داخلی",
   "foreign": "بازرگانی خارجی"
  },
  "permissions.warehouses.*": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق",
   "finished": "محصول نهایی"
  },
  "permissions.flowRoles.*": {
   "inventory": "انبار",
   "qc": "کنترل کیفیت",
   "production": "تولید",
   "procurement": "تأمین",
   "sales": "فروش",
   "logistics": "تدارکات"
  },
  "permissions.read.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.write.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.eventStages.*": {
   "مصرف قطعه": "مصرف قطعه",
   "مونتاژ": "مونتاژ",
   "آزمون نهایی": "آزمون نهایی",
   "بسته‌بندی": "بسته‌بندی",
   "تحویل": "تحویل"
  },
  "permissions.finance": {
   "none": "بدون دسترسی",
   "read": "مشاهده",
   "write": "ثبت و ویرایش"
  }
 },
 "suggest_service_agents": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  }
 },
 "get_after_sales": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  }
 },
 "list_service_agent_accounts": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  }
 },
 "create_service_agent_account": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  }
 },
 "get_after_sales_report": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  }
 },
 "transport_apply": {
  "mode": {
   "checklist": "چک‌لیست پیش از حرکت",
   "blocker": "ثبت مانع انجام کار",
   "blocker_resolve": "رفع مانع و ادامه پیگیری",
   "vehicle_report": "گزارش کیلومتر، سوخت یا خرابی",
   "create": "درخواست حمل",
   "assign": "تخصیص / تغییر مأموریت",
   "collect": "تأیید دریافت راننده",
   "carrier": "تحویل به باربری",
   "offer": "اعلام تحویل به مقصد",
   "receipt": "تأیید دریافت مقصد",
   "resolve": "بررسی مغایرت",
   "documents": "تکمیل اطلاعات بارنامه",
   "expense": "ثبت هزینه حمل",
   "expense_review": "بررسی هزینه حمل",
   "cancel": "لغو درخواست",
   "vehicle": "تعریف / ویرایش خودرو",
   "link_party": "اتصال گیرنده فروش به نمایندگی"
  }
 },
 "after_sales_apply": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  },
  "mode": {
   "agent": "تعریف نماینده",
   "tariff": "تعرفه خدمت",
   "create": "پرونده جدید",
   "contact": "ثبت تماس",
   "intake": "پذیرش دستگاه",
   "diagnose": "عیب‌یابی و برآورد",
   "consent": "پاسخ مشتری به هزینه",
   "authorize": "بررسی گارانتی",
   "reserve": "رزرو قطعات",
   "repair": "ثبت تعمیر و مصرف",
   "test": "آزمون نهایی",
   "deliver": "تحویل به مشتری",
   "return_unrepaired": "تحویل بدون تعمیر",
   "confirm": "تماس تأیید مشتری",
   "labor": "تأیید اجرت",
   "order": "درخواست قطعه و فاکتور",
   "approve_order": "تأیید درخواست قطعه",
   "prepare": "جمع‌آوری قطعات",
   "ship": "ارسال قطعات",
   "receive": "دریافت قطعات",
   "return_send": "ارسال داغی",
   "return_receive": "دریافت داغی",
   "return_review": "بررسی داغی",
   "credit": "تأیید تعدیل مالی داغی",
   "payment": "ثبت پرداخت",
   "offset": "تهاتر حساب",
   "office_stock": "تأمین قطعات دفتر",
   "followup": "پیگیری / تعیین مسئول",
   "activation_import": "ثبت اطلاعات گارانتی"
  }
 },
 "preview_service_activations": {
  "domain": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  }
 },
 "print_service_document": {
  "kind": {
   "receipt": "رسید",
   "invoice": "فاکتور",
   "warranty": "گارانتی"
  },
  "format": {
   "html": "صفحه قابل چاپ",
   "text": "متن"
  }
 },
 "report_transport_blocker": {
  "reason": {
   "recipient_absent": "گیرنده حضور ندارد",
   "wrong_address": "نشانی اشتباه است",
   "cargo_not_ready": "بار آماده نیست",
   "vehicle_fault": "خودرو مشکل دارد",
   "carrier_delay": "تأخیر باربری",
   "other": "سایر"
  }
 },
 "record_transport_vehicle_report": {
  "reportKind": {
   "reading": "ثبت کیلومتر",
   "fuel": "سوخت",
   "fault": "خرابی"
  }
 },
 "inbox_apply": {
  "mode": {
   "create": "ارسال پیام جدید",
   "reply": "ارسال پاسخ",
   "claim": "پذیرش مسئولیت",
   "start": "شروع رسیدگی",
   "blocked": "ثبت مانع",
   "submit": "اعلام انجام برای تأیید",
   "approve": "تأیید انجام",
   "reopen": "درخواست اصلاح",
   "close": "بستن گفت‌وگو",
   "cancel": "لغو درخواست",
   "convert": "تبدیل به درخواست کاری",
   "reschedule": "تغییر مهلت",
   "read": "ثبت مشاهده",
   "snooze": "یادآوری بعداً"
  }
 },
 "upload_transport_file": {
  "purpose": {
   "waybill": "بارنامه",
   "receipt": "رسید",
   "condition": "وضعیت ظاهری",
   "expense": "هزینه"
  }
 },
 "upload_service_file": {
  "purpose": {
   "before": "پیش از انجام کار",
   "intake": "پذیرش",
   "diagnosis": "عیب‌یابی",
   "after": "پس از انجام کار",
   "delivery": "تحویل",
   "other": "سایر"
  }
 },
 "list_finance_files": {
  "cadence": {
   "daily": "روزانه",
   "weekly": "هفتگی"
  }
 },
 "upload_finance_file": {
  "cadence": {
   "daily": "روزانه",
   "weekly": "هفتگی"
  }
 },
 "download_finance_file": {
  "cadence": {
   "daily": "روزانه",
   "weekly": "هفتگی"
  }
 },
 "preview_bom_import": {
  "lines.*.unit": materialUnitLabels
 },
 "commit_bom_import": {
  "lines.*.unit": materialUnitLabels
 },
 "save_product_bom": {
  "lines.*.unit": materialUnitLabels
 },
 "initialize_batch_stock": {
  "to": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق"
  }
 },
 "move_batch_stock": {
  "from": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق"
  },
  "to": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق"
  }
 },
 "create_production_sheet": {
  "allocations.*.warehouse": {
   "raw": "مواد اولیه",
   "line": "خط تولید"
  }
 },
 "create_password_user": {
  "status": {
   "active": "فعال",
   "disabled": "غیرفعال"
  },
  "permissions.qmsRoles.*": {
   "qa": "مدیر تضمین کیفیت",
   "documents": "کارشناس تضمین کیفیت و کنترل مدارک",
   "qc": "مسئول کنترل کیفیت",
   "regulatory": "کارشناس مجوزها",
   "technical": "مسئول فنی",
   "calibration": "مسئول تجهیزات آزمون",
   "auditor": "ممیز داخلی",
   "observer": "ممیز بیرونی — فقط مشاهده"
  },
  "permissions.personnelRoles.*": {
   "hr": "اداری و منابع انسانی",
   "payroll": "تهیه حقوق‌ودستمزد",
   "approver": "تأیید حقوق و احکام",
   "finance": "تأیید پرداخت پرسنلی",
   "treasury": "ثبت پرداخت پرسنلی",
   "executive_viewer": "گزارش‌خوان مرخصی مدیرعامل",
   "reporter": "گزارش‌خوان اداری مرخصی"
  },
  "permissions.salesRoles.*": {
   "manager": "مدیر فروش",
   "staff": "کارشناس فروش",
   "finance": "مالی فروش",
   "viewer": "گزارش فروش",
   "agent": "نماینده فروش"
  },
  "permissions.transportRoles.*": {
   "manager": "مسئول تدارکات و حمل‌ونقل",
   "driver": "کارشناس تدارکات و حمل‌ونقل"
  },
  "permissions.serviceRoles.*": {
   "manager": "مدیر خدمات",
   "support": "پاسخ‌گویی",
   "intake": "پذیرش",
   "technician": "تعمیرکار",
   "coordinator": "مسئول نمایندگان",
   "inventory": "انبار خدمات",
   "finance": "مالی خدمات",
   "agent": "نماینده خدمات"
  },
  "permissions.serviceDomains.*": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  },
  "permissions.supplyRoles.*": {
   "sales": "فروش / درخواست تولید",
   "ceo": "مدیرعامل / تأیید",
   "engineering": "تحقیق و توسعه",
   "inventory": "کنترل موجودی",
   "finance": "برنامه مالی",
   "domestic": "بازرگانی داخلی",
   "foreign": "بازرگانی خارجی"
  },
  "permissions.warehouses.*": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق",
   "finished": "محصول نهایی"
  },
  "permissions.flowRoles.*": {
   "inventory": "انبار",
   "qc": "کنترل کیفیت",
   "production": "تولید",
   "procurement": "تأمین",
   "sales": "فروش",
   "logistics": "تدارکات"
  },
  "permissions.read.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.write.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.eventStages.*": {
   "مصرف قطعه": "مصرف قطعه",
   "مونتاژ": "مونتاژ",
   "آزمون نهایی": "آزمون نهایی",
   "بسته‌بندی": "بسته‌بندی",
   "تحویل": "تحویل"
  },
  "permissions.finance": {
   "none": "بدون دسترسی",
   "read": "مشاهده",
   "write": "ثبت و ویرایش"
  }
 },
 "update_password_user": {
  "status": {
   "active": "فعال",
   "disabled": "غیرفعال"
  },
  "permissions.qmsRoles.*": {
   "qa": "مدیر تضمین کیفیت",
   "documents": "کارشناس تضمین کیفیت و کنترل مدارک",
   "qc": "مسئول کنترل کیفیت",
   "regulatory": "کارشناس مجوزها",
   "technical": "مسئول فنی",
   "calibration": "مسئول تجهیزات آزمون",
   "auditor": "ممیز داخلی",
   "observer": "ممیز بیرونی — فقط مشاهده"
  },
  "permissions.personnelRoles.*": {
   "hr": "اداری و منابع انسانی",
   "payroll": "تهیه حقوق‌ودستمزد",
   "approver": "تأیید حقوق و احکام",
   "finance": "تأیید پرداخت پرسنلی",
   "treasury": "ثبت پرداخت پرسنلی",
   "executive_viewer": "گزارش‌خوان مرخصی مدیرعامل",
   "reporter": "گزارش‌خوان اداری مرخصی"
  },
  "permissions.salesRoles.*": {
   "manager": "مدیر فروش",
   "staff": "کارشناس فروش",
   "finance": "مالی فروش",
   "viewer": "گزارش فروش",
   "agent": "نماینده فروش"
  },
  "permissions.transportRoles.*": {
   "manager": "مسئول تدارکات و حمل‌ونقل",
   "driver": "کارشناس تدارکات و حمل‌ونقل"
  },
  "permissions.serviceRoles.*": {
   "manager": "مدیر خدمات",
   "support": "پاسخ‌گویی",
   "intake": "پذیرش",
   "technician": "تعمیرکار",
   "coordinator": "مسئول نمایندگان",
   "inventory": "انبار خدمات",
   "finance": "مالی خدمات",
   "agent": "نماینده خدمات"
  },
  "permissions.serviceDomains.*": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  },
  "permissions.supplyRoles.*": {
   "sales": "فروش / درخواست تولید",
   "ceo": "مدیرعامل / تأیید",
   "engineering": "تحقیق و توسعه",
   "inventory": "کنترل موجودی",
   "finance": "برنامه مالی",
   "domestic": "بازرگانی داخلی",
   "foreign": "بازرگانی خارجی"
  },
  "permissions.warehouses.*": {
   "raw": "مواد اولیه",
   "semi": "موجودی قدیمیِ بدون انبار تعیین‌شده",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق",
   "finished": "محصول نهایی"
  },
  "permissions.flowRoles.*": {
   "inventory": "انبار",
   "qc": "کنترل کیفیت",
   "production": "تولید",
   "procurement": "تأمین",
   "sales": "فروش",
   "logistics": "تدارکات"
  },
  "permissions.read.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.write.*": {
   "product": "محصول",
   "batch": "بچ قطعات",
   "device": "دستگاه",
   "event": "رویداد تولید و تحویل",
   "service": "گزارش خدمات",
   "action": "اقدام اصلاحی",
   "distribution": "نماینده و مشتری",
   "firmware": "نسخه‌های نرم‌افزار"
  },
  "permissions.eventStages.*": {
   "مصرف قطعه": "مصرف قطعه",
   "مونتاژ": "مونتاژ",
   "آزمون نهایی": "آزمون نهایی",
   "بسته‌بندی": "بسته‌بندی",
   "تحویل": "تحویل"
  },
  "permissions.finance": {
   "none": "بدون دسترسی",
   "read": "مشاهده",
   "write": "ثبت و ویرایش"
  }
 },
 "save_material_master": {
  "unit": materialUnitLabels,
  "fields.*.type": {
   "number": "عدد",
   "text": "متن",
   "result": "نتیجه"
  }
 },
 "replace_installed_component": {
  "cause": {
   "part": "قطعه",
   "assembly": "مونتاژ",
   "design": "طراحی",
   "test": "آزمون",
   "unknown": "نامشخص"
  }
 },
 "decide_assistant_action": {
  "decision": {
   "confirm": "تأیید",
   "cancel": "لغو"
  }
 },
 "test_llm_connection": {
  "mode": {
   "models": "دریافت مدل‌ها",
   "probe": "آزمون اتصال"
  }
 },
 "save_sales_recipient": {
  "kind": {
   "agent": "عامل فروش",
   "representative": "نماینده فروش",
   "branch": "شعبه شرکت"
  }
 },
 "save_duty_template": {
  "cadence": {
   "once": "یک‌بار",
   "daily": "روزانه",
   "weekly": "هفتگی",
   "monthly": "ماهانه"
  },
  "evidence": {
   "text": "متن",
   "file": "فایل"
  },
  "sourceSection": {
   "": "انتخاب نشده",
   "guarantees": "ضمانت‌نامه‌ها",
   "after-sales": "خدمات پس از فروش",
   "finance-control": "کنترل مالی",
   "fulfillment": "تحویل محصول",
   "flow": "گردش مواد",
   "inventory": "انبار",
   "product": "محصول",
   "sourcing": "تأمین و بازرگانی"
  }
 },
 "review_supplier_document": {
  "result": {
   "approved": "تأییدشده",
   "rejected": "ردشده",
   "withdrawn": "پس‌گرفته‌شده"
  }
 },
 "create_supplier_capa": {
  "severity": {
   "minor": "جزئی",
   "major": "عمده",
   "critical": "بحرانی"
  }
 },
 "verify_supplier_capa": {
  "result": {
   "effective": "اثربخش",
   "ineffective": "فاقد اثربخشی"
  }
 },
 "upload_supplier_document": {
  "kind": {
   "certificate": "گواهینامه",
   "contract": "قرارداد",
   "audit": "ممیزی",
   "sample": "نمونه",
   "capa": "اقدام اصلاحی",
   "other": "سایر"
  },
  "visibility": {
   "quality": "کیفیت",
   "commercial": "بازرگانی"
  }
 },
 "sales_apply": {
  "requestSource.channel": {
   "phone": "تماس تلفنی",
   "message": "پیام",
   "email": "ایمیل",
   "in_person": "مراجعه حضوری",
   "letter": "نامه"
  },
  "kind": {
   "representative": "نماینده",
   "reseller": "عامل فروش",
   "branch": "شعبه",
   "end_customer": "مصرف‌کننده نهایی",
   "referrer": "عامل معرف"
  },
  "mode": {
   "terms": "شرایط اعتباری نماینده",
   "agent": "پرونده نماینده",
   "price": "قیمت فروش",
   "target": "انتشار تارگت و پلکان تخفیف",
   "order": "ثبت سفارش",
   "order_review": "بررسی فروش",
   "order_progress": "موعد و پیشرفت سفارش",
   "order_cancel": "لغو سفارش فاکتورنشده",
   "invoice": "تأیید مالی و صدور فاکتور",
   "payment": "اعلام پرداخت",
   "payment_review": "بررسی پرداخت",
   "check_status": "وصول یا برگشت چک",
   "allocate": "تخصیص اعتبار به قسط",
   "payment_reverse": "برگشت ثبت پرداخت",
   "return_request": "درخواست برگشت دستگاه",
   "return_receive": "دریافت فیزیکی برگشتی",
   "return_review": "بررسی مالی برگشت",
   "opening": "پیش‌نویس مانده افتتاحیه",
   "opening_review": "تطبیق و تأیید افتتاحیه"
  },
  "basis": {
   "net": "فروش خالص",
   "units": "تعداد"
  },
  "items.*.kind": {
   "invoice": "فاکتور",
   "credit": "اعتباری",
   "check": "چک"
  },
  "milestone": {
   "waiting_stock": "انتظار تأمین موجودی",
   "production": "در حال تولید",
   "preparing": "در حال آماده‌سازی"
  },
  "method": {
   "bank": "واریز بانکی",
   "cash": "نقدی",
   "check": "چک"
  },
  "state": {
   "cleared": "وصول‌شده",
   "bounced": "برگشتی"
  }
 },
 "save_supplier": {
  "route": {
   "domestic": "داخلی",
   "foreign": "خارجی"
  },
  "kind": {
   "manufacturer": "تولیدکننده",
   "trader": "بازرگان"
  }
 },
 "review_material_supplier": {
  "status": {
   "pending": "در انتظار بررسی",
   "approved": "تأییدشده",
   "conditional": "مشروط",
   "suspended": "تعلیق‌شده",
   "rejected": "ردشده"
  },
  "qualityRisk": {
   "low": "کم",
   "medium": "متوسط",
   "high": "زیاد"
  },
  "supplyRisk": {
   "low": "کم",
   "medium": "متوسط",
   "high": "زیاد"
  }
 },
 "create_sourcing_plan": {
  "origin": {
   "forecast": "پیش‌بینی",
   "customer": "مشتری"
  }
 },
 "set_material_sourcing_routes": {
  "routes.*": {
   "domestic": "داخلی",
   "foreign": "خارجی"
  }
 },
 "set_sourcing_finance": {
  "status": {
   "planned": "برنامه‌ریزی‌شده",
   "approved": "تأییدشده"
  }
 },
 "save_sourcing_quote": {
  "route": {
   "domestic": "داخلی",
   "foreign": "خارجی"
  },
  "currency": {
   "IRR": "ریال",
   "IRT": "تومان",
   "USD": "دلار آمریکا",
   "CNY": "یوان چین",
   "EUR": "یورو"
  }
 },
 "review_sourcing_quote": {
  "result": {
   "pass": "قبول",
   "fail": "رد"
  }
 },
 "review_sourcing_financial": {
  "result": {
   "pass": "قبول",
   "fail": "رد"
  }
 },
 "track_sourcing_purchase": {
  "stage": {
   "paid": "پرداخت‌شده",
   "preparing": "در حال آماده‌سازی",
   "shipped": "ارسال‌شده",
   "update": "به‌روزرسانی"
  }
 },
 "set_my_profile_photo": {
  "mode": {
   "upload": "بارگذاری فایل",
   "remove": "حذف فایل"
  }
 },
 "get_sales_monitor": {
  "preview": {
   "daily": "روزانه",
   "weekly": "هفتگی",
   "quarterly": "فصلی"
  }
 },
 "sales_monitor_apply": {
  "mode": {
   "configure": "تنظیم قواعد و مسئولان",
   "goal": "تعریف هدف",
   "retire_goal": "غیرفعال‌کردن هدف",
   "scan": "بررسی وضعیت",
   "assign": "تعیین مسئول",
   "review_goal": "بازبینی هدف",
   "report_read": "ثبت مطالعه گزارش",
   "followup": "ثبت پیگیری",
   "acknowledge": "ثبت مشاهده",
   "recover_check": "ثبت جبران چک برگشتی"
  },
  "data.basis": {
   "net": "فروش خالص",
   "units": "تعداد"
  }
 },
 "hospital_upload_file": {
  "purpose": {
   "manual": "دستی",
   "payment": "پرداخت",
   "report": "گزارش"
  },
  "mime": {
   "application/pdf": "سند PDF",
   "image/png": "تصویر PNG",
   "image/jpeg": "تصویر JPEG"
  }
 },
 "upload_hospital_expense_file": {
  "mime": {
   "application/pdf": "سند PDF",
   "image/png": "تصویر PNG",
   "image/jpeg": "تصویر JPEG"
  }
 },
 "costing_apply": {
  "mode": {
   "price": "قیمت مستند بچ",
   "material": "نرخ استاندارد قطعه",
   "standard": "زمان و نرخ استاندارد",
   "time": "زمان واقعی دستگاه",
   "period": "هزینه‌های دوره",
   "close": "تأیید و ذخیره گزارش نهایی"
  }
 },
 "purchase_settlement_apply": {
  "mode": {
   "save": "ذخیره اطلاعات",
   "submit": "ارسال برای بررسی",
   "review": "بررسی اطلاعات",
   "approve": "تأیید",
   "return": "برگشت برای اصلاح",
   "reopen": "بازگشایی پرونده"
  },
  "data.currency": {
   "IRR": "ریال",
   "IRT": "تومان",
   "USD": "دلار آمریکا",
   "CNY": "یوان چین",
   "EUR": "یورو"
  },
  "data.allocation": {
   "value": "ارزش",
   "weight": "وزن",
   "manual": "دستی"
  }
 },
 "expense_register_apply": {
  "mode": {
   "save": "ذخیره اطلاعات",
   "approve": "تأیید",
   "reopen": "بازگشایی پرونده",
   "rule": "تعریف قاعده",
   "retire_rule": "غیرفعال‌کردن قاعده"
  }
 },
 "purchase_payables_apply": {
  "mode": {
   "create": "پرونده خرید جدید",
   "invoice": "ثبت / اصلاح فاکتور",
   "match": "تطبیق رسیدهای انبار",
   "payment": "ثبت پرداخت انجام‌شده",
   "recognize": "تأیید بدهی",
   "unrecognize": "برگشت تأیید بدهی",
   "allocate": "تخصیص پرداخت به فاکتور",
   "schedule": "شرایط و اقساط پرداخت",
   "release": "اجازه پرداخت",
   "hold": "توقف پرداخت",
   "advance": "برنامه پیش‌پرداخت",
   "release_advance": "اجازه پیش‌پرداخت",
   "close_advance": "بستن مانده برنامه پیش‌پرداخت",
   "dispute": "تعیین مبلغ اختلاف و توقف آن",
   "clear_dispute": "رفع اختلاف",
   "issue": "پیگیری نقص و مدرک",
   "resolve_issue": "تأیید رفع نقص",
   "void": "ابطال مستند"
  },
  "route": {
   "domestic": "داخلی",
   "foreign": "خارجی"
  },
  "kind": {
   "invoices": "فاکتورها",
   "payments": "پرداخت‌ها",
   "allocations": "تخصیص‌ها",
   "advances": "پیش‌پرداخت‌ها"
  }
 },
 "build_project_apply": {
  "mode": {
   "create": "تعریف پروژه ساخت",
   "unit": "افزودن تجهیز",
   "bom": "ویرایش BOM پروژه",
   "approve_bom": "تأیید نسخه BOM",
   "budget": "بودجه و برآورد باقی‌مانده",
   "request": "درخواست قطعه از انبار",
   "reserve": "رزرو بچ‌های انبار",
   "shortage": "ارجاع کسری به تأمین",
   "issue": "تحویل قطعات به پروژه",
   "cancel_request": "لغو درخواست و آزادسازی رزرو",
   "consume": "ثبت مصرف واقعی",
   "return": "برگشت سالم به انبار",
   "scrap": "ثبت قطعه خراب / نامنطبق",
   "time": "ثبت زمان کار",
   "approve_time": "تأیید زمان و نرخ",
   "expense": "ثبت هزینه و تخصیص",
   "commitment": "ثبت تعهد خرید",
   "close_commitment": "تعیین تکلیف تعهد",
   "issue_note": "ثبت نقص و پیگیری",
   "resolve_note": "تأیید رفع نقص",
   "quality": "تأیید فنی و کیفیت تجهیز",
   "void": "ابطال مستند",
   "close": "نهایی‌سازی مالی پروژه",
   "reopen": "بازگشایی پروژه"
  },
  "allocationMethod": {
   "manual": "دستی",
   "time": "زمان"
  },
  "bucket": {
   "manufacturing": "تولید",
   "execution": "اجرای کار",
   "loss": "ضایعات"
  },
  "kind": {
   "times": "زمان‌های ثبت‌شده",
   "expenses": "هزینه‌ها"
  }
 },
 "guarantee_apply": {
  "mode": {
   "save": "ثبت / ویرایش پرونده",
   "submit": "ارسال برای تأیید مالی",
   "return_review": "برگشت برای اصلاح",
   "approve": "تأیید مستقل مالی",
   "issue": "ثبت صدور / دریافت",
   "request_extension": "درخواست تمدید",
   "request_release": "درخواست آزادسازی",
   "followup": "ثبت پیگیری",
   "amend": "پیشنهاد تمدید / تغییر مبلغ",
   "approve_amendment": "تأیید اصلاح",
   "cancel_amendment": "لغو اصلاح پیشنهادی",
   "confirm_amendment": "ثبت اصلاح بانکی",
   "demand": "ثبت مطالبه",
   "collection": "ثبت وصول / پرداخت مطالبه",
   "resolve_demand": "تعیین تکلیف مطالبه",
   "terminate": "ثبت خاتمه تعهد",
   "return_original": "استرداد اصل سند",
   "release_collateral": "آزادسازی سپرده و وثیقه",
   "close": "بستن نهایی پرونده"
  },
  "direction": {
   "outgoing": "صادره",
   "incoming": "وارده"
  },
  "kind": {
   "tender": "شرکت در مناقصه",
   "performance": "حسن انجام تعهد",
   "advance": "پیش‌پرداخت",
   "other": "سایر"
  },
  "currency": {
   "IRR": "ریال",
   "USD": "دلار آمریکا",
   "EUR": "یورو",
   "AED": "درهم امارات",
   "CNY": "یوان چین",
   "GBP": "پوند بریتانیا",
   "TRY": "لیر ترکیه"
  }
 },
 "sales_lead_apply": {
  "mode": {
   "save": "ثبت / ویرایش سرنخ",
   "stage": "تغییر مرحله",
   "activity": "ثبت تماس و پیگیری",
   "assign": "انتقال مسئولیت",
   "lose": "ثبت فروش ازدست‌رفته",
   "reopen": "بازگشایی",
   "link_order": "اتصال سفارش موجود"
  },
  "source": {
   "phone": "تماس تلفنی",
   "website": "وب‌سایت",
   "exhibition": "نمایشگاه",
   "referral": "معرفی",
   "social": "شبکه اجتماعی",
   "visit": "مراجعه حضوری",
   "other": "سایر"
  },
  "segment": {
   "home": "خانگی",
   "hospital": "بیمارستانی"
  },
  "stage": {
   "new": "جدید",
   "contacted": "تماس اولیه",
   "qualified": "نیازسنجی",
   "proposal": "ارائه پیشنهاد",
   "negotiation": "مذاکره",
   "nurture": "فعلاً آماده خرید نیست"
  },
  "activityType": {
   "call": "تماس تلفنی",
   "meeting": "جلسه",
   "email": "ایمیل",
   "message": "پیام",
   "visit": "مراجعه حضوری"
  },
  "lossReason": {
   "price": "قیمت",
   "timing": "زمان خرید",
   "competitor": "رقیب",
   "product": "محصول",
   "no_response": "عدم پاسخ",
   "other": "سایر"
  }
 },
 "personnel_apply": {
  "mode": {
   "profile_setup": "ایجاد پرونده پایه پرسنلی",
   "employee": "پرونده پرسنلی",
   "shift": "تعریف شیفت",
   "assignment": "برنامه کاری",
   "policy": "قواعد حقوق",
   "request": "درخواست جدید",
   "approve": "تأیید مرحله",
   "reject": "رد با علت",
   "withdraw": "انصراف",
   "delegate": "جانشین مدیر",
   "punch": "ثبت تردد دستی",
   "ruling": "حکم کارگزینی",
   "document": "سند پرسنلی",
   "submit": "ارسال برای تأیید",
   "publish": "تأیید و انتشار",
   "acknowledge": "مشاهده کردم",
   "period": "دوره کارکرد",
   "close_work": "تأیید و قفل کارکرد",
   "reopen_work": "بازگشایی کارکرد",
   "calculate": "محاسبه حقوق",
   "approve_payroll": "تأیید فیش",
   "approve_payment": "تأیید پرداخت",
   "pay": "ثبت پرداخت واقعی",
   "close_period": "بستن دوره",
   "cancel_calculation": "ابطال محاسبات و بازگشایی کارکرد"
  },
  "direction": {
   "in": "ورود",
   "out": "خروج"
  },
  "kind": {
   "leave": "مرخصی",
   "mission": "مأموریت",
   "correction": "اصلاح تردد",
   "overtime": "اضافه‌کاری",
   "shift": "تغییر شیفت",
   "cancel": "لغو درخواست تأییدشده",
   "profile": "اصلاح اطلاعات شخصی / حساب",
   "certificate": "گواهی اشتغال",
   "advance": "مساعده",
   "loan": "وام",
   "objection": "اعتراض به کارکرد / فیش"
  },
  "leaveType": {
   "annual": "استحقاقی",
   "sick": "استعلاجی",
   "unpaid": "بدون حقوق",
   "special": "ویژه"
  },
  "adjustments.*.kind": {
   "earning": "افزایش حقوق",
   "deduction": "کسر حقوق"
  }
 },
 "sales_network_apply": {
  "mode": {
   "assign": "تخصیص خریدار به کارشناس",
   "template": "الگوی عمومی فروش",
   "partner": "نوع همکاری و برنامه پیگیری",
   "contact": "ثبت تماس یا بازدید",
   "case": "درخواست همکاری و پشتیبانی",
   "case_update": "پیگیری / بستن پرونده",
   "contract": "قرارداد پورسانت",
   "contract_review": "بررسی مالی قرارداد",
   "commission_settlement": "درخواست تسویه پورسانت",
   "commission_review": "بررسی تسویه",
   "commission_pay": "ثبت پرداخت واقعی پورسانت",
   "commission_cancel": "لغو تسویه پرداخت‌نشده",
   "check_link": "اتصال چک به خرید"
  }
 },
 "purchase_shipment_apply": {
  "mode": {
   "specifications": "ثبت مشخصات",
   "create": "ایجاد پرونده",
   "register": "ثبت اطلاعات",
   "permit": "ثبت مجوز",
   "actual": "ثبت اطلاعات واقعی",
   "historical": "ثبت سابقه",
   "amend": "اصلاح ثبت سفارش"
  }
 },
 "upload_purchase_shipment_file": {
  "kind": {
   "proforma": "پروفرما",
   "invoice": "فاکتور",
   "packing": "فهرست بسته‌بندی",
   "green_sheet": "برگ سبز گمرکی",
   "permit": "مجوز",
   "registration": "ثبت سفارش",
   "technical": "مدرک فنی"
  }
 },
 "apply_qms_record": {
  "mode": {
   "save": "ثبت / ویرایش پرونده کیفیت",
   "submit": "ارسال برای بررسی",
   "approve": "تأیید مستقل",
   "return": "برگشت برای اصلاح",
   "close": "ثبت اثربخشی و بستن",
   "revise": "ساخت نسخه جدید",
   "acknowledge": "مطالعه کردم",
   "hold": "توقف آزادسازی",
   "install_positions": "ایجاد سمت‌های تضمین کیفیت"
  }
 },
 "manage_qms_file": {
  "mode": {
   "start": "شروع",
   "complete": "تکمیل بارگذاری",
   "cancel": "لغو"
  }
 },
 "foreign_purchase_apply": {
  "mode": {
   "selection_create": "جست‌وجوی جدید تأمین‌کننده",
   "selection_candidate": "انتخاب منبع و درخواست نمونه",
   "sample_received": "ثبت دریافت نمونه",
   "sample_review": "تأیید یا رد نمونه و تأمین‌کننده",
   "selection_reopen": "جست‌وجوی مجدد منبع",
   "configure": "تعیین مسئول‌ها و یادآوری",
   "fx_queue": "ورود به صف تخصیص ارز",
   "fx_allocate": "ثبت تخصیص ارز",
   "fx_buy": "ثبت خرید ارز",
   "obligation_due": "تعیین / اصلاح مهلت رفع تعهد",
   "fx_receipt": "تأیید دریافت صراف از حساب",
   "fx_receipt_undo": "ابطال تطبیق دریافت",
   "obligation_close": "ثبت رفع تعهد",
   "order": "سفارش تولید به تأمین‌کننده",
   "prepayment": "ثبت پیش‌پرداخت واقعی",
   "delivery": "اصلاح وعده تحویل",
   "ready": "اعلام آمادگی بار",
   "ship": "ثبت حمل",
   "clearing": "ورود به ترخیص",
   "clear": "ثبت ترخیص",
   "receive": "تأیید دریافت انبار",
   "cost_add": "ثبت هزینه همان بار",
   "cost_review": "بررسی و تخصیص هزینه",
   "register": "ثبت سفارش سیستمی",
   "permit": "ثبت مجوز واردات",
   "actual": "ثبت قیمت و پکینگ واقعی بار",
   "amend": "اصلاح ثبت سفارش با پکینگ واقعی"
  }
 },
 "import_foreign_broker_statement": {
  "rows.*.currency": {
   "USD": "دلار آمریکا",
   "EUR": "یورو",
   "CNY": "یوان چین",
   "IRR": "ریال",
   "IRT": "تومان"
  }
 },
 "upload_foreign_purchase_file": {
  "kind": {
   "sample": "نمونه",
   "technical": "مدرک فنی",
   "proforma": "پروفرما",
   "invoice": "فاکتور",
   "packing": "فهرست بسته‌بندی",
   "green_sheet": "برگ سبز گمرکی",
   "registration": "ثبت سفارش",
   "permit": "مجوز",
   "fx_allocation": "تخصیص ارز",
   "fx_purchase": "خرید ارز",
   "fx_statement": "اکسل حساب صراف",
   "obligation": "مدرک رفع تعهد",
   "production_order": "سفارش تولید",
   "payment": "پرداخت",
   "shipping": "مدرک حمل",
   "cost": "مدرک هزینه"
  }
 }
};


toolOptions.get_service_warranty={domain:{home:'خانگی',hospital:'بیمارستانی'}};


for(const tool of ['create_user','update_user','create_password_user','update_password_user']){toolOptions[tool]={...toolOptions[tool],'permissions.assetRoles.*':{custodian:'اموال‌دار'}};}
toolOptions.assets_apply={mode:{register:'ثبت اموال',edit:'ویرایش مشخصات',transfer:'تحویل یا برگشت اموال',confirm_annual:'ثبت تأیید سالیانه',request_clearance:'درخواست تسویه اموال',approve_clearance:'تأیید تسویه اموال',cancel_clearance:'لغو تسویه اموال',install_position:'تعریف سمت اموال‌دار'},condition:{good:'سالم',repair:'نیازمند تعمیر',damaged:'آسیب‌دیده'},holderKind:{stock:'انبار / محل شرکت',employee:'کارمند شرکت',contractor:'پیمانکار'}};

Object.assign(toolOptions.purchase_payables_apply.mode,{invoice_document:'اتصال سند واقعی فاکتور',invoice_tax:'ثبت نتیجه مؤدیان'});
Object.assign(toolOptions.purchase_payables_apply,{invoiceType:{formal:'رسمی',informal:'غیررسمی'},taxState:{awaiting_seller:'در انتظار ارسال فروشنده',awaiting_review:'در انتظار بررسی خرید',accepted:'تأیید در مؤدیان',rejected:'رد در مؤدیان'}});
toolOptions.get_formal_purchase_invoices={state:toolOptions.purchase_payables_apply.taxState};

toolOptions.purchase_payables_apply.mode.invoice_classify='تعیین نوع فاکتور قدیمی';

// Treasury manual forms and assistant proposals share labels.
toolOptions.treasury_apply={currency:{IRR:'ریال',USD:'دلار آمریکا',EUR:'یورو',AED:'درهم امارات',CNY:'یوان چین',GBP:'پوند بریتانیا',TRY:'لیر ترکیه'},direction:{in:'دریافت',out:'پرداخت'},category:{purchase:'خرید از پرونده موجود',expense:'هزینه',advance:'تنخواه',foreign:'پرداخت ارزی / صراف',sales:'دریافت فروش',other:'سایر'},kind:{bank:'بانک',cash:'صندوق'},'rows.*.direction':{in:'دریافت',out:'پرداخت'}};

toolOptions.personal_reminder_apply={delegationKind:reminderDelegationKinds,mode:reminderModes,trigger:reminderTriggers,linkType:reminderLinks,eventField:reminderFields,eventCondition:reminderConditions};
toolOptions.get_reminder_links={kind:reminderLinks};

// Permission forms share the current domain role captions.
for(const fields of Object.values(toolOptions))if(fields['permissions.supplyRoles.*'])Object.assign(fields['permissions.supplyRoles.*'],supplyRoles);

toolOptions.control_purchase_technical={scope:{material:'کالا',supplier_material:'منبع تأمین کالا'},authority:{engineering:'تحقیق و توسعه',quality:'تضمین و کنترل کیفیت'},decision:{hold:'توقف خرید',release:'آزادسازی توقف',change:'تغییر مشخصات طراحی'}};

toolOptions.purchase_service_apply={'costs.*.kind':{receipt:'بچ کالای خریداری‌شده',project:'پروژه ساخت',qms:'پروژه تحقیق‌وتوسعه / کیفیت'}};

for(const name of ['create_user','create_password_user','update_user','update_password_user']){toolOptions[name] ||= {};toolOptions[name]['permissions.treasuryWorkflowRoles.*']={treasury:'خزانه‌دار',manager:'مدیر مالی',accountant:'رئیس حسابداری',ceo:'مجوز نهایی مدیرعامل'};}
for(const name of ['create_user','create_password_user','update_user','update_password_user'])for(const operation of ['financialRead','financialWrite'])toolOptions[name]['permissions.'+operation+'.*']={costing:'بهای تمام‌شده',control:'کنترل مالی',transport:'مالی حمل‌ونقل'};
for(const name of ['create_user','create_password_user','update_user','update_password_user'])toolOptions[name]['permissions.manualPrograms.*']={pricing:'پیشنهاد قیمت و سود','sales-bank':'پوز و تطبیق دریافت‌ها',treasury:'خزانه‌داری',assets:'مدیریت اموال شرکت','activation-code':'تولید کد پنج‌رقمی',qms:'کیفیت و تحقیق‌وتوسعه','routine-production':'کار روزانه و قطعات واسط','build-projects':'پروژه‌های ساخت بیمارستانی',costing:'بهای تمام‌شده',hospital:'مرکز و خدمات بیمارستانی',sales:'فروش و نمایندگان',transport:'تدارکات و حمل‌ونقل','after-sales':'خدمات پس از فروش',sourcing:'برنامه تولید و تأمین',fulfillment:'محصول نهایی و ارسال',flow:'گردش مواد و تولید',overview:'نمای کلی',analytics:'گزارش تولید و فعال‌سازی',serials:'تولید و چاپ سریال',product:'تعریف محصولات',device:'شناسنامه دستگاه‌ها',batch:'قطعات و بچ‌ها',event:'ثبت تولید',inventory:'انبارها و موجودی',service:'سوابق خدمات قبلی',action:'اقدامات اصلاحی',distribution:'نماینده و مشتری',firmware:'نسخه‌های نرم‌افزار',guarantees:'ضمانت‌نامه‌ها','finance-control':'کنترل مالی'};

for(const name of ['create_user','create_password_user','update_user','update_password_user']){toolOptions[name]['permissions.roleAssignment.roles.*']=Object.fromEntries(jobRoles.map(r=>[r.id,r.label]));toolOptions[name]['permissions.roleAssignment.warehouses.*']=toolOptions[name]['permissions.warehouses.*'];toolOptions[name]['permissions.roleAssignment.serviceDomains.*']=toolOptions[name]['permissions.serviceDomains.*'];}

toolOptions.sales_bank_apply={mode:{terminal:'اتصال پوز به خریدار',import:'ورود اکسل بانک',archive_pos:'بایگانی اکسل پوز',reconcile:'تطبیق وصول و تخصیص بدهی',reverse:'برگشت وصول متصل به بانک'}};
toolOptions.confirm_pricing_cost_basis={method:{standard:'استاندارد محاسبه‌شده',documented:'بهای تمام‌شدهٔ مستند'}};
toolOptions.save_pricing_profit_policy={scope:{product:'محصول',group:'گروه محصول'}};
toolOptions.approve_pricing_proposal={kind:{representative:'نماینده',reseller:'عامل فروش',branch:'شعبه',end_customer:'مصرف‌کننده'}};

toolOptions.sales_apply.serviceDomain={home:'خدمات خانگی',hospital:'خدمات بیمارستانی'};
toolOptions.get_representative_locations={workspace:{sales:'نمایندگی فروش',home:'خدمات خانگی',hospital:'خدمات بیمارستانی'},domain:{home:'خدمات خانگی',hospital:'خدمات بیمارستانی'}};
for(const name of ["create_user","create_password_user","update_user","update_password_user"])toolOptions[name]["permissions.manualPrograms.*"]["build-intake"]="مشخصات سفارش ساخت";
toolOptions.apply_qms_record["data.formPurpose"]={quality:"فرم داخلی کیفیت",customer_order:"مشخصات سفارش مشتری"};

for(const name of ['create_user','create_password_user','update_user','update_password_user'])if(toolOptions[name])toolOptions[name]['permissions.salesRoles.*']=salesPermissionTitles;
toolOptions.register_hospital_installation={'installation.contractStatus':{'':'نامشخص',yes:'دارای قرارداد',no:'بدون قرارداد'}};
toolOptions.save_hospital_profile_template={'fields.*.type':{text:'متن',number:'عدد'}};
toolOptions.preview_sales_bank_file={unit:{IRR:'ریال',IRT:'تومان'},profile:{auto:'تشخیص خودکار ستون‌ها',manual:'انتخاب دستی ستون‌ها'}};
toolOptions.get_record_schema={...toolOptions.get_record_schema,productionMode:{routine:'تولید روتین خانگی',project:'ساخت سفارشی بیمارستانی'}};

toolOptions.register_hospital_installation={...toolOptions.register_hospital_installation,'installation.warrantyStatus':{yes:'دارد',no:'ندارد'},'installations.*.warrantyStatus':{yes:'دارد',no:'ندارد'},'installations.*.contractStatus':{'':'نامشخص',yes:'دارد',no:'ندارد'}};
toolOptions.save_hospital_service_contract={contractStatus:{yes:'دارد',no:'ندارد'}};

toolOptions.save_material_warehouse={};

toolOptions.estimate_routine_production={method:{quantity:'بر اساس تعداد موردنیاز',people:'بر اساس افراد و زمان'}};

// Exact wire-value captions; these do not change API arguments or business rules.
toolOptions["routine_production_apply"]={...toolOptions["routine_production_apply"],
"mode":{...toolOptions["routine_production_apply"]?.["mode"],"product_version":"ثبت نسخه محصول تولیدی"},
};
toolOptions["treasury_apply"]={...toolOptions["treasury_apply"],
"mode":{...toolOptions["treasury_apply"]?.["mode"],"destination_account":"ثبت حساب مقصد","approve_destination_account":"تأیید حساب مقصد"},
};
toolOptions["print_batch_labels"]={...toolOptions["print_batch_labels"],
"location":{...toolOptions["print_batch_labels"]?.["location"],"show":"نمایش","hide":"پنهان"},
"qrContent":{...toolOptions["print_batch_labels"]?.["qrContent"],"scan":"اسکن","details":"جزئیات پرونده"},
};
toolOptions["save_label_template"]={...toolOptions["save_label_template"],
"layout":{...toolOptions["save_label_template"]?.["layout"],"roll":"رول چندستونه","thermal":"چاپگر حرارتی","a4":"برگه A4"},
"sheetSize":{...toolOptions["save_label_template"]?.["sheetSize"],"a4":"برگه A4","a3":"برگه A3"},
};
toolOptions["print_serials"]={...toolOptions["print_serials"],
"layout":{...toolOptions["print_serials"]?.["layout"],"roll":"رول چندستونه"},
};
toolOptions["create_user"]={...toolOptions["create_user"],
"permissions.financialRead.*":{...toolOptions["create_user"]?.["permissions.financialRead.*"],"accounting":"حسابداری"},
"permissions.financialWrite.*":{...toolOptions["create_user"]?.["permissions.financialWrite.*"],"accounting":"حسابداری"},
"permissions.assetRoles.*":{...toolOptions["create_user"]?.["permissions.assetRoles.*"],"disposal":"تأیید خروج اموال"},
};
toolOptions["update_user"]={...toolOptions["update_user"],
"permissions.financialRead.*":{...toolOptions["update_user"]?.["permissions.financialRead.*"],"accounting":"حسابداری"},
"permissions.financialWrite.*":{...toolOptions["update_user"]?.["permissions.financialWrite.*"],"accounting":"حسابداری"},
"permissions.assetRoles.*":{...toolOptions["update_user"]?.["permissions.assetRoles.*"],"disposal":"تأیید خروج اموال"},
};
toolOptions["service_contract_apply"]={...toolOptions["service_contract_apply"],
"mode":{...toolOptions["service_contract_apply"]?.["mode"],"renew":"ثبت تمدید قرارداد","terminate":"ثبت قطع همکاری"},
};
toolOptions["service_parts_apply"]={...toolOptions["service_parts_apply"],
"mode":{...toolOptions["service_parts_apply"]?.["mode"],"catalog_propose":"پیشنهاد قطعات مجاز یک مدل","catalog_decide":"تصمیم مدیرعامل درباره فهرست قطعات","eligibility":"مجوز تعمیر دستگاه‌های نماینده"},
};
toolOptions["service_commercial_apply"]={...toolOptions["service_commercial_apply"],
"mode":{...toolOptions["service_commercial_apply"]?.["mode"],"credit_propose":"پیشنهاد حد اعتبار نماینده","credit_decide":"بررسی حد اعتبار","part_price_propose":"پیشنهاد قیمت قطعه","part_price_decide":"بررسی مالی قیمت قطعه","work_define":"تعریف کار و زمان‌سنجی","labor_publish":"تعیین فی دقیقه و ضریب اجرت"},
};
toolOptions["get_service_payments"]={...toolOptions["get_service_payments"],
"status":{...toolOptions["get_service_payments"]?.["status"],"all":"همه","waiting":"منتظر تطبیق","review":"در حال بررسی","cleared":"تطبیق تأییدشده","rejected":"ردشده","reversed":"برگشت‌خورده"},
};
toolOptions["service_payment_apply"]={...toolOptions["service_payment_apply"],
"mode":{...toolOptions["service_payment_apply"]?.["mode"],"delete":"حذف"},
};
toolOptions["get_office_service_devices"]={...toolOptions["get_office_service_devices"],
"view":{...toolOptions["get_office_service_devices"]?.["view"],"open":"باز","history":"سوابق"},
};
toolOptions["get_service_return_parcels"]={...toolOptions["get_service_return_parcels"],
"workspace":{...toolOptions["get_service_return_parcels"]?.["workspace"],"expert":"کارشناس"},
"view":{...toolOptions["get_service_return_parcels"]?.["view"],"waiting":"منتظر اقدام","progress":"در جریان","history":"سوابق"},
};
toolOptions["service_return_parcel_apply"]={...toolOptions["service_return_parcel_apply"],
"mode":{...toolOptions["service_return_parcel_apply"]?.["mode"],"destination":"تعریف مقصد","dispatch":"ارسال / اعزام","collect":"ثبت تحویل‌گیری","receive":"ثبت دریافت"},
"result":{...toolOptions["service_return_parcel_apply"]?.["result"],"complete":"کامل","damage":"آسیب‌دیدگی","shortage":"کسری"},
};
toolOptions["get_representative_identity"]={...toolOptions["get_representative_identity"],
"kind":{...toolOptions["get_representative_identity"]?.["kind"],"sales":"فروش","service":"خدمات"},
"domain":{...toolOptions["get_representative_identity"]?.["domain"],"home":"تجهیزات خانگی","hospital":"تجهیزات بیمارستانی"},
};
toolOptions["representative_identity_apply"]={...toolOptions["representative_identity_apply"],
"kind":{...toolOptions["representative_identity_apply"]?.["kind"],"sales":"فروش","service":"خدمات"},
};
toolOptions["upload_representative_identity_file"]={...toolOptions["upload_representative_identity_file"],
"kind":{...toolOptions["upload_representative_identity_file"]?.["kind"],"sales":"فروش","service":"خدمات"},
};
toolOptions["download_representative_identity_file"]={...toolOptions["download_representative_identity_file"],
"kind":{...toolOptions["download_representative_identity_file"]?.["kind"],"sales":"فروش","service":"خدمات"},
};
toolOptions["get_representative_identity_file"]={...toolOptions["get_representative_identity_file"],
"kind":{...toolOptions["get_representative_identity_file"]?.["kind"],"sales":"فروش","service":"خدمات"},
};
toolOptions["get_driver_receipts"]={...toolOptions["get_driver_receipts"],
"domain":{...toolOptions["get_driver_receipts"]?.["domain"],"home":"تجهیزات خانگی","hospital":"تجهیزات بیمارستانی"},
"view":{...toolOptions["get_driver_receipts"]?.["view"],"driver":"راننده","intake":"پذیرش"},
"bucket":{...toolOptions["get_driver_receipts"]?.["bucket"],"active":"فعال","history":"سوابق","all":"همه"},
};
toolOptions["driver_receipt_apply"]={...toolOptions["driver_receipt_apply"],
"mode":{...toolOptions["driver_receipt_apply"]?.["mode"],"receive":"ثبت دریافت","link_case":"اتصال به پرونده خدمات"},
"domain":{...toolOptions["driver_receipt_apply"]?.["domain"],"home":"تجهیزات خانگی","hospital":"تجهیزات بیمارستانی"},
};
toolOptions["after_sales_apply"]={...toolOptions["after_sales_apply"],
"mode":{...toolOptions["after_sales_apply"]?.["mode"],"office_intake":"پذیرش دستگاه در دفتر شرکت","worklog":"ثبت اقدام سرویسکار","report_submit":"ارسال گزارش کامل تعمیر","collection_policy":"تنظیم مهلت ارسال و بررسی داغی"},
};
toolOptions["print_service_document"]={...toolOptions["print_service_document"],
"kind":{...toolOptions["print_service_document"]?.["kind"],"device_label":"لیبل دائمی دستگاه"},
"format":{...toolOptions["print_service_document"]?.["format"],"json":"داده ساخت‌یافته"},
};
toolOptions["send_inbox_attachment"]={...toolOptions["send_inbox_attachment"],
"purpose":{...toolOptions["send_inbox_attachment"]?.["purpose"],"document":"مدرک","voice":"پیام صوتی"},
};
toolOptions["create_password_user"]={...toolOptions["create_password_user"],
"permissions.financialRead.*":{...toolOptions["create_password_user"]?.["permissions.financialRead.*"],"accounting":"حسابداری"},
"permissions.financialWrite.*":{...toolOptions["create_password_user"]?.["permissions.financialWrite.*"],"accounting":"حسابداری"},
"permissions.assetRoles.*":{...toolOptions["create_password_user"]?.["permissions.assetRoles.*"],"disposal":"تأیید خروج اموال"},
};
toolOptions["update_password_user"]={...toolOptions["update_password_user"],
"permissions.financialRead.*":{...toolOptions["update_password_user"]?.["permissions.financialRead.*"],"accounting":"حسابداری"},
"permissions.financialWrite.*":{...toolOptions["update_password_user"]?.["permissions.financialWrite.*"],"accounting":"حسابداری"},
"permissions.assetRoles.*":{...toolOptions["update_password_user"]?.["permissions.assetRoles.*"],"disposal":"تأیید خروج اموال"},
};
toolOptions["estimate_finished_production"]={...toolOptions["estimate_finished_production"],
"method":{...toolOptions["estimate_finished_production"]?.["method"],"quantity":"بر اساس تعداد موردنیاز","people":"بر اساس افراد و زمان"},
};
toolOptions["create_daily_production_plan"]={...toolOptions["create_daily_production_plan"],
"method":{...toolOptions["create_daily_production_plan"]?.["method"],"quantity":"بر اساس تعداد موردنیاز","people":"بر اساس افراد و زمان"},
};
toolOptions["resolve_finished_handoff_shortage"]={...toolOptions["resolve_finished_handoff_shortage"],
"action":{...toolOptions["resolve_finished_handoff_shortage"]?.["action"],"resend":"ارسال مجدد","escalate_shortage":"ارجاع کسری برای پیگیری","found_device":"ثبت پیدا شدن دستگاه","propose_parts":"پیشنهاد قطعات جایگزین","report_loss":"اعلام مفقودی","confirm_parts":"تأیید قطعات جایگزین","return_parts":"برگشت پیشنهاد قطعات","review_loss":"بررسی مفقودی","approve_loss":"تأیید مفقودی","return_loss":"برگشت بررسی مفقودی"},
};
toolOptions["get_driver_workspace"]={...toolOptions["get_driver_workspace"],
"view":{...toolOptions["get_driver_workspace"]?.["view"],"active":"فعال","work":"کار جاری","history":"سوابق"},
};
toolOptions["get_finished_shipping_package"]={...toolOptions["get_finished_shipping_package"],
"format":{...toolOptions["get_finished_shipping_package"]?.["format"],"json":"داده ساخت‌یافته","print":"نسخه چاپی"},
};
toolOptions["sales_apply"]={...toolOptions["sales_apply"],
"custodyKind":{...toolOptions["sales_apply"]?.["custodyKind"],"demo":"دستگاه نمایشی","equipment":"تجهیزات","other":"سایر"},
"condition":{...toolOptions["sales_apply"]?.["condition"],"good":"سالم","damaged":"آسیب‌دیده","repair":"نیازمند تعمیر"},
"checkEvidence":{...toolOptions["sales_apply"]?.["checkEvidence"],"physical":"مدرک فیزیکی","registry":"استعلام ثبت‌شده"},
"mode":{...toolOptions["sales_apply"]?.["mode"],"custody_issue":"ثبت تحویل امانی","custody_recall":"شروع جمع‌آوری امانت‌ها","custody_cancel_recall":"لغو جمع‌آوری امانت‌ها","custody_return":"ثبت دریافت امانت","order_finance_review":"بررسی مالی سفارش دارای بدهی معوق","check_disposition_request":"درخواست تعیین تکلیف چک","check_disposition_review":"رسیدگی مالی به چک"},
"checkPurpose":{...toolOptions["sales_apply"]?.["checkPurpose"],"payment":"ثبت پرداخت","collateral":"تضمین"},
"disposition":{...toolOptions["sales_apply"]?.["disposition"],"return":"برگشت برای اصلاح","collateral":"تضمین"},
"resolution":{...toolOptions["sales_apply"]?.["resolution"],"refund":"استرداد وجه","replacement":"جایگزینی"},
};
toolOptions["apply_sales_return"]={...toolOptions["apply_sales_return"],
"mode":{...toolOptions["apply_sales_return"]?.["mode"],"waybill":"ثبت بارنامه برگشت","pickup":"تحویل از باربری به خدمات","inspect":"بررسی","handback":"ثبت تحویل دستگاه به نماینده","technical":"ثبت نظر فنی","factory":"ثبت دریافت در کارخانه","line":"ثبت تحویل به خط","repair":"ثبت تعمیر","quality":"ثبت کنترل کیفیت","pack":"بسته‌بندی","settle":"تسویه","refund":"ثبت استرداد وجه","reserve":"رزرو قطعات","dispatch":"ثبت ارسال جایگزین"},
"method":{...toolOptions["apply_sales_return"]?.["method"],"repair":"نیازمند تعمیر","replace":"جایگزینی"},
};
toolOptions["upload_sales_file"]={...toolOptions["upload_sales_file"],
"serviceDomain":{...toolOptions["upload_sales_file"]?.["serviceDomain"],"home":"تجهیزات خانگی"},
};
toolOptions["resolve_purchase_remainder"]={...toolOptions["resolve_purchase_remainder"],
"resolution":{...toolOptions["resolve_purchase_remainder"]?.["resolution"],"return_refund":"برگشت کالا و استرداد وجه","cancel_remainder":"لغو مانده سفارش"},
};
toolOptions["resubmit_direct_material_supply"]={...toolOptions["resubmit_direct_material_supply"],
"needPriority":{...toolOptions["resubmit_direct_material_supply"]?.["needPriority"],"critical":"بحرانی","urgent":"فوری","normal":"عادی","planned":"برنامه‌ریزی‌شده"},
"stockTreatment":{...toolOptions["resubmit_direct_material_supply"]?.["stockTreatment"],"full":"کل مقدار واردشده","subtract":"کسر موجودی آزاد"},
};
toolOptions["record_domestic_procurement_progress"]={...toolOptions["record_domestic_procurement_progress"],
"status":{...toolOptions["record_domestic_procurement_progress"]?.["status"],"searching":"در حال جست‌وجو","technical":"فنی"},
};
toolOptions["decide_procurement_escalation"]={...toolOptions["decide_procurement_escalation"],
"decision":{...toolOptions["decide_procurement_escalation"]?.["decision"],"foreign":"بازرگانی خارجی","domestic":"بازرگانی داخلی","design":"طراحی","resume":"ادامه فرایند"},
};
toolOptions["request_material_supply"]={...toolOptions["request_material_supply"],
"needPriority":{...toolOptions["request_material_supply"]?.["needPriority"],"critical":"بحرانی","urgent":"فوری","normal":"عادی","planned":"برنامه‌ریزی‌شده"},
"stockTreatment":{...toolOptions["request_material_supply"]?.["stockTreatment"],"full":"کل مقدار واردشده","subtract":"کسر موجودی آزاد"},
};
toolOptions["save_sourcing_quote"]={...toolOptions["save_sourcing_quote"],
"transportMethod":{...toolOptions["save_sourcing_quote"]?.["transportMethod"],"seller":"حمل با فروشنده","carrier":"حمل‌کننده","company":"شرکت"},
"freightStatus":{...toolOptions["save_sourcing_quote"]?.["freightStatus"],"no_charge":"بدون هزینه جداگانه برای شرکت","known":"مبلغ مشخص است","pending":"در انتظار بررسی"},
"deliveryStart":{...toolOptions["save_sourcing_quote"]?.["deliveryStart"],"confirmation":"تأیید سفارش","advance_payment":"پرداخت پیش‌پرداخت"},
};
toolOptions["upload_sourcing_quote_file"]={...toolOptions["upload_sourcing_quote_file"],
"route":{...toolOptions["upload_sourcing_quote_file"]?.["route"],"domestic":"بازرگانی داخلی","foreign":"بازرگانی خارجی"},
};
toolOptions["request_procurement_exception"]={...toolOptions["request_procurement_exception"],
"kind":{...toolOptions["request_procurement_exception"]?.["kind"],"unforeseen":"مورد پیش‌بینی‌نشده","urgent":"فوری","sole_source":"تأمین‌کننده انحصاری","contract":"قرارداد"},
};
toolOptions["decide_procurement_exception"]={...toolOptions["decide_procurement_exception"],
"decision":{...toolOptions["decide_procurement_exception"]?.["decision"],"approve":"تأیید","reject":"رد با علت","assign":"تعیین مسئول","development":"توسعه"},
"ownerRole":{...toolOptions["decide_procurement_exception"]?.["ownerRole"],"domestic":"بازرگانی داخلی","foreign":"بازرگانی خارجی","commerce_manager":"مدیر بازرگانی","finance":"مالی","inventory":"انبار","engineering":"تحقیق و توسعه"},
};
toolOptions["review_urgent_purchase_finance"]={...toolOptions["review_urgent_purchase_finance"],
"result":{...toolOptions["review_urgent_purchase_finance"]?.["result"],"pass":"قبول","fail":"رد"},
};
toolOptions["sync_rfq_suppliers"]={...toolOptions["sync_rfq_suppliers"],
"route":{...toolOptions["sync_rfq_suppliers"]?.["route"],"domestic":"بازرگانی داخلی","foreign":"بازرگانی خارجی"},
};
toolOptions["return_quote_review"]={...toolOptions["return_quote_review"],
"destination":{...toolOptions["return_quote_review"]?.["destination"],"finance":"مالی","supply":"تأمین","both":"هر دو واحد"},
};
toolOptions["answer_quote_review"]={...toolOptions["answer_quote_review"],
"role":{...toolOptions["answer_quote_review"]?.["role"],"finance":"مالی","domestic":"بازرگانی داخلی","foreign":"بازرگانی خارجی"},
};
toolOptions["propose_order_terms"]={...toolOptions["propose_order_terms"],
"deliveryStart":{...toolOptions["propose_order_terms"]?.["deliveryStart"],"confirmation":"تأیید سفارش","advance_payment":"پرداخت پیش‌پرداخت"},
};
toolOptions["review_order_terms"]={...toolOptions["review_order_terms"],
"result":{...toolOptions["review_order_terms"]?.["result"],"pass":"قبول","fail":"رد"},
};
toolOptions["acknowledge_purchase_receipt"]={...toolOptions["acknowledge_purchase_receipt"],
"stage":{...toolOptions["acknowledge_purchase_receipt"]?.["stage"],"receipt":"رسید دریافت","quality":"کنترل کیفیت"},
};
toolOptions["review_delivery_extension"]={...toolOptions["review_delivery_extension"],
"result":{...toolOptions["review_delivery_extension"]?.["result"],"pass":"قبول","fail":"رد"},
};
toolOptions["approve_order_terms"]={...toolOptions["approve_order_terms"],
"result":{...toolOptions["approve_order_terms"]?.["result"],"pass":"قبول","fail":"رد"},
};
toolOptions["purchase_settlement_apply"]={...toolOptions["purchase_settlement_apply"],
"data.freightResolution":{...toolOptions["purchase_settlement_apply"]?.["data.freightResolution"],"pending":"در انتظار بررسی","recorded":"ثبت شده","no_charge":"بدون هزینه جداگانه برای شرکت"},
"data.expenses.*.kind":{...toolOptions["purchase_settlement_apply"]?.["data.expenses.*.kind"],"freight":"هزینه حمل","other":"سایر"},
};
toolOptions["request_purchase_payment"]={...toolOptions["request_purchase_payment"],
"kind":{...toolOptions["request_purchase_payment"]?.["kind"],"advance":"پیش‌پرداخت","invoice":"فاکتور"},
};
toolOptions["review_purchase_payment"]={...toolOptions["review_purchase_payment"],
"result":{...toolOptions["review_purchase_payment"]?.["result"],"pass":"قبول","fail":"رد"},
};
toolOptions["decide_purchase_payment"]={...toolOptions["decide_purchase_payment"],
"result":{...toolOptions["decide_purchase_payment"]?.["result"],"pass":"قبول","fail":"رد"},
"destination":{...toolOptions["decide_purchase_payment"]?.["destination"],"finance":"مالی","buyer":"خریدار / مسئول خرید","both":"هر دو واحد"},
};
toolOptions["answer_purchase_payment"]={...toolOptions["answer_purchase_payment"],
"role":{...toolOptions["answer_purchase_payment"]?.["role"],"finance":"مالی","buyer":"خریدار / مسئول خرید"},
};
toolOptions["purchase_payables_apply"]={...toolOptions["purchase_payables_apply"],
"mode":{...toolOptions["purchase_payables_apply"]?.["mode"],"connect_supplier_credit":"اتصال بستانکاری تأمین‌کننده","amend_invoice_value":"اصلاح مبلغ فاکتور","offset_purchase_claim":"تهاتر مطالبه خرید"},
};
toolOptions["get_staff_missions"]={...toolOptions["get_staff_missions"],
"sourceType":{...toolOptions["get_staff_missions"]?.["sourceType"],"sales_lead":"سرنخ یا فرصت فروش","as_case":"پرونده اعلام خرابی خدمات","hospital_job":"پرونده خدمات بیمارستانی"},
"state":{...toolOptions["get_staff_missions"]?.["state"],"draft":"تکمیل برنامه اعزام","review":"بررسی مدیر","approved":"آماده شروع سفر","travelling":"سفر در حال انجام"},
"queue":{...toolOptions["get_staff_missions"]?.["queue"],"all":"همه مأموریت‌های قابل دسترسی","actionable":"کارهای قابل اقدام"},
};
toolOptions["staff_mission_apply"]={...toolOptions["staff_mission_apply"],
"mode":{...toolOptions["staff_mission_apply"]?.["mode"],"request":"ثبت نیاز به اعزام","plan":"تکمیل برنامه مأموریت","report":"ثبت گزارش بازدید","locate":"ثبت موقعیت رویداد","discrepancy":"اعلام مغایرت برنامه","submit":"ارسال برنامه برای تأیید","approve":"تأیید اعزام","return":"بازگشت برنامه برای اصلاح","start":"اعلام شروع سفر"},
"sourceType":{...toolOptions["staff_mission_apply"]?.["sourceType"],"sales_lead":"سرنخ یا فرصت فروش","as_case":"پرونده اعلام خرابی خدمات","hospital_job":"پرونده خدمات بیمارستانی"},
"outcomes.*.state":{...toolOptions["staff_mission_apply"]?.["outcomes.*.state"],"done":"انجام شد","followup":"نیازمند پیگیری","not_done":"انجام نشد"},
"status":{...toolOptions["staff_mission_apply"]?.["status"],"received":"موقعیت دریافت شد","denied":"اجازه موقعیت‌یابی داده نشده","timeout":"مهلت دریافت موقعیت تمام شد","unavailable":"موقعیت در دسترس نیست"},
};
toolOptions["personnel_apply"]={...toolOptions["personnel_apply"],
"mode":{...toolOptions["personnel_apply"]?.["mode"],"file_approve":"تأیید مدرک","file_reject":"رد مدرک با علت","family_start":"ثبت درخواست تغییر خانوادگی","family_submit":"ارسال تغییر خانوادگی برای بررسی","family_approve":"تأیید تغییر خانوادگی","family_reject":"رد تغییر خانوادگی با علت","personnel_create":"تشکیل پرونده پرسنلی","personnel_complete":"تأیید اطلاعات پرونده پرسنلی","contract_save":"ثبت قرارداد پرسنلی","contract_finalize":"نهایی‌کردن قرارداد","contract_close":"بستن قرارداد با علت"},
"familyEvent":{...toolOptions["personnel_apply"]?.["familyEvent"],"birth":"تولد فرزند","marriage":"ازدواج","divorce":"جدایی از همسر"},
"maritalStatus":{...toolOptions["personnel_apply"]?.["maritalStatus"],"single":"مجرد","married":"متأهل"},
"contractKind":{...toolOptions["personnel_apply"]?.["contractKind"],"fixed":"مدت‌دار"},
"salaryBasis":{...toolOptions["personnel_apply"]?.["salaryBasis"],"monthly":"ماهانه","daily":"روزانه","hourly":"ساعتی"},
"kind":{...toolOptions["personnel_apply"]?.["kind"],"family":"تغییر وضعیت خانوادگی"},
};
toolOptions["upload_personnel_file"]={...toolOptions["upload_personnel_file"],
"category":{...toolOptions["upload_personnel_file"]?.["category"],"spouse_page":"تصویر صفحه همسر شناسنامه","children_page":"تصویر صفحه فرزندان شناسنامه","national_card":"تصویر کارت ملی","birth_certificate":"تصویر شناسنامه","education":"مدارک تحصیلی و مهارت","signed_contract":"قرارداد امضاشده","other":"سایر"},
};
toolOptions["upload_sales_resource"]={...toolOptions["upload_sales_resource"],
"category":{...toolOptions["upload_sales_resource"]?.["category"],"catalog":"کاتالوگ","promotion":"محتوای معرفی و تبلیغ","training":"آموزش"},
"audience":{...toolOptions["upload_sales_resource"]?.["audience"],"all":"همه","representative":"نماینده","reseller":"عامل فروش"},
};
toolOptions["record_sales_call"]={...toolOptions["record_sales_call"],
"callKind":{...toolOptions["record_sales_call"]?.["callKind"],"incoming":"ورودی","partner":"همکار تجاری","outreach":"تماس با مشتری جدید"},
"result":{...toolOptions["record_sales_call"]?.["result"],"no_answer":"پاسخ نداد","interested":"علاقه‌مند به ادامه مذاکره","quote":"درخواست پیش‌فاکتور","declined":"رد شد","other":"سایر","discussed":"مذاکره انجام شد","agreed":"توافق شد","issue":"صدور","resolved":"برطرف شد"},
};
toolOptions["get_person_asset_custody"]={...toolOptions["get_person_asset_custody"],
"view":{...toolOptions["get_person_asset_custody"]?.["view"],"current":"وضعیت فعلی","history":"سوابق"},
};
toolOptions["get_asset_workflow"]={...toolOptions["get_asset_workflow"],
"view":{...toolOptions["get_asset_workflow"]?.["view"],"mine":"مربوط به من"},
};
toolOptions["apply_asset_workflow"]={...toolOptions["apply_asset_workflow"],
"mode":{...toolOptions["apply_asset_workflow"]?.["mode"],"finance_close":"تعیین تکلیف مالی خروج","attach_photo":"افزودن عکس","attach_receipt":"افزودن رسید","technical_opinion":"ثبت نظر فنی","recover":"ثبت بازیابی مال","passport":"ویرایش شناسنامه مال","group":"تعریف گروه اموال","transfer":"شروع تحویل / برگشت","approve_transfer":"مجوز انتقال","accept_transfer":"تحویل گرفتم","reject_transfer":"رد دریافت با توضیح","cancel_transfer":"لغو انتقال","confirm_presence":"تأیید موجودی نزد من","report_fault":"اعلام خرابی / توقف خطر","service_plan":"برنامه سرویس","service_start":"شروع سرویس / تعمیر","service_report":"ثبت گزارش کار","service_approve":"تأیید فنی و بازگشت به کار","meter":"ثبت کارکرد مال","disposal_request":"درخواست فروش / اسقاط / بررسی مفقودی","disposal_approve":"تصمیم نهایی خروج","delegate_disposal":"واگذاری اختیار خروج","create_link":"ساخت لینک تحویل / تأیید دوره‌ای","revoke_link":"ابطال لینک"},
"holderKind":{...toolOptions["apply_asset_workflow"]?.["holderKind"],"stock":"انبار / محل شرکت","employee":"کارمند شرکت","contractor":"پیمانکار","sales":"فروش","service":"خدمات"},
"condition":{...toolOptions["apply_asset_workflow"]?.["condition"],"good":"سالم","repair":"نیازمند تعمیر","damaged":"آسیب‌دیده"},
"assetKind":{...toolOptions["apply_asset_workflow"]?.["assetKind"],"office":"اموال اداری","mold":"قالب","machine":"ماشین‌آلات"},
"performerKind":{...toolOptions["apply_asset_workflow"]?.["performerKind"],"employee":"کارمند شرکت","contractor":"پیمانکار"},
"unit":{...toolOptions["apply_asset_workflow"]?.["unit"],"hours":"ساعت","cycles":"سیکل"},
"reason":{...toolOptions["apply_asset_workflow"]?.["reason"],"sale":"فروش","scrap":"اسقاط","lost":"مفقودی","stolen":"سرقت"},
};
toolOptions["create_asset_confirmation_link"]={...toolOptions["create_asset_confirmation_link"],
"kind":{...toolOptions["create_asset_confirmation_link"]?.["kind"],"handover":"تحویل","presence":"تأیید وجود مال"},
};
toolOptions["print_asset_document"]={...toolOptions["print_asset_document"],
"kind":{...toolOptions["print_asset_document"]?.["kind"],"label":"لیبل","receipt":"رسید دریافت"},
"format":{...toolOptions["print_asset_document"]?.["format"],"json":"داده ساخت‌یافته","html":"صفحه قابل چاپ"},
"layout":{...toolOptions["print_asset_document"]?.["layout"],"thermal":"چاپگر حرارتی","roll":"رول چندستونه","a4":"برگه A4"},
"sheetSize":{...toolOptions["print_asset_document"]?.["sheetSize"],"a4":"برگه A4","a3":"برگه A3"},
"rowAnchor":{...toolOptions["print_asset_document"]?.["rowAnchor"],"top":"بالای صفحه","middle":"وسط صفحه","bottom":"پایین صفحه"},
};
toolOptions["assets_apply"]={...toolOptions["assets_apply"],
"mode":{...toolOptions["assets_apply"]?.["mode"],"register_group":"ثبت چند مال مشابه"},
"assetKind":{...toolOptions["assets_apply"]?.["assetKind"],"office":"اموال اداری","mold":"قالب","machine":"ماشین‌آلات"},
"items.*.condition":{...toolOptions["assets_apply"]?.["items.*.condition"],"good":"سالم","repair":"نیازمند تعمیر","damaged":"آسیب‌دیده"},
};
toolOptions["upload_asset_transfer_photo"]={...toolOptions["upload_asset_transfer_photo"],
"phase":{...toolOptions["upload_asset_transfer_photo"]?.["phase"],"sender":"تحویل‌دهنده","receiver":"تحویل‌گیرنده"},
};
toolOptions["sales_bank_apply"]={...toolOptions["sales_bank_apply"],
"mode":{...toolOptions["sales_bank_apply"]?.["mode"],"resolve_transfer":"تعیین تکلیف انتقال","receiving_accounts":"حساب‌های دریافت"},
};
toolOptions["estimate_hospital_oxygen"]={...toolOptions["estimate_hospital_oxygen"],
"rows.*.kind":{...toolOptions["estimate_hospital_oxygen"]?.["rows.*.kind"],"ward":"بستری عادی","resuscitation":"احیای اورژانس","emergencyMajor":"درمان عمده یا گچ‌گیری","emergencyRecovery":"ریکاوری پس از بیهوشی","emergencyTreatment":"اتاقک یا اتاق درمان","anaesthesia":"اتاق بیهوشی، در مجموعهٔ عمل","theatre":"اتاق عمل","recovery":"ریکاوری پس از عمل","maternityMother":"اتاق زایمان و ریکاوری، مادر","maternityBaby":"اتاق زایمان و ریکاوری، نوزاد","maternityTheatre":"مجموعهٔ عمل زایمان، بیهوشی","maternityPaediatric":"مجموعهٔ عمل زایمان، پزشک نوزاد","maternityRecovery":"ریکاوری پس از بیهوشی زایمان","maternityWard":"بستری تک‌تخته یا چندتختهٔ زایمان","nursery":"اتاق نوزادان","neonatal":"مراقبت ویژهٔ نوزادان (SCBU)","radiology":"اتاق بیهوشی و اقدام تصویربرداری","critical":"مراقبت ویژه (ICU)","coronary":"مراقبت قلبی (CCU)","highDependency":"مراقبت با وابستگی بالا (HDU)","renal":"کلیه و دیالیز","cpap":"تهویهٔ CPAP","ect":"اتاق درمان با تشنج الکتریکی","ectRecovery":"ریکاوری پس از بیهوشی","acuteTreatment":"اتاق درمان","acuteRecovery":"ریکاوری پس از بیهوشی","dayWard":"بستری روزانه","dentalOne":"اتاق نوع ۱","dentalTwoThree":"اتاق نوع ۲ و ۳","dentalRecovery":"ریکاوری","outpatient":"اتاق درمان سرپایی","equipment":"اتاق سرویس تجهیزات و استریل"},
"specialUse":{...toolOptions["estimate_hospital_oxygen"]?.["specialUse"],"unknown":"نامشخص","none":"مصرف ویژه ندارد","assessed":"مصرف ویژه ارزیابی شده است"},
};
toolOptions["build_intake_apply"]={...toolOptions["build_intake_apply"],
"mode":{...toolOptions["build_intake_apply"]?.["mode"],"technical_resolve":"تعیین مشخصات فنی نهایی","accept_customer":"ثبت پذیرش مشتری","duration_request":"درخواست مدت تولید","quote_terms":"ثبت شرایط پیش‌فاکتور","ceo_duration":"تصمیم مدیرعامل درباره مدت تولید","finalize":"قطعی‌کردن"},
"channel":{...toolOptions["build_intake_apply"]?.["channel"],"phone":"تماس تلفنی","message":"پیام","email":"ایمیل","in_person":"مراجعه حضوری","letter":"نامه"},
};
toolOptions["apply_bom_effectivity"]={...toolOptions["apply_bom_effectivity"],
"mode":{...toolOptions["apply_bom_effectivity"]?.["mode"],"preview":"پیش‌نمایش","apply":"اعمال تغییرات"},
"scope":{...toolOptions["apply_bom_effectivity"]?.["scope"],"future":"سفارش‌های آینده","plans":"برنامه‌های انتخاب‌شده"},
};
toolOptions["worker_inventory_apply"]={...toolOptions["worker_inventory_apply"],
"mode":{...toolOptions["worker_inventory_apply"]?.["mode"],"allocate":"تخصیص قطعات به کارگر","return_to_line":"برگشت به انبار خط","reject_parts":"رد قطعات با علت","physical_output":"ثبت خروجی فیزیکی","receive_output":"دریافت خروجی تولید","assign_diagnosis":"ارجاع عیب‌یابی","repair_complete":"اعلام تکمیل تعمیر","declare_scrap":"اعلام ضایعات","set_buffer":"تنظیم ذخیره قطعات کارگر","count_worker":"ثبت شمارش موجودی کارگر","dispatch_scrap":"ارسال ضایعات","receive_scrap":"دریافت ضایعات","request_scrap_sale":"درخواست فروش ضایعات","package_finished":"بسته‌بندی محصول نهایی","receive_finished":"دریافت محصول نهایی","dispatch_to_central":"ارسال به انبار مرکزی","receive_from_line":"دریافت از خط تولید","revise_line_return":"اصلاح برگشت از خط","count_policy":"تنظیم قواعد شمارش"},
};
toolOptions["project_execution_apply"]={...toolOptions["project_execution_apply"],
"mode":{...toolOptions["project_execution_apply"]?.["mode"],"allocate":"تخصیص","request_quality":"ارسال برای کنترل کیفیت","reconcile":"تطبیق","approve_reconciliation":"تأیید تطبیق","return_reconciliation":"برگشت تطبیق برای اصلاح","finalize":"قطعی‌کردن"},
};
toolOptions["review_line_material_request"]={...toolOptions["review_line_material_request"],
"mode":{...toolOptions["review_line_material_request"]?.["mode"],"request_edit":"درخواست اصلاح","confirm_material_request":"تأیید درخواست مواد","agree_line_quantity":"توافق مقدار تحویل خط","return_line_discrepancy":"برگشت مغایرت خط برای اصلاح"},
};
toolOptions["inventory_count_apply"]={...toolOptions["inventory_count_apply"],
"mode":{...toolOptions["inventory_count_apply"]?.["mode"],"annual_start":"شروع شمارش سالانه","count":"ثبت شمارش","finance_approve":"تأیید مالی","ceo_approve":"تأیید مدیرعامل","resolve_discrepancy":"تعیین تکلیف مغایرت"},
};
toolOptions["receive_counted_material"]={...toolOptions["receive_counted_material"],
"noteRoles.*":{...toolOptions["receive_counted_material"]?.["noteRoles.*"],"supply":"تأمین","finance":"مالی"},
};
toolOptions["get_receipt_observations"]={...toolOptions["get_receipt_observations"],
"view":{...toolOptions["get_receipt_observations"]?.["view"],"people":"بر اساس افراد و زمان","purchase-orders":"سفارش‌های خرید"},
};
toolOptions["list_warehouse_receipts"]={...toolOptions["list_warehouse_receipts"],
"view":{...toolOptions["list_warehouse_receipts"]?.["view"],"open":"باز","history":"سوابق"},
"state":{...toolOptions["list_warehouse_receipts"]?.["state"],"awaiting_qc_template":"منتظر فرم کنترل کیفیت","pending_qc":"منتظر کنترل کیفیت","awaiting_relabel":"منتظر تعویض لیبل","awaiting_warehouse":"منتظر جانمایی در انبار","stored":"جانمایی‌شده در انبار","rejected":"ردشده"},
};
toolOptions["manage_paired_workspace"]={...toolOptions["manage_paired_workspace"],
"mode":{...toolOptions["manage_paired_workspace"]?.["mode"],"join":"پیوستن به اتصال","poll":"دریافت وضعیت اتصال","work":"کار جاری","ui":"دریافت وضعیت صفحه مشترک","fields":"ثبت اطلاعات فرم مشترک","begin":"شروع کار مشترک","finish":"پایان کار مشترک"},
"work.kind":{...toolOptions["manage_paired_workspace"]?.["work.kind"],"scan":"اسکن","navigate":"رفتن به صفحه مربوط"},
};
toolOptions["upload_subcontract_file"]={...toolOptions["upload_subcontract_file"],
"purpose":{...toolOptions["upload_subcontract_file"]?.["purpose"],"signed_receipt":"رسید امضاشده","output":"ثبت خروجی"},
};
toolOptions["get_accounting"]={...toolOptions["get_accounting"],
"view":{...toolOptions["get_accounting"]?.["view"],"trial":"تراز آزمایشی","ledger":"دفتر حساب","choices":"گزینه‌ها"},
"kind":{...toolOptions["get_accounting"]?.["kind"],"party":"طرف حساب","bank":"بانک","project":"پروژه","contract":"قرارداد","employee":"کارمند","asset":"مال"},
"state":{...toolOptions["get_accounting"]?.["state"],"pending":"در صف","exception":"نیازمند رسیدگی","posted":"ثبت قطعی شده","superseded":"نسخه پیشین","cancelled":"باطل‌شده","no_effect":"بدون اثر حسابداری"},
};
toolOptions["accounting_apply"]={...toolOptions["accounting_apply"],
"mode":{...toolOptions["accounting_apply"]?.["mode"],"setup":"تنظیم حسابداری","create_account":"تعریف حساب حسابداری","account":"ویرایش حساب","preview_rule":"پیش‌نمایش قاعده","end_rule":"پایان اعتبار قاعده","process":"پردازش صف رویدادها","reperiod_event":"انتقال رویداد به دوره مجاز","receipt_value":"تعیین ارزش رسید","manual":"پیش‌نویس سند دستی","opening":"پیش‌نویس افتتاحیه","reverse_journal":"ثبت سند معکوس","refresh_draft":"تازه‌سازی پیش‌نویس","cancel_draft":"ابطال پیش‌نویس","post_journal":"ثبت قطعی سند حسابداری","close_period":"بستن دوره"},
"level":{...toolOptions["accounting_apply"]?.["level"],"group":"گروه","general":"عمومی","subsidiary":"معین"},
"classification":{...toolOptions["accounting_apply"]?.["classification"],"asset":"دارایی","liability":"بدهی","equity":"حقوق مالکانه","income":"درآمد","expense":"هزینه","control":"حساب انتظامی / کنترلی"},
"postingMode":{...toolOptions["accounting_apply"]?.["postingMode"],"draft":"پیش‌نویس","automatic":"خودکار"},
};
toolOptions["get_purchase_returns"]={...toolOptions["get_purchase_returns"],
"view":{...toolOptions["get_purchase_returns"]?.["view"],"materials":"مواد و قطعات"},
};
toolOptions["apply_purchase_return"]={...toolOptions["apply_purchase_return"],
"mode":{...toolOptions["apply_purchase_return"]?.["mode"],"technical":"فنی","dispatch":"ارسال / اعزام","accept_return":"ثبت پذیرش مرجوعی"},
"disposition":{...toolOptions["apply_purchase_return"]?.["disposition"],"credit":"بستانکاری","replacement":"کالای جایگزین"},
"representation":{...toolOptions["apply_purchase_return"]?.["representation"],"direct":"مستقیم","credit_invoice":"بستانکاری و فاکتور جدید"},
};
toolOptions["custom_production_apply"]={...toolOptions["custom_production_apply"],
"mode":{...toolOptions["custom_production_apply"]?.["mode"],"configuration":"تعریف نسخه و انتخاب‌های محصول","payment_policy":"شرایط پرداخت محصول","product_policy":"تنظیم قواعد محصول","order_terms":"شرایط همین سفارش"},
};
toolOptions["upload_sales_word_template"]={...toolOptions["upload_sales_word_template"],
"mode":{...toolOptions["upload_sales_word_template"]?.["mode"],"image":"تصویر"},
};
toolOptions["get_sales_word_document"]={...toolOptions["get_sales_word_document"],
"kind":{...toolOptions["get_sales_word_document"]?.["kind"],"custom":"محصول سفارشی","routine":"روتین","general":"عمومی"},
"mode":{...toolOptions["get_sales_word_document"]?.["mode"],"preview":"پیش‌نمایش","issue":"صدور","template_preview":"پیش‌نمایش قالب"},
};
toolOptions["save_daily_usd_rates"]={...toolOptions["save_daily_usd_rates"],
"mode":{...toolOptions["save_daily_usd_rates"]?.["mode"],"today":"نرخ امروز","preview":"پیش‌نمایش","import":"ورود نرخ‌های تاریخی"},
};
toolOptions["save_semi_master"]={...toolOptions["save_semi_master"],
"mode":{...toolOptions["save_semi_master"]?.["mode"],"identity":"ثبت شناسنامه نیمه‌آماده","functional_template":"تعریف فرم کیفیت عملکردی"},
};
toolOptions["project_daily_work_apply"]={...toolOptions["project_daily_work_apply"],
"mode":{...toolOptions["project_daily_work_apply"]?.["mode"],"report":"گزارش"},
};
toolOptions["custom_order_price_apply"]={...toolOptions["custom_order_price_apply"],
"mode":{...toolOptions["custom_order_price_apply"]?.["mode"],"propose":"ثبت پیشنهاد","confirm_base":"تأیید قیمت نسخه پایه"},
};
toolOptions["print_asset_registration"]={...toolOptions["print_asset_registration"],
"layout":{...toolOptions["print_asset_registration"]?.["layout"],"thermal":"چاپگر حرارتی","roll":"رول چندستونه","a4":"برگه A4"},
"sheetSize":{...toolOptions["print_asset_registration"]?.["sheetSize"],"a4":"برگه A4","a3":"برگه A3"},
"rowAnchor":{...toolOptions["print_asset_registration"]?.["rowAnchor"],"top":"بالای صفحه","middle":"وسط صفحه","bottom":"پایین صفحه"},
};

// Reviewed travel return form.
toolOptions.get_staff_missions.state.return_review='بررسی پایان سفر و بازگشت';
toolOptions.staff_mission_apply.mode.finish='اعلام پایان سفر و بازگشت';
toolOptions.staff_mission_apply.returnLocation={planned:'مطابق برنامه',different:'متفاوت با برنامه'};
toolOptions.upload_staff_mission_file={...toolOptions.upload_staff_mission_file,eventKind:{report:'گزارش بازدید',finish:'اعلام پایان سفر'}};

Object.assign(toolOptions.get_staff_missions.state,{return_completion:'تکمیل توضیحات بازگشت',completed:'پایان سفر تأیید شد'});
Object.assign(toolOptions.staff_mission_apply.mode,{review_finish:'بررسی پایان سفر توسط مدیر',complete_return:'ارسال توضیح و تکمیل بازگشت'});
toolOptions.staff_mission_apply.decision={approve:'تأیید پایان سفر',request_completion:'درخواست توضیح / تکمیل'};
toolOptions.upload_staff_mission_file.eventKind.completion='توضیح و تکمیل بازگشت';

toolOptions.get_payroll_workspace={view:{periods:'دوره‌های حقوق',policies:'قواعد مصوب',slips:'فهرست فیش‌ها',slip:'فیش فرد',payments:'فهرست پرداخت',mission_report:'گزارش مأموریت‌های ماه',missions:'شواهد مأموریت فیش'},section:{reports:'گزارش سفر',points:'موقعیت‌های ثبت‌شده',files:'پیوست‌ها'}};
toolOptions.export_payroll_payment_list={format:{xlsx:'اکسل عمومی فهرست',print:'نسخه قابل چاپ'}};
Object.assign(toolOptions.personnel_apply,{familyEvent:{...toolOptions.personnel_apply.familyEvent,study:'گواهی اشتغال به تحصیل فرزند',medical:'گواهی کمیسیون پزشکی فرزند'},allowanceDivisor:{'30':'معادل ۳۰ روز',calendar:'روزهای ماه شمسی'},restPay:{paid:'با مزد طبق توافق مصوب',weekly_ratio:'به نسبت کارکرد هفته'},'benefits.*.kind':{job:'مزیت به تبع شغل',welfare:'مزیت رفاهی'},'components.*.kind':{fixed:'مزیت ماهانه',seniority:'پایه سنوات',spouse:'حق تأهل',child:'حق اولاد',overtime:'اضافه‌کاری',night:'شب‌کاری',friday:'جمعه‌کاری',shift:'نوبت‌کاری'}});
Object.assign(toolOptions.upload_personnel_file.category,{study_certificate:'گواهی اشتغال به تحصیل فرزند',medical_commission:'گواهی کمیسیون پزشکی فرزند',insurance_record:'گزارش سوابق بیمه',payroll_correction:'مستند اصلاح فیش'});

Object.assign(toolOptions.staff_mission_apply.mode,{start_work:'شروع کار در مقصد',end_work:'پایان کار در مقصد',return_start:'شروع مسیر برگشت'});

Object.assign(toolOptions.personnel_apply['components.*.kind'],{mission:'حق مأموریت؛ طبقه‌بندی بیمه و مالیات'});
