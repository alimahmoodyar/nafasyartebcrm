export const assetRoles:Record<string,string>={custodian:'اموال‌دار'};
export const assetHolderKinds:Record<string,string>={stock:'انبار / محل شرکت',employee:'کارمند شرکت',contractor:'پیمانکار'};
export const assetConditions:Record<string,string>={good:'سالم',repair:'نیازمند تعمیر',damaged:'آسیب‌دیده'};
export const assetModes=['register','edit','transfer','confirm_annual','request_clearance','approve_clearance','cancel_clearance','install_position'] as const;
export const assetHelp='اموال شرکت با کد یکتا، مشخصات و محل ثبت می‌شود. هر تحویل یا برگشت یک سابقه مستقل دارد. کارمند فقط اموال امانی خودش را می‌بیند؛ اداری فقط اموال کارکنان و تسویه، اموال‌دار همه اموال را می‌بیند. اموال پیمانکار هر سال شمسی از تاریخ تحویل یا آخرین تأیید، نامه واقعی با نام امضاکننده و فایل خصوصی می‌خواهد. تسک فقط با ثبت تأیید واقعی در پرونده بسته می‌شود. تسویه اموال ترک کار فقط پس از برگشت همه اموال توسط اموال‌دار تأیید می‌شود و جایگزین تسویه مالی نیست.';
