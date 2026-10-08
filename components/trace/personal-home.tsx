"use client";
import {cloneElement,useEffect,useState,type ReactElement} from 'react';
import {ArrowUp,ArrowDown,GripVertical,Search,Settings2,RotateCcw,type LucideIcon} from 'lucide-react';
import './personal-home.css';

type App={key:string;title:string;icon:LucideIcon;control?:ReactElement<any>};
const labels:Record<string,string>={tasks:'کارهای من',personnel:'پرسنلی',sales:'فروش',hospital:'بیمارستان',transport:'حمل‌ونقل','after-sales':'خدمات',sourcing:'تأمین',fulfillment:'ارسال',flow:'گردش مواد',overview:'گزارش کلی',inventory:'انبار',event:'ثبت تولید',serials:'سریال‌ها',device:'دستگاه‌ها',batch:'قطعات',product:'محصولات',action:'اقدامات کیفیت',service:'سوابق خدمات',firmware:'نرم‌افزار دستگاه',development:'پیشنهادها','routine-production':'کار تولید','build-projects':'پروژه‌ها','mobile-install':'نصب روی گوشی','llm-usage':'مصرف هوش مصنوعی',llm:'تنظیمات دستیار','finance-control':'کنترل مالی',finance:'حسابداری',guarantees:'ضمانت‌نامه‌ها',costing:'بهای تمام‌شده',users:'کاربران','system-reset':'پاک‌سازی آزمایشی',analytics:'گزارش تولید'};
export function PersonalHome({accountId,name,apps,onNavigate,scope='',title='خانهٔ من',greeting=true,shortTitles=true,compact=false}:{accountId:string;name:string;apps:App[];onNavigate:(key:string)=>void;scope?:string;title?:string;greeting?:boolean;shortTitles?:boolean;compact?:boolean}){
 const storageKey='nafasyar-home:v1:'+accountId+(scope?':program:'+scope:'');
 const [order,setOrder]=useState<string[]>([]),[editing,setEditing]=useState(false),[search,setSearch]=useState(''),[dragged,setDragged]=useState<string|null>(null),[notice,setNotice]=useState('');
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');setOrder(Array.isArray(saved)?saved.filter((k:unknown):k is string=>typeof k==='string'):[])}catch{setOrder([])}},[storageKey]);
 const defaults=shortTitles?[...apps].sort((a,b)=>{const priorities=['tasks','sales','hospital','routine-production','flow','inventory','after-sales','sourcing','personnel'];const rank=(key:string)=>{const i=priorities.indexOf(key);return i<0?100:i};return rank(a.key)-rank(b.key)}):apps;
 const keys=[...new Set([...order,...defaults.map(a=>a.key)])].filter(k=>apps.some(a=>a.key===k));
 const ordered=keys.flatMap(k=>apps.filter(a=>a.key===k));
 const appTitle=(a:App)=>shortTitles?(labels[a.key]||a.title):a.title;
 const filtered=ordered.filter(a=>(a.title+' '+appTitle(a)).includes(search.trim()));
 function save(next:string[]){setOrder(next);try{localStorage.setItem(storageKey,JSON.stringify(next));setNotice('چیدمان شما در این مرورگر ذخیره شد.')}catch{setNotice('ذخیره در این مرورگر ممکن نیست؛ چیدمان فقط تا بستن صفحه حفظ می‌شود.')}}
 function move(from:string,to:string){const next=[...keys],start=next.indexOf(from),end=next.indexOf(to);if(start<0||end<0||start===end)return;next.splice(start,1);next.splice(end,0,from);save(next)}
 function grid(items:App[]){return <div className="personal-app-grid">{items.map(app=>{const index=keys.indexOf(app.key);return <article className={'personal-app'+(dragged===app.key?' is-dragging':'')} key={app.key} draggable={editing&&!search} onDragStart={e=>{setDragged(app.key);e.dataTransfer.setData('text/plain',app.key);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragged(null)} onDragOver={e=>{if(editing&&!search)e.preventDefault()}} onDrop={e=>{e.preventDefault();if(editing&&!search&&dragged)move(dragged,app.key);setDragged(null)}}>
 {app.control?cloneElement(app.control,{className:'personal-app-open',title:app.title,type:'button','aria-disabled':editing||!!app.control.props.disabled,onClick:(e:any)=>{if(editing){e.preventDefault();return}app.control!.props.onClick?.(e)}},<><span className={'personal-app-icon color-'+(index%6)}><app.icon size={compact?25:30} strokeWidth={1.7} aria-hidden="true"/></span><strong>{appTitle(app)}</strong></>):<button className="personal-app-open" title={app.title} onClick={()=>{if(!editing)onNavigate(app.key)}} aria-disabled={editing}><><span className={'personal-app-icon color-'+(index%6)}><app.icon size={compact?25:30} strokeWidth={1.7} aria-hidden="true"/></span><strong>{appTitle(app)}</strong></></button>}
 {editing&&<div className="personal-app-controls"><button disabled={index===0||!!search} aria-label={'بالا بردن '+app.title} onClick={()=>move(app.key,keys[index-1])}><ArrowUp size={17}/></button><GripVertical size={17} aria-hidden="true"/><button disabled={index===keys.length-1||!!search} aria-label={'پایین بردن '+app.title} onClick={()=>move(app.key,keys[index+1])}><ArrowDown size={17}/></button></div>}
 </article>})}</div>}
 return <section className={"personal-home"+(compact?" personal-home-compact":"")} aria-label={title}><div className="personal-home-header"><div>{greeting&&<p className="subtle">{name}، خوش آمدید</p>}<h2>{title}</h2></div><button className={'btn '+(editing?'primary':'')} aria-pressed={editing} onClick={()=>{setEditing(!editing);setSearch('');setNotice('')}}><Settings2 size={18}/>{editing?'پایان چیدمان':'چیدمان صفحه'}</button></div>
 {!compact&&<label className="personal-home-search"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="پیدا کردن برنامه…" aria-label="جست‌وجوی برنامه‌ها"/></label>}
 {editing&&<div className="personal-home-help"><p>آیکون‌ها را بکشید یا با فلش‌ها جابه‌جا کنید. شش برنامهٔ اول، کارهای اصلی شما هستند.</p><button className="link" onClick={()=>save(defaults.map(a=>a.key))}><RotateCcw size={16}/>چیدمان اولیه</button></div>}
 {notice&&<p className="subtle" role="status">{notice}</p>}
 {search?grid(filtered):<>{!compact&&<h3>کارهای اصلی</h3>}{grid(ordered.slice(0,6))}{ordered.length>6&&<><h3 className="personal-other-title">سایر برنامه‌ها</h3>{grid(ordered.slice(6))}</>}</>}
 {!filtered.length&&<p className="subtle">برنامه‌ای با این عنوان پیدا نشد.</p>}
 </section>;
}
