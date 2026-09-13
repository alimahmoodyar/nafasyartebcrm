/** Proposed internal receipt-lot scheme. Manufacturer lots remain separate. */
export const BATCH_SCHEME = "part-jalali-v1";

export function asciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, ch => String(ch.charCodeAt(0) >= 0x6f0 ? ch.charCodeAt(0) - 0x6f0 : ch.charCodeAt(0) - 0x660));
}

export function normalizePartCode(value: string): string {
  const code = asciiDigits(value).trim();
  if (!/^\d{2,12}$/.test(code)) throw new Error("کد ثابت قطعه را با ۲ تا ۱۲ رقم وارد کنید؛ از کد انبار موجود استفاده کنید.");
  return code; // Leading zeroes are significant inventory identifiers.
}

export function receiptDay(value: string): {compact: string; display: string} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("تاریخ ورود معتبر را انتخاب کنید.");
  const day = new Date(value + "T12:00:00Z");
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2100) {
    throw new Error("تاریخ ورود معتبر را انتخاب کنید (سال میلادی ۱۹۰۰ تا ۲۱۰۰).");
  }
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC"}).formatToParts(day);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  const year = get("year").padStart(4, "0"), month = get("month"), date = get("day");
  return {compact: year + month + date, display: `${year}/${month}/${date}`};
}

export function suggestBatchNumber(partInput: string, date: string, existingCodes: string[]) {
  const partCode = normalizePartCode(partInput);
  const day = receiptDay(date);
  const prefix = `${partCode}-${day.compact}-`;
  let maximum = 0;
  for (const raw of existingCodes) {
    const code = asciiDigits(raw).trim();
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    if (!/^\d{3,}$/.test(suffix)) continue;
    const sequence = Number(suffix);
    if (!Number.isSafeInteger(sequence) || sequence >= Number.MAX_SAFE_INTEGER) throw new Error("شماره ترتیب این گروه خارج از محدوده است؛ با مسئول سامانه بررسی کنید.");
    maximum = Math.max(maximum, sequence);
  }
  const sequence = String(maximum + 1).padStart(3, "0");
  return {code: prefix + sequence, partCode, jalaliDate: day.display, sequence, scheme: BATCH_SCHEME, reserved: false};
}

export function validateBatchIdentity(data: Record<string, string>) {
  if (data.partCode) normalizePartCode(data.partCode);
  if (!data.batchScheme) return; // Preserve legacy and explicitly manual identifiers.
  if (data.batchScheme !== BATCH_SCHEME) throw new Error("نسخه الگوی شماره‌گذاری شناخته‌شده نیست.");
  const prefix = `${normalizePartCode(data.partCode || "")}-${receiptDay(data.date).compact}-`;
  const code = asciiDigits(data.code || "").trim();
  if (!code.startsWith(prefix) || !/^\d{3,}$/.test(code.slice(prefix.length)) || Number(code.slice(prefix.length)) <= 0 || !Number.isSafeInteger(Number(code.slice(prefix.length)))) {
    throw new Error("بچ پیشنهادی با کد قطعه یا تاریخ ورود تطابق ندارد؛ پیشنهاد را دوباره دریافت کنید.");
  }
}
