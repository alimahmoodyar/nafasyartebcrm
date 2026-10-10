import {trainingRoles} from './training-contract';
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
 "training_workspace_request": {
  "roleId": {
   "role-0": "نقش آموزشی 1",
   "role-1": "نقش آموزشی 2",
   "role-2": "نقش آموزشی 3",
   "role-3": "نقش آموزشی 4",
   "role-4": "نقش آموزشی 5",
   "role-5": "نقش آموزشی 6",
   "role-6": "نقش آموزشی 7",
   "role-7": "نقش آموزشی 8",
   "role-8": "نقش آموزشی 9",
   "role-9": "نقش آموزشی 10",
   "role-10": "نقش آموزشی 11",
   "role-11": "نقش آموزشی 12",
   "role-12": "نقش آموزشی 13",
   "role-13": "نقش آموزشی 14",
   "role-14": "نقش آموزشی 15",
   "role-15": "نقش آموزشی 16",
   "role-16": "نقش آموزشی 17",
   "role-17": "نقش آموزشی 18",
   "role-18": "نقش آموزشی 19",
   "role-19": "نقش آموزشی 20",
   "role-20": "نقش آموزشی 21",
   "role-21": "نقش آموزشی 22",
   "role-22": "نقش آموزشی 23",
   "role-23": "نقش آموزشی 24",
   "role-24": "نقش آموزشی 25",
   "role-25": "نقش آموزشی 26",
   "role-26": "نقش آموزشی 27",
   "role-27": "نقش آموزشی 28",
   "role-28": "نقش آموزشی 29",
   "role-29": "نقش آموزشی 30",
   "role-30": "نقش آموزشی 31",
   "role-31": "نقش آموزشی 32",
   "role-32": "نقش آموزشی 33",
   "role-33": "نقش آموزشی 34",
   "role-34": "نقش آموزشی 35",
   "role-35": "نقش آموزشی 36",
   "role-36": "نقش آموزشی 37",
   "role-37": "نقش آموزشی 38",
   "role-38": "نقش آموزشی 39",
   "role-39": "نقش آموزشی 40",
   "role-40": "نقش آموزشی 41",
   "role-41": "نقش آموزشی 42",
   "role-42": "نقش آموزشی 43",
   "role-43": "نقش آموزشی 44",
   "role-44": "نقش آموزشی 45",
   "role-45": "نقش آموزشی 46",
   "role-46": "نقش آموزشی 47",
   "role-47": "نقش آموزشی 48",
   "role-48": "نقش آموزشی 49",
   "role-49": "نقش آموزشی 50",
   "role-50": "نقش آموزشی 51",
   "role-51": "نقش آموزشی 52",
   "role-52": "نقش آموزشی 53",
   "role-53": "نقش آموزشی 54"
  },
  "method": {
   "GET": "دریافت اطلاعات (GET)",
   "POST": "ثبت اطلاعات (POST)",
   "PATCH": "اصلاح اطلاعات (PATCH)",
   "DELETE": "حذف اطلاعات (DELETE)",
   "PUT": "ذخیره اطلاعات (PUT)"
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
  "state": {
   "": "انتخاب نشده",
   "new": "جدید",
   "reviewing": "در حال بررسی",
   "needs_info": "نیاز به توضیح کاربر",
   "planned": "برنامه‌ریزی‌شده",
   "done": "انجام‌شده",
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
   "done": "انجام‌شده",
   "declined": "پذیرفته‌نشده",
   "closed": "بسته‌شده"
  }
 },
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
   "treasury": "ثبت پرداخت پرسنلی"
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
   "semi": "نیمه‌ساخته",
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
   "treasury": "ثبت پرداخت پرسنلی"
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
   "semi": "نیمه‌ساخته",
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
  "lines.*.unit": {
   "عدد": "عدد",
   "کیلوگرم": "کیلوگرم",
   "گرم": "گرم",
   "متر": "متر",
   "سانتی‌متر": "سانتی‌متر",
   "سانتی‌متر مربع": "سانتی‌متر مربع",
   "لیتر": "لیتر"
  }
 },
 "commit_bom_import": {
  "lines.*.unit": {
   "عدد": "عدد",
   "کیلوگرم": "کیلوگرم",
   "گرم": "گرم",
   "متر": "متر",
   "سانتی‌متر": "سانتی‌متر",
   "سانتی‌متر مربع": "سانتی‌متر مربع",
   "لیتر": "لیتر"
  }
 },
 "save_product_bom": {
  "lines.*.unit": {
   "عدد": "عدد",
   "کیلوگرم": "کیلوگرم",
   "گرم": "گرم",
   "متر": "متر",
   "سانتی‌متر": "سانتی‌متر",
   "سانتی‌متر مربع": "سانتی‌متر مربع",
   "لیتر": "لیتر"
  }
 },
 "initialize_batch_stock": {
  "to": {
   "raw": "مواد اولیه",
   "semi": "نیمه‌ساخته",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق"
  }
 },
 "move_batch_stock": {
  "from": {
   "raw": "مواد اولیه",
   "semi": "نیمه‌ساخته",
   "line": "خط تولید",
   "quarantine": "قرنطینه",
   "nonconforming": "نامنطبق"
  },
  "to": {
   "raw": "مواد اولیه",
   "semi": "نیمه‌ساخته",
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
   "treasury": "ثبت پرداخت پرسنلی"
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
   "semi": "نیمه‌ساخته",
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
   "treasury": "ثبت پرداخت پرسنلی"
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
   "semi": "نیمه‌ساخته",
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
  "unit": {
   "عدد": "عدد",
   "کیلوگرم": "کیلوگرم",
   "گرم": "گرم",
   "متر": "متر",
   "سانتی‌متر": "سانتی‌متر",
   "سانتی‌متر مربع": "سانتی‌متر مربع",
   "لیتر": "لیتر"
  },
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
   "agent": "نماینده",
   "representative": "نمایندگی",
   "branch": "شعبه"
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

toolOptions.training_workspace_request.roleId={"role-0":"مدیر فروش","role-1":"کارشناس فروش","role-2":"مالی فروش","role-3":"نماینده فروش","role-4":"تأمین","role-5":"مسئول تدارکات","role-6":"کارشناس تدارکات و حمل‌ونقل","role-7":"مالی","role-8":"انبار","role-9":"تولید","role-10":"کنترل کیفیت","role-11":"فروش و تحویل","role-12":"خدمات خانگی","role-13":"خدمات بیمارستانی","role-14":"نماینده خدمات","role-15":"خدمات پس از فروش","role-16":"مدیریت — فقط مشاهده","role-17":"مهندسی نرم‌افزار","role-18":"اداری و منابع انسانی","role-19":"تهیه حقوق‌ودستمزد","role-20":"تأیید حقوق و احکام","role-21":"تأیید پرداخت پرسنلی","role-22":"ثبت پرداخت پرسنلی","role-23":"مدیر تضمین کیفیت","role-24":"کارشناس تضمین کیفیت و کنترل مدارک","role-25":"مسئول کنترل کیفیت","role-26":"کارشناس مجوزها","role-27":"مسئول فنی","role-28":"مسئول تجهیزات آزمون","role-29":"ممیز داخلی","role-30":"ممیز بیرونی — فقط مشاهده","role-31":"تحقیق‌وتوسعه و مهندسی طراحی","role-32":"مدیرعامل","role-33":"مدیر بازرگانی","role-34":"بازرگانی خارجی","role-35":"مدیر سامانه","role-36":"مدیر خدمات پس از فروش","role-37":"برنامه‌ریز فروش","role-38":"مدیرعامل تأمین","role-39":"مهندس محصول","role-40":"کنترل موجودی تأمین","role-41":"کنترل مالی تأمین","role-42":"کارشناس خرید داخلی","role-43":"کارشناس خرید خارجی","role-44":"پذیرش خدمات","role-45":"تکنسین خدمات","role-46":"هماهنگ‌کننده خدمات","role-47":"انبار خدمات","role-48":"ارسال خدمات","role-49":"مالی خدمات","role-50":"مسئول مرکز بیمارستانی ۱","role-51":"مسئول مرکز بیمارستانی ۲","role-52":"تکنسین فنی بیمارستانی","role-53":"تکنسین فنی خانگی"};

toolOptions.get_service_warranty={domain:{home:'خانگی',hospital:'بیمارستانی'}};

toolOptions.training_workspace_request.roleId=Object.fromEntries(trainingRoles.map(r=>[r.id,r.name]));

for(const tool of ['create_user','update_user','create_password_user','update_password_user']){toolOptions[tool]={...toolOptions[tool],'permissions.assetRoles.*':{custodian:'اموال‌دار'}};}
toolOptions.assets_apply={mode:{register:'ثبت اموال',edit:'ویرایش مشخصات',transfer:'تحویل یا برگشت اموال',confirm_annual:'ثبت تأیید سالیانه',request_clearance:'درخواست تسویه اموال',approve_clearance:'تأیید تسویه اموال',cancel_clearance:'لغو تسویه اموال',install_position:'تعریف سمت اموال‌دار'},condition:{good:'سالم',repair:'نیازمند تعمیر',damaged:'آسیب‌دیده'},holderKind:{stock:'انبار / محل شرکت',employee:'کارمند شرکت',contractor:'پیمانکار'}};

Object.assign(toolOptions.purchase_payables_apply.mode,{invoice_document:'اتصال سند واقعی فاکتور',invoice_tax:'ثبت نتیجه مؤدیان'});
Object.assign(toolOptions.purchase_payables_apply,{invoiceType:{formal:'رسمی',informal:'غیررسمی'},taxState:{awaiting_seller:'در انتظار ارسال فروشنده',awaiting_review:'در انتظار بررسی خرید',accepted:'تأیید در مؤدیان',rejected:'رد در مؤدیان'}});
toolOptions.get_formal_purchase_invoices={state:toolOptions.purchase_payables_apply.taxState};

toolOptions.purchase_payables_apply.mode.invoice_classify='تعیین نوع فاکتور قدیمی';
