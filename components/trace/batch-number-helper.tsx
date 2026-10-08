"use client";
import {IconActions} from "./program-workspace";
import {persianDigits} from '@/lib/persian-date';
import {useEffect, useState} from "react";
import {RefreshCw, Hash} from "lucide-react";
import {BATCH_SCHEME, suggestBatchNumber} from "@/lib/batch-number";

type Suggestion = ReturnType<typeof suggestBatchNumber>;
type Props = {partCode: string; date: string; code: string; scheme: string; demoCodes?: string[]; onApply: (code: string, scheme: string) => void};

export function BatchNumberHelper({partCode, date, code, scheme, demoCodes, onApply}: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setSuggestion(null); setError(""); setLoading(false);
    if (!partCode.trim() || !date) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Validate the inputs locally before requesting the authoritative list.
        const local = suggestBatchNumber(partCode, date, demoCodes || []);
        let result = local;
        if (!demoCodes) {
          const response = await fetch("/api/batch-suggestion?" + new URLSearchParams({partCode, date}), {signal: controller.signal});
          const payload = await response.json() as Suggestion & {error?: string};
          if (!response.ok) throw new Error(payload.error || "دریافت پیشنهاد انجام نشد.");
          result = payload;
        }
        if (!controller.signal.aborted) setSuggestion(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "دریافت پیشنهاد انجام نشد.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [partCode, date, demoCodes, revision]);

  const applied = !!suggestion && code === suggestion.code && scheme === BATCH_SCHEME;
  return <section className="batch-helper" aria-label="پیشنهاد شماره بچ">
    <div className="batch-helper-heading"><h3><Hash size={18}/>پیشنهاد شماره بچ داخلی</h3><span className="badge">الگوی پیشنهادی · نسخه ۱</span></div>
    <p>کد ثابت قطعه + تاریخ ورود شمسی + ترتیب بچ همان قطعه در همان روز</p>
    <div className="batch-code-example" dir="ltr"><span>1023</span><b>−</b><span>14050622</span><b>−</b><span>001</span></div>
    <p className="subtle">مثال آموزشی: قطعه ۱۰۲۳، ورود در ۲۲ شهریور ۱۴۰۵، اولین بچ آن روز. کد قطعه را از کدگذاری انبار بردارید؛ برای هر خرید عوضش نکنید.</p>
    <div className="batch-suggestion" aria-live="polite">
      {loading ? <p>در حال بررسی شماره بعدی…</p> : error ? <p role="alert" className="batch-error">{error}</p> : suggestion ? <>
        <output className="code" dir="ltr">{suggestion.code}</output>
        <p className="subtle">کد قطعه: <bdi>{suggestion.partCode}</bdi> · ورود شمسی: <bdi>{persianDigits(suggestion.jalaliDate)}</bdi> · ترتیب: <bdi>{suggestion.sequence}</bdi></p>
      </> : <p className="subtle">کد ثابت قطعه و تاریخ ورود را در فرم زیر وارد کنید تا شماره بعدی پیشنهاد شود.</p>}
    </div>
    <IconActions scope="batch-number-helper-actions-99cbaf7327"><button type="button" className="btn primary" disabled={!suggestion || loading || applied} onClick={() => suggestion && onApply(suggestion.code, suggestion.scheme)}>{applied ? "پیشنهاد در فرم قرار گرفت" : "استفاده از این پیشنهاد"}</button><button type="button" className="btn" disabled={!partCode || !date || loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={15}/>بررسی مجدد</button></IconActions>
    <p className="subtle" style={{marginTop: 12}}>این شماره تا زمان ذخیره رزرو نیست. فیلد «کد یکتای بچ» قابل‌ویرایش است؛ کد پس از ثبت ثابت می‌ماند.</p>
    <p className="subtle">هر بچ داخلی: یک نوع قطعه، یک تأمین‌کننده، یک لات سازنده و یک نوبت ورود. لات‌های متفاوت را جدا ثبت کنید. شماره لات سازنده را نیز در فیلد مستقل وارد کنید.</p>
    {scheme === BATCH_SCHEME && suggestion && !applied && <p className="batch-error">ورودی یا شماره بعدی تغییر کرده است؛ پیشنهاد جدید را بررسی و در فرم اعمال کنید.</p>}
  </section>;
}
