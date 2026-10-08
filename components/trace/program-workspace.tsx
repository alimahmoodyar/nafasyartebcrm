"use client";
import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,Boxes,ClipboardList,FileText,Users,Settings2,ChartNoAxesCombined,Wallet,Truck,Wrench,Factory,CalendarDays,BookOpen,Mail,ShieldCheck,type LucideIcon} from 'lucide-react';
import {PersonalHome} from './personal-home';

const AccountContext=createContext<string|null>(null);
export function LayoutAccountProvider({accountId,children}:{accountId:string;children:ReactNode}){return <AccountContext.Provider value={accountId}>{children}</AccountContext.Provider>}
type Menu={items:[string,string][];value:string;onChange:(key:string)=>void};
type WorkspaceContext={register:(menu:Menu|null)=>void;showHome:boolean;open:()=>void;reveal:()=>void;select:(key:string)=>void};
const NavigationContext=createContext<WorkspaceContext|null>(null);
export function subprogramIcon(key:string,title:string):LucideIcon{
 const text=key+' '+title;
 if(/settings|polic|تنظیم|قواعد|استاندارد/.test(text))return Settings2;
 if(/report|analysis|overview|گزارش|تحلیل/.test(text))return ChartNoAxesCombined;
 if(/account|finance|pay|cost|price|expense|settlement|حقوق|فیش|مالی|هزینه|قیمت|تسویه|پرداخت|حساب/.test(text))return Wallet;
 if(/stock|lot|material|inventory|انبار|موجودی|قطعه|کالا|قرنطینه/.test(text))return Boxes;
 if(/ship|dispatch|transport|حمل|ارسال|تحویل|گیرنده/.test(text))return Truck;
 if(/inbox|پیام/.test(text))return Mail;
 if(/employee|profile|agent|member|پرسنل|نمایند|سمت|جانشین/.test(text))return Users;
 if(/route|build|production|مونتاژ|ساخت|تولید/.test(text))return Factory;
 if(/maintenance|repair|service|تعمیر|خدمات|کارکرد/.test(text))return Wrench;
 if(/shift|period|time|day|تردد|شیفت|زمان|برنامه/.test(text))return CalendarDays;
 if(/guide|help|manual|راهنما/.test(text))return BookOpen;
 if(/quality|test|close|کنترل|کیفیت|آزمون/.test(text))return ShieldCheck;
 if(/file|document|form|سند|اسناد|فرم|احکام/.test(text))return FileText;
 return ClipboardList;
}
export function ProgramWorkspace({programId,title,direct=false,children}:{programId:string;title:string;direct?:boolean;children:ReactNode}){
 const accountId=useContext(AccountContext),[menu,setMenu]=useState<Menu|null>(null),[showHome,setShowHome]=useState(!direct);
 const register=useCallback((next:Menu|null)=>setMenu(next),[]);
 const select=useCallback((key:string)=>{if(!menu?.items.some(([id])=>id===key))return;menu.onChange(key);setShowHome(false)},[menu]);
 const open=useCallback(()=>setShowHome(true),[]);
 const reveal=useCallback(()=>setShowHome(false),[]);
 useEffect(()=>{if(direct)setShowHome(false)},[direct]);
 const navigation=useMemo(()=>accountId?({register,showHome,open,reveal,select}):null,[accountId,register,showHome,open,reveal,select]);
 const canLaunch=!!accountId&&!!menu?.items.length;
 return <NavigationContext.Provider value={navigation}><div className="program-workspace">
 {canLaunch&&showHome&&<PersonalHome key={accountId+programId} accountId={accountId} name="" scope={programId} title={title} greeting={false} shortTitles={false} apps={menu!.items.map(([key,label])=>({key,title:label,icon:subprogramIcon(key,label)}))} onNavigate={select}/>}
 <div className="program-workspace-content" hidden={canLaunch&&showHome}>{children}</div>
 </div></NavigationContext.Provider>;
}
export function SubprogramNavigation({items,value,onChange}:{items:[string,string][];value:string;onChange:(key:string)=>void}){
 const context=useContext(NavigationContext),change=useRef(onChange),previous=useRef(value);change.current=onChange;
 const signature=JSON.stringify(items),register=context?.register;
 useLayoutEffect(()=>{if(!register)return;register({items:JSON.parse(signature),value,onChange:key=>change.current(key)});return()=>register(null)},[register,signature,value]);
 useEffect(()=>{if(previous.current!==value){previous.current=value;context?.reveal()}},[value,context?.reveal]);
 if(!context)return <nav className="tools" aria-label="زیر‌برنامه‌ها">{items.map(([key,title])=><button className={'btn '+(value===key?'primary':'')} key={key} onClick={()=>onChange(key)}>{title}</button>)}</nav>;
 return <nav className="program-return tools" aria-label="مسیر زیر‌برنامه"><button className="btn" onClick={context.open}><ArrowRight size={18}/>برنامه‌های این بخش</button><strong>{items.find(([key])=>key===value)?.[1]}</strong></nav>;
}
