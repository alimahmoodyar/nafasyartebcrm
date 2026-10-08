"use client";
import {Fragment,isValidElement,createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type ReactElement,type CSSProperties} from 'react';
import {ArrowRight,Boxes,ClipboardList,FileText,Users,Settings2,ChartNoAxesCombined,Wallet,Truck,Wrench,Factory,CalendarDays,BookOpen,Mail,ShieldCheck,type LucideIcon} from 'lucide-react';
import {PersonalHome} from './personal-home';

const AccountContext=createContext<string|null>(null);
export function LayoutAccountProvider({accountId,children}:{accountId:string;children:ReactNode}){return <AccountContext.Provider value={accountId}>{children}</AccountContext.Provider>}
type Menu={items:[string,string][];value:string;onChange:(key:string)=>void|boolean};
const ProgramPathContext=createContext('');
type WorkspaceContext={register:(menu:Menu|null)=>void;showHome:boolean;open:()=>void;reveal:()=>void;select:(key:string)=>void};
const NavigationContext=createContext<WorkspaceContext|null>(null);
export function subprogramIcon(key:string,title:string):LucideIcon{
 const text=key+' '+title;
 if(/settings|polic|تنظیم|قواعد|استاندارد/.test(text))return Settings2;
 if(/report|analysis|overview|گزارش|تحلیل/.test(text))return ChartNoAxesCombined;
 if(/account|finance|pay|cost|price|expense|settlement|حقوق|فیش|مالی|هزینه|قیمت|تسویه|پرداخت|حساب/.test(text))return Wallet;
 if(/stock|lot|material|inventory|collect|انبار|موجودی|قطعه|کالا|قرنطینه/.test(text))return Boxes;
 if(/ship|dispatch|transport|deliver|vehicle|حمل|ارسال|تحویل|گیرنده/.test(text))return Truck;
 if(/inbox|پیام/.test(text))return Mail;
 if(/employee|profile|agent|member|پرسنل|نمایند|سمت|جانشین/.test(text))return Users;
 if(/route|build|production|مونتاژ|ساخت|تولید/.test(text))return Factory;
 if(/maintenance|repair|service|تعمیر|خدمات|کارکرد/.test(text))return Wrench;
 if(/shift|period|time|day|تردد|شیفت|زمان|برنامه/.test(text))return CalendarDays;
 if(/guide|help|manual|راهنما/.test(text))return BookOpen;
 if(/quality|test|close|followup|کنترل|کیفیت|آزمون/.test(text))return ShieldCheck;
 if(/file|document|form|سند|اسناد|فرم|احکام/.test(text))return FileText;
 return ClipboardList;
}
export function ProgramWorkspace({programId,title,direct=false,children}:{programId:string;title:string;direct?:boolean;children:ReactNode}){
 const accountId=useContext(AccountContext),[menu,setMenu]=useState<Menu|null>(null),[showHome,setShowHome]=useState(!direct);
 const parentPath=useContext(ProgramPathContext),path=parentPath?parentPath+'/'+programId:programId;
 const register=useCallback((next:Menu|null)=>setMenu(next),[]);
 const select=useCallback((key:string)=>{if(!menu?.items.some(([id])=>id===key))return;if(menu.onChange(key)!==false)setShowHome(false)},[menu]);
 const open=useCallback(()=>setShowHome(true),[]);
 const reveal=useCallback(()=>setShowHome(false),[]);
 useEffect(()=>{if(direct)setShowHome(false)},[direct]);
 const navigation=useMemo(()=>accountId?({register,showHome,open,reveal,select}):null,[accountId,register,showHome,open,reveal,select]);
 const canLaunch=!!accountId&&!!menu?.items.length;
 return <NavigationContext.Provider value={navigation}><div className="program-workspace">
 {canLaunch&&showHome&&<PersonalHome key={accountId+path} accountId={accountId} name="" scope={path} title={title} greeting={false} shortTitles={false} apps={menu!.items.map(([key,label])=>({key,title:label,icon:subprogramIcon(key,label)}))} onNavigate={select}/>}
 <ProgramPathContext.Provider value={path+(menu?.value?'/'+menu.value:'')}><div className="program-workspace-content" hidden={canLaunch&&showHome}>{children}</div></ProgramPathContext.Provider>
 </div></NavigationContext.Provider>;
}
export function SubprogramNavigation({items,value,onChange}:{items:[string,string][];value:string;onChange:(key:string)=>void|boolean}){
 const context=useContext(NavigationContext),change=useRef(onChange),previous=useRef(value);change.current=onChange;
 const signature=JSON.stringify(items),register=context?.register;
 useLayoutEffect(()=>{if(!register)return;register({items:JSON.parse(signature),value,onChange:key=>change.current(key)});return()=>register(null)},[register,signature,value]);
 useEffect(()=>{if(previous.current!==value){previous.current=value;context?.reveal()}},[value,context?.reveal]);
 if(!context)return <nav className="tools" aria-label="زیر‌برنامه‌ها">{items.map(([key,title])=><button className={'btn '+(value===key?'primary':'')} key={key} onClick={()=>onChange(key)}>{title}</button>)}</nav>;
 return <nav className="program-return tools" aria-label="مسیر زیر‌برنامه"><button className="btn" onClick={context.open}><ArrowRight size={18}/>برنامه‌های این بخش</button><strong>{items.find(([key])=>key===value)?.[1]}</strong></nav>;
}

export function IconSections({scope,title='برنامه‌های این بخش',items}:{scope:string;title?:string;items:{key:string;title:string;content:ReactNode}[]}){
 const [selected,setSelected]=useState(items[0]?.key||'');
 const active=items.some(item=>item.key===selected)?selected:items[0]?.key||'';
 if(!items.length)return null;
 return <ProgramWorkspace programId={scope} title={title}><SubprogramNavigation items={items.map(item=>[item.key,item.title])} value={active} onChange={setSelected}/>{items.map(item=><div className="program-workspace-content" key={item.key} hidden={active!==item.key}>{item.content}</div>)}</ProgramWorkspace>;
}

function menuText(value:ReactNode):string{if(typeof value==='string'||typeof value==='number')return String(value);if(Array.isArray(value))return value.map(menuText).join('');if(isValidElement<{children?:ReactNode}>(value))return menuText(value.props.children);return '';}
function menuChildren(value:ReactNode):ReactNode[]{return (Array.isArray(value)?value:[value]).flatMap(child=>Array.isArray(child)?menuChildren(child):isValidElement<{children?:ReactNode}>(child)&&child.type===Fragment?menuChildren(child.props.children):[child]);}
export function IconActions({scope,children,className='tools'}:{scope:string;children:ReactNode;className?:string}){
 const accountId=useContext(AccountContext),path=useContext(ProgramPathContext),nodes=menuChildren(children);
 const actions=nodes.filter((n):n is ReactElement<any>=>isValidElement(n)&&n.type==='button');
 if(!accountId||!actions.length)return <div className={className}>{children}</div>;
 const extra=nodes.filter(n=>n!==null&&n!==undefined&&n!==false&&(!isValidElement(n)||n.type!=='button'));
 const counts=new Map<string,number>();const apps=actions.map(control=>{const title=menuText(control.props.children).trim()||control.props['aria-label']||'باز کردن',base=String(control.key||title),index=counts.get(base)||0;counts.set(base,index+1);return {key:base+':'+index,title,icon:subprogramIcon(base,title),control}});
 return <div className="icon-actions">{extra.length>0&&<div className={className}>{extra}</div>}<PersonalHome key={accountId+path+scope} accountId={accountId} name="" scope={path+'/'+scope} title="ابزارهای این بخش" greeting={false} shortTitles={false} compact apps={apps} onNavigate={()=>{}}/></div>;
}
export function IconDisclosure({scope,title,children,className,style}:{scope:string;title:ReactNode;children:ReactNode;className?:string;style?:CSSProperties}){return <div className={className} style={style}><IconSections scope={scope} title={menuText(title).trim()} items={[{key:'content',title:menuText(title).trim(),content:<>{children}</>}]}/></div>;}
