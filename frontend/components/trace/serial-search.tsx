"use client";
import {useState} from "react";
import {Search, ArrowUpLeft} from "lucide-react";
import {asciiDigits} from "@/lib/batch-number";
import type {Row} from "@/lib/model";

export function SerialSearch({records, disabled, onOpen}: {records: Row[]; disabled: boolean; onOpen: (row: Row) => void}) {
  const [serial, setSerial] = useState("");
  const [matches, setMatches] = useState<Row[] | null>(null);
  const normal = (s: string) => asciiDigits(s).trim().toUpperCase();
  function search(event: React.FormEvent) {
    event.preventDefault();
    if (!normal(serial) || disabled) return;
    const devices = records.filter(r => r.kind === "device");
    const exact = devices.find(r => normal(r.data.code) === normal(serial));
    if (exact) {setMatches(null); onOpen(exact); return;}
    setMatches(devices.filter(r => normal(r.data.code).includes(normal(serial))));
  }
  return <section className="serial-panel">
    <div><h2>شناسنامه دستگاه را پیدا کن</h2><p className="subtle">سریال کامل را وارد یا با بارکدخوان تایپ کن و Enter بزن.</p></div>
    <form className="serial-form" onSubmit={search}><label className="sr-only" htmlFor="serial-lookup">سریال دستگاه</label><input id="serial-lookup" dir="ltr" autoComplete="off" placeholder="NF5-2609-001" value={serial} onChange={e => {setSerial(e.target.value); setMatches(null);}}/><button className="btn primary" type="submit" disabled={disabled || !serial.trim()}><Search size={17}/>باز کردن شناسنامه</button></form>
    {matches && <div aria-live="polite" className="serial-results">{matches.length ? <><p className="subtle">{matches.length.toLocaleString("fa-IR")} سریال مشابه پیدا شد؛ دستگاه را انتخاب کنید.</p>{matches.slice(0, 20).map(r => <button className="serial-result" key={r.id} onClick={() => onOpen(r)}><span className="code">{r.data.code}</span><span>{r.data.model}</span><ArrowUpLeft size={16}/></button>)}{matches.length > 20 && <p className="subtle">۲۰ مورد اول نمایش داده شده؛ سریال را کامل‌تر وارد کنید.</p>}</> : <p>دستگاهی با این سریال در اطلاعات قابل‌دسترسی پیدا نشد. سریال و محیط نمونه / شرکت را بررسی کنید.</p>}</div>}
  </section>;
}
