"use client";
import {JobRolePicker} from "./job-role-picker";
import {IconActions} from "./program-workspace";
import {useEffect, useState} from "react";
import {Eye, EyeOff, Pencil, Plus, RefreshCw, ShieldCheck, Trash2} from "lucide-react";
import {AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction} from "@/components/ui/alert-dialog";
import {notifyAccountChange} from "@/lib/account-change";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {modules, stages, presets, jobRoles, validatePermissions, type Member, type Permissions, type Session} from "@/lib/permissions";
import {qmsRoles} from '@/lib/qms-contract';
import {assetRoles} from '@/lib/assets-contract';
import {personnelRoles} from '@/lib/personnel-contract';
import {salesRoles} from '@/lib/sales-contract';
import {transportRoles} from '@/lib/transport-contract';
import {serviceRoles,serviceDomains} from '@/lib/after-sales-labels';
import {supplyRoles} from '@/lib/sourcing-labels';
import {warehouses} from "@/lib/production";
import {names, type Kind} from "@/lib/model";

const commerceUnits = ["بازرگانی — داخلی", "بازرگانی — خارجی"];
export function UsersPanel({owner}: {owner: Session}) {
  const [members, setMembers] = useState<Member[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Member | null>(null), [busy, setBusy] = useState(false), [formError, setFormError] = useState("");
  const [email, setEmail] = useState(""), [name, setName] = useState(""), [unit, setUnit] = useState("تولید"), [status, setStatus] = useState("active");
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
  function start(member?: Member) {setEditing(member || null);setUsername(member?.username||"");setPassword("");setShowPassword(false); setEmail(member?.email || ""); setName(member?.name || ""); setUnit(member?.unit || "تولید"); setStatus(member?.status || "active"); setPermissions(member?.permissions || {read:[],write:[],eventStages:[],roleAssignment:{roles:[]}}); setRoleMode(!member||!!member.permissions.roleAssignment); setFormError(""); setOpen(true);}
  function toggle(kind: Kind, operation: "read" | "write", enabled: boolean) {
    setPermissions(previous => {
      const next = {...previous,read: [...previous.read], write: [...previous.write], eventStages: [...previous.eventStages]};
      next[operation] = enabled ? [...new Set([...next[operation], kind])] : next[operation].filter(k => k !== kind);
      if(operation==="read"&&enabled&&kind==="distribution")next.read=[...new Set([...next.read,"device" as Kind])];
      if (operation === "read" && !enabled) next.write = next.write.filter(k => k !== kind);
      if (operation === "write" && enabled) {
        next.read = [...new Set([...next.read, kind, ...(["event", "service", "action", "distribution"].includes(kind) ? ["device", "batch"] as Kind[] : [])])];
        if (kind === "device") next.read = [...new Set([...next.read, "product" as Kind])];
        if (kind === "event" && !next.eventStages.length) next.eventStages = [...stages];
      }
      if (!next.write.includes("event")) next.eventStages = [];
      return next;
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setFormError("");
    try {
      const effectivePermissions=validatePermissions(permissions);
      const response = await fetch("/api/users", {method: editing ? "PATCH" : "POST", headers: {"Content-Type": "application/json","x-assistant-account":owner.userId}, body: JSON.stringify({id: editing?.id, revision: editing?.revision, email, name, unit, status, permissions:effectivePermissions,username,password})});
      const result = await response.json() as {member: Member; error?: string;reauthenticate?:boolean};
      if (!response.ok) throw new Error(result.error);
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
      {loading ? <div className="empty">در حال دریافت کاربران…</div> : members.length ? <Table><TableHeader><TableRow>{["نام و ایمیل", "واحد", "دسترسی", "وضعیت", ""].map((h, i) => <TableHead className="tablehead" key={i}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{members.map(member => <TableRow key={member.id}><TableCell className="tablecell"><strong>{member.name}</strong><p className="subtle" dir="ltr">{member.username||member.email}</p></TableCell><TableCell className="tablecell">{member.unit}</TableCell><TableCell className="tablecell">{member.permissions.roleAssignment?<><strong>{member.permissions.roleAssignment.roles.map(id=>jobRoles.find(r=>r.id===id)?.label||id).join("، ")}</strong><p className="subtle">دسترسی خودکار بر اساس مسئولیت‌ها</p></>:<><span>دسترسی اختصاصی / قبلی</span><p className="subtle">جزئیات در ویرایش حساب</p></>}</TableCell><TableCell className="tablecell"><span className={"badge " + (member.status === "active" ? "good" : "bad")}>{member.status === "active" ? "فعال" : "غیرفعال"}</span><p className="subtle">{member.username?"ورود با نام کاربری":member.userId ? "هویت ورود متصل است" : "در انتظار اولین ورود"}</p></TableCell><TableCell className="tablecell"><IconActions scope="users-panel-actions-7facb254a5"><button type="button" className="btn" onClick={() => start(member)} aria-label={"ویرایش حساب " + member.name}><Pencil size={16}/>ویرایش</button><button type="button" className="btn account-delete-btn" disabled={member.canDelete===false} title={member.canDelete===false?"حساب مدیر اصلی یا حساب جاری قابل حذف نیست":"حذف حساب"} onClick={() => {setDeleteError("");setDeleteTarget(member);}} aria-label={"حذف حساب " + member.name}><Trash2 size={16}/>حذف</button></IconActions></TableCell></TableRow>)}</TableBody></Table> : <div className="empty">هنوز حسابی برای کارکنان تعریف نشده است.</div>}
    </div>
    <Dialog open={open} onOpenChange={v => {if (!busy) {setOpen(v);if (!v) {setPassword("");setShowPassword(false);}}}}><DialogContent className="modal sm:max-w-2xl"><DialogTitle style={{paddingRight: 24}}>{editing ? "ویرایش حساب" : "تعریف حساب کارکنان"}</DialogTitle><DialogDescription>مشخصات فرد و مسئولیت‌های او را انتخاب کنید؛ دسترسی‌های لازم خودکار تنظیم می‌شوند.</DialogDescription><form onSubmit={save}><div className="formgrid">
      <label className="field">نام و نام خانوادگی<input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
      {(!editing||editing.username)?<><label className="field">نام کاربری<input autoComplete="off" required dir="ltr" maxLength={40} value={username} onChange={e=>setUsername(e.target.value)}/></label>
        <div className="field">
          <label htmlFor="user-account-password">{editing?"رمز جدید (خالی بماند = بدون تغییر)":"رمز عبور"}</label>
          <div className="account-password-input">
            <input id="user-account-password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="new-password" spellCheck={false} autoCapitalize="none" required={!editing} minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" className="account-password-toggle" disabled={busy} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} title={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} aria-controls="user-account-password" aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={20} aria-hidden="true"/> : <Eye size={20} aria-hidden="true"/>}
            </button>
          </div>
        </div>
      </>:<label className="field">ایمیل ورود قبلی<input disabled value={email} dir="ltr"/></label>}
      <label className="field">واحد سازمانی<input required maxLength={100} value={unit} onChange={e=>setUnit(e.target.value)} placeholder="مثلاً تولید، مالی یا بازرگانی — داخلی"/><span className="subtle">واحد برای دسته‌بندی است؛ مسئولیت‌ها را در پایین انتخاب کنید.</span></label>
      {(unit === "بازرگانی" || commerceUnits.includes(unit)) && <label className="field">زیرمجموعه بازرگانی<Select dir="rtl" value={commerceUnits.includes(unit) ? unit : ""} onValueChange={setUnit}><SelectTrigger className="full"><SelectValue placeholder="داخلی یا خارجی را انتخاب کنید"/></SelectTrigger><SelectContent>{commerceUnits.map(value => <SelectItem key={value} value={value}>{value.endsWith("داخلی") ? "داخلی" : "خارجی"}</SelectItem>)}</SelectContent></Select><span className="subtle">انتخاب نقش‌های شغلی، دسترسی‌های مرتبط را تعیین می‌کند.</span></label>}
      <label className="field">وضعیت حساب<Select dir="rtl" value={status} onValueChange={setStatus}><SelectTrigger className="full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="active">فعال</SelectItem><SelectItem value="disabled" disabled={editing?.canDelete===false}>غیرفعال</SelectItem></SelectContent></Select></label>
    </div>
    {roleMode?<JobRolePicker permissions={permissions} onChange={setPermissions} salesAgents={salesAgents} serviceAgents={serviceAgents}/>:<p className="notice">دسترسی‌های فعلی این حساب حفظ می‌شود. برای تنظیم خودکار، مسئولیت‌های فرد را انتخاب کنید.</p>}
    <div className="tools" style={{marginTop:12}}><button type="button" className="btn" onClick={()=>{if(roleMode){const {roleAssignment,...manual}=permissions;setPermissions(manual);setRoleMode(false);}else{setPermissions({read:[],write:[],eventStages:[],roleAssignment:{roles:[]}});setRoleMode(true);}}}>{roleMode?'تنظیم دستی به‌جای نقش‌ها':'انتخاب مسئولیت‌ها و جایگزینی دسترسی‌ها'}</button></div>
    {!roleMode&&<details style={{marginTop:16}}><summary>تنظیمات پیشرفته دسترسی</summary><div style={{marginTop: 18}}><Table><TableHeader><TableRow><TableHead className="tablehead">بخش</TableHead><TableHead className="tablehead">مشاهده</TableHead><TableHead className="tablehead">ثبت / ویرایش</TableHead></TableRow></TableHeader><TableBody>{modules.map(kind => <TableRow key={kind}><TableCell className="tablecell">{names[kind]}</TableCell><TableCell className="tablecell"><Checkbox aria-label={"مشاهده " + names[kind]} checked={permissions.read.includes(kind)} onCheckedChange={value => toggle(kind, "read", value === true)}/></TableCell><TableCell className="tablecell"><Checkbox aria-label={"ثبت " + names[kind]} checked={permissions.write.includes(kind)} onCheckedChange={value => toggle(kind, "write", value === true)}/></TableCell></TableRow>)}</TableBody></Table></div>
    <label className="field" style={{marginTop:16}}>کنترل مالی<Select dir="rtl" value={permissions.finance||"none"} onValueChange={v=>setPermissions(p=>({...p,finance:v as Permissions["finance"]}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">بدون دسترسی</SelectItem><SelectItem value="read">مشاهده و دانلود</SelectItem><SelectItem value="write">مشاهده، بارگذاری و ثبت بررسی</SelectItem></SelectContent></Select></label>
    <fieldset className="stage-permissions"><legend>کیفیت، مجوزها و ممیزی</legend>{Object.entries(qmsRoles).map(([key,label])=><label key={key}><Checkbox checked={(permissions.qmsRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,qmsRoles:v?[...(p.qmsRoles||[]),key]:(p.qmsRoles||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset><fieldset className="stage-permissions"><legend>اموال شرکت</legend>{Object.entries(assetRoles).map(([key,label])=><label key={key}><Checkbox checked={(permissions.assetRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,assetRoles:v?[...(p.assetRoles||[]),key]:(p.assetRoles||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset><fieldset className="stage-permissions"><legend>پرسنلی و حقوق‌ودستمزد</legend>{Object.entries(personnelRoles).map(([key,label])=><label key={key}><Checkbox checked={(permissions.personnelRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,personnelRoles:v?[...(p.personnelRoles||[]),key]:(p.personnelRoles||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset><fieldset className="stage-permissions"><legend>فروش و نمایندگان</legend>{Object.entries(salesRoles).map(([key,label])=><label key={key}><Checkbox checked={(permissions.salesRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>key==='agent'&&v?{read:[],write:[],eventStages:[],finance:'none',salesRoles:['agent'],salesAgentId:''}:{...p,salesAgentId:key==='agent'?'':p.salesAgentId,salesRoles:v?[...(p.salesRoles||[]),key]:(p.salesRoles||[]).filter(x=>x!==key)})}/>{label}</label>)}</fieldset>
    {permissions.salesRoles?.includes('agent')&&<label className="field">نماینده فروش<select required value={permissions.salesAgentId||''} onChange={e=>setPermissions(p=>({...p,salesAgentId:e.target.value}))}><option value="">انتخاب نماینده فعال</option>{salesAgents.filter(a=>a.data.active).map(a=><option key={a.id} value={a.id}>{a.data.name}</option>)}</select></label>}
    <fieldset className="stage-permissions"><legend>تدارکات و حمل‌ونقل</legend>{Object.entries(transportRoles).map(([key,label])=><label key={key}><Checkbox checked={(permissions.transportRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,transportRoles:v?[...(p.transportRoles||[]),key]:(p.transportRoles||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset>
    <fieldset className="stage-permissions"><legend>حوزه خدمات پس از فروش</legend>{Object.entries(serviceDomains).map(([key,label])=><label key={key}><Checkbox checked={(permissions.serviceDomains||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,serviceDomains:v?[...(p.serviceDomains||[]),key]:(p.serviceDomains||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset>
    <fieldset className="stage-permissions"><legend>نقش خدمات (مستقل از سمت سازمانی)</legend>{Object.entries(serviceRoles).filter(([key])=>key!=='logistics').map(([key,label])=><label key={key}><Checkbox checked={(permissions.serviceRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>key==='agent'&&v?{read:[],write:[],eventStages:[],finance:'none',serviceRoles:['agent'],serviceDomains:p.serviceDomains?.length===1?p.serviceDomains:['home'],serviceAgentId:''}:{...p,serviceAgentId:key==='agent'?'':p.serviceAgentId,serviceRoles:v?[...(p.serviceRoles||[]),key]:(p.serviceRoles||[]).filter(x=>x!==key)})}/>{label}</label>)}</fieldset>
    {permissions.serviceRoles?.includes('agent')&&<label className="field">نمایندگی مربوط<select required value={permissions.serviceAgentId||''} onChange={e=>setPermissions(p=>({...p,serviceAgentId:e.target.value,serviceDomains:[serviceAgents.find(a=>a.id===e.target.value)?.data.domain||'home']}))}><option value="">انتخاب نماینده فعال</option>{serviceAgents.filter(a=>a.data.active).map(a=><option key={a.id} value={a.id}>{a.data.name} · {serviceDomains[a.data.domain]}</option>)}</select><span className="subtle">حساب نماینده فقط پرونده‌ها، موجودی و حساب خودش را می‌بیند. به این حساب دسترسی عمومی شرکت ندهید.</span></label>}
    <fieldset className="stage-permissions"><legend>نقش برنامه تولید و تأمین (مستقل از عنوان سمت)</legend>{Object.entries(supplyRoles).map(([key,label])=><label key={key}><Checkbox checked={(permissions.supplyRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,supplyRoles:v?[...(p.supplyRoles||[]),key]:(p.supplyRoles||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset><fieldset className="stage-permissions"><legend>نقش گردش مواد و تولید</legend>{Object.entries({inventory:"انبار",qc:"کنترل کیفیت",production:"تولید",procurement:"تأمین",sales:"فروش"}).map(([key,label])=><label key={key}><Checkbox checked={(permissions.flowRoles||[]).includes(key)} onCheckedChange={v=>setPermissions(p=>({...p,flowRoles:v?[...(p.flowRoles||[]),key]:(p.flowRoles||[]).filter(x=>x!==key)}))}/>{label}</label>)}</fieldset>
    {(permissions.flowRoles?.includes('inventory')||permissions.serviceRoles?.includes('inventory'))&&<fieldset className="stage-permissions"><legend>انبارهای تحت مسئولیت</legend>{warehouses.map(w=><label key={w.id}><Checkbox checked={(permissions.warehouses??['raw','line','quarantine','nonconforming']).includes(w.id)} onCheckedChange={v=>setPermissions(p=>({...p,warehouses:v?[...new Set([...(p.warehouses??['raw','line','quarantine','nonconforming']),w.id])]:(p.warehouses??['raw','line','quarantine','nonconforming']).filter(x=>x!==w.id)}))}/>{w.name}</label>)}</fieldset>}
    {permissions.write.includes("event") && <fieldset className="stage-permissions"><legend>مراحل مجاز برای ثبت رویداد</legend>{stages.map(stage => <label key={stage}><Checkbox checked={permissions.eventStages.includes(stage)} onCheckedChange={value => setPermissions(p => ({...p, eventStages: value === true ? [...p.eventStages, stage] : p.eventStages.filter(s => s !== stage)}))}/>{stage}</label>)}</fieldset>}
    <p className="subtle" style={{marginTop: 12}}>دسترسی مشاهده، تمام فیلدهای ثبت‌شده آن بخش را شامل می‌شود؛ در نسخه‌های نرم‌افزار، دانلود فایل HEX نیز مجاز می‌شود. با غیرفعال‌کردن حساب، درخواست‌های بعدی کاربر رد می‌شوند.</p>
    </details>}
    {formError && <p className="notice error" role="alert" style={{marginTop: 12}}>{formError}</p>}<div className="tools" style={{marginTop: 18}}><button className="btn primary" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره حساب و دسترسی"}</button><button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></div></form></DialogContent></Dialog>
  <AlertDialog open={!!deleteTarget} onOpenChange={v=>{if(!v&&!deleting)setDeleteTarget(null);}}>
      <AlertDialogContent dir="rtl"><AlertDialogTitle>حذف حساب «{deleteTarget?.name}»؟</AlertDialogTitle>
        <AlertDialogDescription>ورود این کاربر قطع و حساب از فهرست حذف می‌شود. سوابق تولید، خدمات، پیام‌ها و گزارش‌های ثبت‌شده او حفظ می‌شود. نام کاربری قبلی برای حفظ هویت سوابق قابل استفاده مجدد نیست. اگر کار باز یا سمت فعالی دارد، مسئول جایگزین را مشخص کنید.</AlertDialogDescription>
        <p dir="ltr" className="subtle">{deleteTarget?.username||deleteTarget?.email}</p>
        {deleteError&&<p className="notice error" role="alert">{deleteError}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={e=>{e.preventDefault();void deleteAccount();}}>{deleting?'در حال حذف…':'تأیید حذف حساب'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog></section>;
}
