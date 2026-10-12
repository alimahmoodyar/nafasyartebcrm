"use client";
import {NumberInput} from '@/components/trace/number-input';
import {JobRolePicker} from "./job-role-picker";
import {ManualPermissionsPicker} from "./manual-permissions-picker";
import {IconActions} from "./program-workspace";
import {useEffect, useState} from "react";
import {Eye, EyeOff, Pencil, Plus, RefreshCw, ShieldCheck, Trash2} from "lucide-react";
import {AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction} from "@/components/ui/alert-dialog";
import {notifyAccountChange} from "@/lib/account-change";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {jobRoles, validatePermissions, toManualPermissions, type Member, type Permissions, type Session} from "@/lib/permissions";

export function UsersPanel({owner}: {owner: Session}) {
  const [members, setMembers] = useState<Member[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Member | null>(null), [busy, setBusy] = useState(false), [formError, setFormError] = useState("");
  const [email, setEmail] = useState(""), [name, setName] = useState(""), [status, setStatus] = useState("active");
  const [mobile,setMobile]=useState(""),[contactEmail,setContactEmail]=useState(""),[formConflict,setFormConflict]=useState(false);
  const [permissions, setPermissions] = useState<Permissions>({read:[],write:[],eventStages:[],roleAssignment:{roles:[]}});
  const [username,setUsername]=useState(""),[password,setPassword]=useState("");
  const [roleMode,setRoleMode]=useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteTarget,setDeleteTarget]=useState<Member|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState("");
  const [message, setMessage] = useState("");
  const [salesAgents,setSalesAgents]=useState<any[]>([]);
  const [serviceAgents,setServiceAgents]=useState<any[]>([]);
  async function load() {
    setLoading(true); setError("");
    try {const response = await fetch("/api/users"); const result = await response.json() as {members: Member[]; error?: string;accountId?:string}; if(result.accountId&&result.accountId!==owner.userId)throw new Error("حساب ورود تغییر کرده است؛ صفحه را تازه کنید."); if (!response.ok) throw new Error(result.error); setMembers(result.members);}
    catch (err) {setError(err instanceof Error ? err.message : "دریافت کاربران انجام نشد.");} finally {setLoading(false);}
  }
  useEffect(() => {void load();void fetch('/api/sales').then(r=>r.json()).then((d:any)=>setSalesAgents(d.agents||[])).catch(()=>{});void Promise.all(['home','hospital'].map(async domain=>{const r=await fetch('/api/after-sales?domain='+domain);if(!r.ok)return [];return ((await r.json()) as any).agents||[]})).then(r=>setServiceAgents(r.flat())).catch(()=>{});}, []);
  function start(member?: Member) {setEditing(member || null);setUsername(member?.username||"");setPassword("");setShowPassword(false); setEmail(member?.email || ""); setName(member?.name || ""); setStatus(member?.status || "active");setMobile(member?.mobile||"");setContactEmail(member?.contactEmail||"");setFormConflict(false); setPermissions(member?.permissions || {read:[],write:[],eventStages:[],roleAssignment:{roles:[]}}); setRoleMode(!member||!!member.permissions.roleAssignment); setFormError(""); setOpen(true);}
  async function reloadEditing(){if(!editing||busy)return;setBusy(true);setFormError("");try{const response=await fetch('/api/users',{cache:'no-store',headers:{'x-assistant-account':owner.userId}}),result=await response.json() as {members:Member[];error?:string;accountId?:string};if(result.accountId&&result.accountId!==owner.userId)throw Error('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.');if(!response.ok)throw Error(result.error||'دریافت آخرین اطلاعات حساب انجام نشد.');const member=result.members.find(m=>m.id===editing.id);if(!member)throw Error('این حساب دیگر در فهرست حساب‌ها موجود نیست.');setMembers(result.members);start(member);}catch(err){setFormError(err instanceof Error?err.message:'دریافت آخرین اطلاعات حساب انجام نشد.');}finally{setBusy(false);}}
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy||formConflict) return; setBusy(true); setFormError("");
    try {
      const effectivePermissions=validatePermissions(permissions);
      const response = await fetch("/api/users", {method: editing ? "PATCH" : "POST", headers: {"Content-Type": "application/json","x-assistant-account":owner.userId}, body: JSON.stringify({id: editing?.id, revision: editing?.revision,contactRevision:editing?editing.contactRevision??0:undefined,mobile,contactEmail, email, name, unit: editing?.unit || "کارکنان", status, permissions:effectivePermissions,username,password})});
      const result = await response.json() as {member: Member; error?: string;reauthenticate?:boolean};
      if (!response.ok) {if(response.status===409)setFormConflict(true);throw new Error(result.error);}
      setMembers(previous => [result.member, ...previous.filter(m => m.id !== result.member.id)]); setOpen(false);setPassword("");setShowPassword(false); setMessage("اطلاعات حساب ذخیره شد.");if(result.reauthenticate){notifyAccountChange();window.location.reload();}
    } catch (err) {setFormError(err instanceof Error ? err.message : "ذخیره حساب انجام نشد.");} finally {setBusy(false);}
  }
  async function deleteAccount() {
    if(!deleteTarget||deleting)return;
    setDeleting(true);setDeleteError("");
    try {
      const response=await fetch('/api/users',{method:'DELETE',headers:{'Content-Type':'application/json','x-assistant-account':owner.userId},body:JSON.stringify({id:deleteTarget.id,revision:deleteTarget.revision,confirmed:true})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||'حذف حساب انجام نشد.');
      setMembers(previous=>previous.filter(m=>m.id!==deleteTarget.id));setDeleteTarget(null);setMessage('حساب حذف و دسترسی ورود آن قطع شد؛ سوابق فعالیت حفظ شدند.');
    }catch(err){setDeleteError(err instanceof Error?err.message:'حذف حساب انجام نشد.');}finally{setDeleting(false);}
  }
  return <section>
    <div className="notice"><div><strong>مدیریت حساب‌ها · نام کاربری و رمز عبور</strong><p>برای همکاران نام کاربری و رمز عبور بسازید و دسترسی واحدشان را مشخص کنید. نام، نام کاربری، واحد، دسترسی و رمز جدید قابل ویرایش است. تغییر نام کاربری یا رمز، ورود دوباره می‌خواهد. حذف حساب، دسترسی را قطع می‌کند و سوابق فعالیت را نگه می‌دارد.</p></div></div>
    <div className="panel" style={{marginTop: 18}}><div className="panelhead"><div><h2>کاربران و دسترسی‌ها</h2><p className="subtle">دسترسی در سطح بخش؛ مجوز ثبت شامل ویرایش‌های مجاز همان بخش است.</p></div><IconActions scope="users-panel-actions-d78178440c"><button className="btn" onClick={load} disabled={loading}><RefreshCw size={16}/>تازه‌سازی</button><button className="btn primary" onClick={() => start()}><Plus size={17}/>تعریف حساب</button></IconActions></div>
      <div className="owner-account"><ShieldCheck size={22}/><div><strong>{owner.name} · مدیر اصلی</strong><p className="subtle" dir="ltr">{owner.email}</p></div><span className="badge good">دسترسی کامل · محافظت‌شده</span></div>
      {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
      {loading ? <div className="empty">در حال دریافت کاربران…</div> : members.length ? <Table><TableHeader><TableRow>{["نام و شناسه ورود", "واحد", "دسترسی", "وضعیت", ""].map((h, i) => <TableHead className="tablehead" key={i}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{members.map(member => <TableRow key={member.id}><TableCell className="tablecell"><strong>{member.name}</strong><p className="subtle" dir="ltr">{member.username||member.email}</p></TableCell><TableCell className="tablecell">{member.unit}</TableCell><TableCell className="tablecell">{member.permissions.roleAssignment?<><strong>{member.permissions.roleAssignment.roles.map(id=>jobRoles.find(r=>r.id===id)?.label||id).join("، ")}</strong><p className="subtle">دسترسی خودکار بر اساس مسئولیت‌ها</p></>:<><span>دسترسی اختصاصی / قبلی</span><p className="subtle">جزئیات در ویرایش حساب</p></>}</TableCell><TableCell className="tablecell"><span className={"badge " + (member.status === "active" ? "good" : "bad")}>{member.status === "active" ? "فعال" : "غیرفعال"}</span><p className="subtle">{member.username?"ورود با نام کاربری":member.userId ? "هویت ورود متصل است" : "در انتظار اولین ورود"}</p></TableCell><TableCell className="tablecell"><IconActions scope="users-panel-actions-7facb254a5"><button type="button" className="btn" onClick={() => start(member)} aria-label={"ویرایش حساب " + member.name}><Pencil size={16}/>ویرایش</button><button type="button" className="btn account-delete-btn" disabled={member.canDelete===false} title={member.canDelete===false?"حساب مدیر اصلی یا حساب جاری قابل حذف نیست":"حذف حساب"} onClick={() => {setDeleteError("");setDeleteTarget(member);}} aria-label={"حذف حساب " + member.name}><Trash2 size={16}/>حذف</button></IconActions></TableCell></TableRow>)}</TableBody></Table> : <div className="empty">هنوز حسابی برای کارکنان تعریف نشده است.</div>}
    </div>
    <Dialog open={open} onOpenChange={v => {if (!busy) {setOpen(v);if (!v) {setPassword("");setShowPassword(false);}}}}><DialogContent className="modal sm:max-w-2xl"><DialogTitle style={{paddingRight: 24}}>{editing ? "ویرایش حساب" : "تعریف حساب کارکنان"}</DialogTitle><DialogDescription>مشخصات فرد را وارد کنید؛ دسترسی را با انتخاب مسئولیت‌ها یا انتخاب دستی آیکون‌ها و کارهای مجاز تعیین کنید.</DialogDescription><form onSubmit={save}><div className="formgrid">
      <label className="field">نام و نام خانوادگی<NumberInput fieldKey={"name"} required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
      {(!editing||editing.username)?<><label className="field">نام کاربری<NumberInput fieldKey={"username"} autoComplete="off" required dir="ltr" maxLength={40} value={username} onChange={e=>setUsername(e.target.value)}/></label>
        <div className="field">
          <label htmlFor="user-account-password">{editing?"رمز جدید (خالی بماند = بدون تغییر)":"رمز عبور"}</label>
          <div className="account-password-input">
            <NumberInput fieldKey={"password"} id="user-account-password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="new-password" spellCheck={false} autoCapitalize="none" required={!editing} minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" className="account-password-toggle" disabled={busy} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} title={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} aria-controls="user-account-password" aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={20} aria-hidden="true"/> : <Eye size={20} aria-hidden="true"/>}
            </button>
          </div>
        </div>
      </>:<label className="field">ایمیل ورود قبلی<NumberInput fieldKey={"email"} disabled value={email} dir="ltr"/></label>}
      <label className="field">وضعیت حساب<Select dir="rtl" value={status} onValueChange={setStatus}><SelectTrigger className="full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="active">فعال</SelectItem><SelectItem value="disabled" disabled={editing?.canDelete===false}>غیرفعال</SelectItem></SelectContent></Select></label>
      <label className="field">شماره موبایل (اختیاری)<input type="tel" dir="ltr" autoComplete="tel" maxLength={24} value={mobile} onChange={e=>setMobile(e.target.value)}/></label>
      <label className="field">ایمیل تماس (اختیاری)<input type="email" dir="ltr" autoComplete="email" maxLength={254} value={contactEmail} onChange={e=>setContactEmail(e.target.value)}/></label>
    </div>
    <p className="subtle">موبایل و ایمیل تماس اختیاری‌اند. برای کارکنان شرکت، این اطلاعات با پرونده پرسنلی مشترک است؛ تغییر ایمیل تماس، اطلاعات ورود را تغییر نمی‌دهد.</p>
    <div className="tools" aria-label="روش انتخاب دسترسی" style={{marginTop:16,marginBottom:16}}>
      <button type="button" className={'btn '+(roleMode?'primary':'')} aria-pressed={roleMode} onClick={()=>{if(!roleMode){setPermissions({read:[],write:[],eventStages:[],roleAssignment:{roles:[]}});setRoleMode(true);setFormError("");}}}>انتخاب مسئولیت‌ها</button>
      <button type="button" className={'btn '+(!roleMode?'primary':'')} aria-pressed={!roleMode} onClick={()=>{if(roleMode){try{setPermissions(toManualPermissions(permissions));setRoleMode(false);setFormError("");}catch(err){setFormError(err instanceof Error?err.message:'ابتدا محدوده مسئولیت‌های انتخاب‌شده را کامل کنید.');}}}}>انتخاب دستی آیکون‌ها و دسترسی‌ها</button>
    </div>
    {roleMode?<JobRolePicker permissions={permissions} onChange={setPermissions} salesAgents={salesAgents} serviceAgents={serviceAgents}/>:<ManualPermissionsPicker permissions={permissions} onChange={setPermissions} salesAgents={salesAgents} serviceAgents={serviceAgents}/>}
    {formError && <p className="notice error" role="alert" style={{marginTop: 12}}>{formError}</p>}{formConflict&&editing&&<p role="alert">اطلاعات این حساب هم‌زمان تغییر کرده است. با دریافت آخرین اطلاعات، مقادیر واردشده در این فرم جایگزین می‌شوند.</p>}<div className="tools" style={{marginTop: 18}}><button className="btn primary" disabled={busy||formConflict}>{busy ? "در حال ذخیره…" : "ذخیره حساب و دسترسی"}</button>{formConflict&&editing&&<button type="button" className="btn" disabled={busy} onClick={()=>void reloadEditing()}>دریافت آخرین اطلاعات حساب</button>}<button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></div></form></DialogContent></Dialog>
  <AlertDialog open={!!deleteTarget} onOpenChange={v=>{if(!v&&!deleting)setDeleteTarget(null);}}>
      <AlertDialogContent dir="rtl"><AlertDialogTitle>حذف حساب «{deleteTarget?.name}»؟</AlertDialogTitle>
        <AlertDialogDescription>ورود این کاربر قطع و حساب از فهرست حذف می‌شود. سوابق تولید، خدمات، پیام‌ها و گزارش‌های ثبت‌شده او حفظ می‌شود. نام کاربری قبلی برای حفظ هویت سوابق قابل استفاده مجدد نیست. اگر کار باز یا سمت فعالی دارد، مسئول جایگزین را مشخص کنید.</AlertDialogDescription>
        <p dir="ltr" className="subtle">{deleteTarget?.username||deleteTarget?.email}</p>
        {deleteError&&<p className="notice error" role="alert">{deleteError}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={e=>{e.preventDefault();void deleteAccount();}}>{deleting?'در حال حذف…':'تأیید حذف حساب'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog></section>;
}
