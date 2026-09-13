"use client";
import {useEffect, useState} from "react";
import {Plus, RefreshCw, ShieldCheck} from "lucide-react";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {modules, stages, presets, type Member, type Permissions, type Session} from "@/lib/permissions";
import {names, type Kind} from "@/lib/model";

export function UsersPanel({owner}: {owner: Session}) {
  const [members, setMembers] = useState<Member[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Member | null>(null), [busy, setBusy] = useState(false), [formError, setFormError] = useState("");
  const [email, setEmail] = useState(""), [name, setName] = useState(""), [unit, setUnit] = useState("تولید"), [status, setStatus] = useState("active");
  const [permissions, setPermissions] = useState<Permissions>(presets["تولید"]);
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {const response = await fetch("/api/users"); const result = await response.json() as {members: Member[]; error?: string}; if (!response.ok) throw new Error(result.error); setMembers(result.members);}
    catch (err) {setError(err instanceof Error ? err.message : "دریافت کاربران انجام نشد.");} finally {setLoading(false);}
  }
  useEffect(() => {void load();}, []);
  function start(member?: Member) {setEditing(member || null); setEmail(member?.email || ""); setName(member?.name || ""); setUnit(member?.unit || "تولید"); setStatus(member?.status || "active"); setPermissions(member?.permissions || presets["تولید"]); setFormError(""); setOpen(true);}
  function toggle(kind: Kind, operation: "read" | "write", enabled: boolean) {
    setPermissions(previous => {
      const next = {read: [...previous.read], write: [...previous.write], eventStages: [...previous.eventStages]};
      next[operation] = enabled ? [...new Set([...next[operation], kind])] : next[operation].filter(k => k !== kind);
      if (operation === "read" && !enabled) next.write = next.write.filter(k => k !== kind);
      if (operation === "write" && enabled) {
        next.read = [...new Set([...next.read, kind, ...(["event", "service", "action"].includes(kind) ? ["device", "batch"] as Kind[] : [])])];
        if (kind === "event" && !next.eventStages.length) next.eventStages = [...stages];
      }
      if (!next.write.includes("event")) next.eventStages = [];
      return next;
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setFormError("");
    try {
      const response = await fetch("/api/users", {method: editing ? "PATCH" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: editing?.id, revision: editing?.revision, email, name, unit, status, permissions})});
      const result = await response.json() as {member: Member; error?: string};
      if (!response.ok) throw new Error(result.error);
      setMembers(previous => [result.member, ...previous.filter(m => m.id !== result.member.id)]); setOpen(false); setMessage("دسترسی حساب ذخیره شد. هیچ دعوت‌نامه‌ای ارسال نشده است.");
    } catch (err) {setFormError(err instanceof Error ? err.message : "ذخیره حساب انجام نشد.");} finally {setBusy(false);}
  }
  return <section>
    <div className="notice"><div><strong>مدیریت حساب‌های واقعی · ورود با ChatGPT</strong><p>این بخش حتی در نمای نمونه، حساب‌های واقعی برنامه را مدیریت می‌کند. ایمیل همان حساب را تعریف کنید. برای ورود کارکنان، مدیر باید دسترسی آن‌ها به خود سایت را نیز در تنظیمات اشتراک‌گذاری بدهد. تعریف حساب در این صفحه، سایت را عمومی نمی‌کند و دعوت‌نامه نمی‌فرستد.</p></div></div>
    <div className="panel" style={{marginTop: 18}}><div className="panelhead"><div><h2>کاربران و دسترسی‌ها</h2><p className="subtle">دسترسی در سطح بخش؛ مجوز ثبت شامل ویرایش‌های مجاز همان بخش است.</p></div><div className="tools"><button className="btn" onClick={load} disabled={loading}><RefreshCw size={16}/>تازه‌سازی</button><button className="btn primary" onClick={() => start()}><Plus size={17}/>تعریف حساب</button></div></div>
      <div className="owner-account"><ShieldCheck size={22}/><div><strong>{owner.name} · مدیر اصلی</strong><p className="subtle" dir="ltr">{owner.email}</p></div><span className="badge good">دسترسی کامل · محافظت‌شده</span></div>
      {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
      {loading ? <div className="empty">در حال دریافت کاربران…</div> : members.length ? <Table><TableHeader><TableRow>{["نام و ایمیل", "واحد", "دسترسی", "وضعیت", ""].map((h, i) => <TableHead className="tablehead" key={i}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{members.map(member => <TableRow key={member.id}><TableCell className="tablecell"><strong>{member.name}</strong><p className="subtle" dir="ltr">{member.email}</p></TableCell><TableCell className="tablecell">{member.unit}</TableCell><TableCell className="tablecell"><p>مشاهده: {member.permissions.read.map(k => names[k]).join("، ") || "هیچ بخش"}</p><p className="subtle">ثبت: {member.permissions.write.map(k => names[k]).join("، ") || "فقط مشاهده"}</p></TableCell><TableCell className="tablecell"><span className={"badge " + (member.status === "active" ? "good" : "bad")}>{member.status === "active" ? "فعال" : "غیرفعال"}</span><p className="subtle">{member.userId ? "هویت ورود متصل است" : "در انتظار اولین ورود"}</p></TableCell><TableCell className="tablecell"><button className="link" onClick={() => start(member)}>ویرایش دسترسی</button></TableCell></TableRow>)}</TableBody></Table> : <div className="empty">هنوز حسابی برای کارکنان تعریف نشده است.</div>}
    </div>
    <Dialog open={open} onOpenChange={v => {if (!busy) setOpen(v);}}><DialogContent className="modal sm:max-w-2xl"><DialogTitle style={{paddingRight: 24}}>{editing ? "ویرایش دسترسی حساب" : "تعریف حساب کارکنان"}</DialogTitle><DialogDescription>ایمیل حساب ورود فرد را وارد کنید و فقط دسترسی‌های موردنیاز را فعال کنید.</DialogDescription><form onSubmit={save}><div className="formgrid">
      <label className="field">نام و نام خانوادگی<input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
      <label className="field">ایمیل حساب ChatGPT<input type="email" required dir="ltr" disabled={!!editing} maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label className="field">الگوی واحد<Select dir="rtl" value={unit} onValueChange={value => {setUnit(value); setPermissions(presets[value]);}}><SelectTrigger className="full"><SelectValue/></SelectTrigger><SelectContent>{Object.keys(presets).map(preset => <SelectItem value={preset} key={preset}>{preset}</SelectItem>)}</SelectContent></Select></label>
      <label className="field">وضعیت حساب<Select dir="rtl" value={status} onValueChange={setStatus}><SelectTrigger className="full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="active">فعال</SelectItem><SelectItem value="disabled">غیرفعال</SelectItem></SelectContent></Select></label>
    </div><div style={{marginTop: 18}}><Table><TableHeader><TableRow><TableHead className="tablehead">بخش</TableHead><TableHead className="tablehead">مشاهده</TableHead><TableHead className="tablehead">ثبت / ویرایش</TableHead></TableRow></TableHeader><TableBody>{modules.map(kind => <TableRow key={kind}><TableCell className="tablecell">{names[kind]}</TableCell><TableCell className="tablecell"><Checkbox aria-label={"مشاهده " + names[kind]} checked={permissions.read.includes(kind)} onCheckedChange={value => toggle(kind, "read", value === true)}/></TableCell><TableCell className="tablecell"><Checkbox aria-label={"ثبت " + names[kind]} checked={permissions.write.includes(kind)} onCheckedChange={value => toggle(kind, "write", value === true)}/></TableCell></TableRow>)}</TableBody></Table></div>
    {permissions.write.includes("event") && <fieldset className="stage-permissions"><legend>مراحل مجاز برای ثبت رویداد</legend>{stages.map(stage => <label key={stage}><Checkbox checked={permissions.eventStages.includes(stage)} onCheckedChange={value => setPermissions(p => ({...p, eventStages: value === true ? [...p.eventStages, stage] : p.eventStages.filter(s => s !== stage)}))}/>{stage}</label>)}</fieldset>}
    <p className="subtle" style={{marginTop: 12}}>دسترسی مشاهده، تمام فیلدهای ثبت‌شده آن بخش را شامل می‌شود. با غیرفعال‌کردن حساب، درخواست‌های بعدی کاربر رد می‌شوند.</p>
    {formError && <p className="notice error" role="alert" style={{marginTop: 12}}>{formError}</p>}<div className="tools" style={{marginTop: 18}}><button className="btn primary" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره حساب و دسترسی"}</button><button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></div></form></DialogContent></Dialog>
  </section>;
}
