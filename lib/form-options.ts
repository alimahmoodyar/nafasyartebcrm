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

toolOptions.sales_bank_apply={mode:{terminal:'اتصال پوز به خریدار',import:'ورود اکسل بانک',reconcile:'تطبیق وصول و تخصیص بدهی',reverse:'برگشت وصول متصل به بانک'}};
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
