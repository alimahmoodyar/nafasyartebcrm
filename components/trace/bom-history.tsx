'use client';
import {formatDateTime} from '@/lib/persian-date';
type Version={id:string;version:number;created:string;actor:string;lines:string};
type Line={partCode:string;name:string;quantity:string;unit:string};
export function BomHistory({versions}:{versions:Version[]}){
 const sorted=[...versions].sort((a,b)=>b.version-a.version);
 return <section aria-label="تاریخچه تغییرات BOM"><h3>تاریخچه تغییرات BOM</h3><p className="subtle">هر ذخیره نسخه جدید می‌سازد؛ نسخه‌های قبلی و ارتباط تولیدهای ثبت‌شده با آن‌ها حفظ می‌شوند. شماره نسخه به‌تنهایی به معنای تأیید کیفیت نیست.</p>{!sorted.length&&<p>هنوز نسخه‌ای ثبت نشده است.</p>}{sorted.map((v,i)=>{
 const current=JSON.parse(v.lines) as Line[],previous=sorted[i+1]?JSON.parse(sorted[i+1].lines) as Line[]:[];
 const changes=[...current.map(line=>{const before=previous.find(p=>p.partCode===line.partCode);return {line,before,status:!before?'افزوده':before.name!==line.name||String(before.quantity)!==String(line.quantity)||before.unit!==line.unit?'تغییرکرده':'بدون تغییر'};}),...previous.filter(p=>!current.some(c=>c.partCode===p.partCode)).map(line=>({line,before:line,status:'حذف‌شده'}))];
 return <details key={v.id}><summary>نسخه {v.version.toLocaleString('fa-IR')} · {formatDateTime(v.created)}</summary><p>ثبت‌کننده: <bdi>{v.actor}</bdi></p><div style={{overflowX:'auto'}}><table className="stocktable"><caption>مقایسه با {sorted[i+1]?'نسخه '+sorted[i+1].version:'فهرست خالی (اولین نسخه)'}</caption><thead><tr><th>کد</th><th>نام</th><th>وضعیت تغییر</th><th>مقدار و واحد قبلی</th><th>مقدار و واحد این نسخه</th></tr></thead><tbody>{changes.map(({line,before,status})=><tr key={line.partCode}><td>{line.partCode}</td><td>{line.name}{before&&before.name!==line.name&&<p>نام قبلی: {before.name}</p>}</td><td>{status}</td><td>{before?before.quantity+' '+before.unit:'—'}</td><td>{status==='حذف‌شده'?'—':line.quantity+' '+line.unit}</td></tr>)}</tbody></table></div></details>;
 })}</section>;
}

