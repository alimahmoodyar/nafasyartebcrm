'use client';
import {openWorkflowScan} from './workflow-scan-button';
import {useEffect,useRef,useState} from 'react';
import {Camera,Clock,ClipboardList,History,ArrowRight,Boxes,FileText,Wallet,Store,BriefcaseBusiness,PackageCheck,Inbox,ChartNoAxesCombined} from 'lucide-react';
import {CameraCodeScanner} from './camera-code-scanner';
import {ServiceReturnParcelsPanel} from './service-return-parcels-panel';
import {parseReturnCarton,returnCartonQr} from '@/lib/service-return-parcel-contract';
import './driver-dashboard.css';
import './employee-self-service.css';
type View='home'|'scan'|'waiting'|'progress'|'history';
const titles={waiting:'منتظر بررسی',progress:'بررسی ناتمام',history:'سوابق'};
export function ServiceExpertDashboard({accountKey='',headerScan=false,taskCount,taskTitles=[],onNavigate}:{accountKey?:string;headerScan?:boolean;taskCount?:number;taskTitles?:string[];onNavigate:(section:string,target?:string)=>void}){
 const [view,setView]=useState<View>('home'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[data,setData]=useState<any>(null),[code,setCode]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
 const sequence=useRef(0);
 useEffect(()=>{sequence.current++;setView('home');setCode('');setData(null);setError('');setPage(1);setQuery('');setSearch('');return()=>{sequence.current++}},[accountKey]);
 useEffect(()=>{const n=++sequence.current;setLoading(true);setError('');fetch('/api/after-sales/return-parcels?'+new URLSearchParams({workspace:'expert',view:['home','scan'].includes(view)?'waiting':view,page:String(page),q:search}),{cache:'no-store'}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error||'اطلاعات کارتن‌ها دریافت نشد.');if(n===sequence.current)setData(d)}).catch(e=>{if(n===sequence.current){setData(null);setError(e.message)}}).finally(()=>{if(n===sequence.current)setLoading(false)});return()=>{sequence.current++}},[view,page,search,reload,accountKey]);
 function change(next:View){setView(next);setPage(1);setQuery('');setSearch('');setError('');setCode('');}
 function scan(raw:string){if(!parseReturnCarton(raw)){setError('این کد، لیبل کارتن داغی نیست؛ کد روی کارتن ارسالی نماینده را اسکن کنید.');return}setError('');setCode(raw.trim());}
 function close(){setCode('');setReload(n=>n+1);}
 const tools=[
  {title:'پرونده‌ها و گزارش تعمیر',detail:'پرونده، گارانتی، گزارش و مدارک',icon:ClipboardList,target:'service-case:'},
  {title:'قطعات و سفارش نمایندگی',detail:'قطعات مجاز، مجوز تعمیر و سفارش',icon:Boxes,target:'service-parts:'},
  {title:'شناسنامهٔ نمایندگی',detail:'مشخصات و مدارک',icon:Store,target:'service-agency:'},
  {title:'قرارداد نمایندگی‌ها',detail:'ثبت، تمدید و سوابق قرارداد',icon:FileText,target:'service-contract:'},
  {title:'حساب نماینده',detail:'گردش حساب و سررسیدها',icon:Wallet,target:'service-accounts:'},
  {title:'اعتبار و تعرفه‌ها',detail:'حد اعتبار، قیمت قطعات و اجرت',icon:Wallet,target:'service-commercial:'},
  {title:'عملیات قطعات و داغی',detail:'درخواست‌ها، بسته‌ها و قطعات تعمیری',icon:PackageCheck,target:'service-orders:'},
  {title:'موجودی خدمات',detail:'موجود، رزرو و آزاد',icon:Boxes,target:'service-stock:'},
  {title:'گزارش عملکرد',detail:'آمار خدمات خانگی',icon:ChartNoAxesCombined,target:'service-reports:'},
  {title:'مأموریت‌های کاری',detail:'درخواست و پیگیری بازدید',icon:BriefcaseBusiness,target:'missions:',section:'personnel'},
 ];
 function tile(Icon:typeof Boxes,title:string,detail:string,action:()=>void){
  return <button type="button" className="employee-workspace-tile" key={title} onClick={action}>
   <span className="employee-service-icon"><Icon size={20}/></span><span><strong>{title}</strong><small>{detail}</small></span>
  </button>;
 }
 return <section className={headerScan?'employee-home':'driver-dashboard'} dir="rtl" aria-label="پنل کارشناس نمایندگی‌های خدمات خانگی">
  <header className="driver-dashboard-header">{view!=='home'&&<button data-pair-open="service-expert-dashboard:5153d70c0731" className="btn" onClick={()=>change('home')}><ArrowRight size={18}/>بازگشت به پنل کارشناس</button>}<h2>{view==='home'?'کارشناس خدمات پس از فروش خانگی (مسئول نمایندگی‌ها)':view==='scan'?'اسکن':titles[view]}</h2></header>
  {error&&<p className="notice error" role="alert">{error}<button data-pair-open="service-expert-dashboard:8034e6504336" className="btn" onClick={()=>setReload(n=>n+1)}>تلاش دوباره</button></p>}
  {view==='home'?<>
   {!headerScan&&<button type="button" className="driver-dashboard-scan" onClick={()=>openWorkflowScan()}><Camera size={34}/><span>اسکن</span><small>دریافت شرکت و بررسی قطعات مرتبط</small></button>}
   <section className="employee-workspaces" aria-label="ابزارهای نقش">
    <h3>ابزارهای نقش</h3>
    <div className="employee-workspace-grid">
     {tile(PackageCheck,'کارتن‌های داغی','دریافت و بررسی کارتن‌های نمایندگان',()=>change('waiting'))}
     {tools.map(tool=>tile(tool.icon,tool.title,tool.detail,()=>onNavigate(tool.section||'after-sales',tool.target)))}
    </div>
   </section>
   <section className="employee-home-summary" aria-label="خلاصه کارتابل نقش">
    <header><h3>خلاصه کارتابل نقش{taskCount!==undefined?' · '+taskCount.toLocaleString('fa-IR'):''}</h3>
     <button type="button" onClick={()=>onNavigate('tasks')}><Inbox size={17}/> باز کردن کارتابل نقش</button>
    </header>
    {taskTitles.slice(0,2).map((title,index)=><button type="button" className="employee-home-row" key={index} onClick={()=>onNavigate('tasks')}>{title}</button>)}
   </section>
  </>:view==='scan'?<>{!code&&<><p className="driver-dashboard-help">کد را مقابل دوربین بگیرید. تأیید یا رد هر قطعه پس از مشاهدهٔ کالا انجام می‌شود.</p><CameraCodeScanner autoStart onScan={scan}/></>}{code&&<button data-pair-open="service-expert-dashboard:d16215d40d3d" className="btn" onClick={()=>setCode('')}>اسکن کارتن دیگر</button>}</>:<><form data-pair-open="service-expert-dashboard:d1e13742a640" className="tools" onSubmit={e=>{e.preventDefault();setPage(1);setSearch(query.trim())}}><label className="field">جست‌وجوی نماینده، مرسوله، رهگیری، سریال، کد قطعه یا پرونده<input type="search" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></label><button className="btn" disabled={loading}>جست‌وجو</button></form><nav className="driver-dashboard-nav" aria-label="کارتن‌های داغی">{([['waiting',Clock],['progress',ClipboardList],['history',History]] as const).map(([key,Icon])=><button data-pair-open="service-expert-dashboard:35744afb0a9c" data-pair-item={JSON.stringify([key])} key={key} onClick={()=>change(key)}><Icon size={25}/><span>{titles[key]}</span><b>{loading?'…':data?Number(data.counts[key]||0).toLocaleString('fa-IR'):'—'}</b></button>)}</nav>{loading?<p role="status">در حال دریافت کارتن‌ها…</p>:data&&<>{!data.rows.length&&<p className="driver-dashboard-empty">کارتنی با این مشخصات در این بخش وجود ندارد.</p>}{data.rows.map((r:any)=><button className="driver-dashboard-row" key={r.parcelId+':'+r.cartonId} onClick={()=>scan(returnCartonQr(r.parcelId,r.cartonId))}><strong>{r.sender} · کارتن {Number(r.number).toLocaleString('fa-IR')}</strong><span><bdi>{r.code}</bdi> · {titles[r.bucket as keyof typeof titles]}</span><span>{Number(r.reviewed).toLocaleString('fa-IR')} از {Number(r.items).toLocaleString('fa-IR')} ردیف بررسی شده</span></button>)}{data.pages>1&&<div className="tools"><button data-pair-open="service-expert-dashboard:08aa792bb12d" className="btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>قبلی</button><span>{page} از {data.pages}</span><button data-pair-open="service-expert-dashboard:61b50137676b" className="btn" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>بعدی</button></div>}</>}</>}
  {code&&<ServiceReturnParcelsPanel expert accountKey={accountKey} initialCode={code} onClose={close} onOpenCase={id=>onNavigate('after-sales','service-case:'+id)}/>}
 </section>;
}
