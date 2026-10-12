"use client";
import {Fragment,isValidElement,createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type ReactElement,type CSSProperties} from 'react';
import {ArrowRight,Boxes,ClipboardList,FileText,Users,Settings2,ChartNoAxesCombined,Wallet,Truck,Wrench,Factory,CalendarDays,BookOpen,Mail,ShieldCheck,type LucideIcon} from 'lucide-react';
import {PersonalHome} from './personal-home';
import {createPortal} from 'react-dom';
import {currentWorkspaceBack,type WorkspaceBackEntry} from '@/lib/workspace-back';

const AccountContext=createContext<string|null>(null);
const RootBackContext=createContext<(()=>void)|null>(null);
type BackRegistry={register:(entry:Omit<WorkspaceBackEntry,'order'>)=>()=>void;invalidate:()=>void;run:()=>void;entries:Map<number,WorkspaceBackEntry>;version:number};
const BackRegistryContext=createContext<BackRegistry|null>(null);
export function LayoutAccountProvider({accountId,children,onBack}:{accountId:string;children:ReactNode;onBack?:()=>void}){
 const inheritedBack=useContext(RootBackContext),inheritedRegistry=useContext(BackRegistryContext),entries=useRef(new Map<number,WorkspaceBackEntry>()),sequence=useRef(0),[version,setVersion]=useState(0),back=useRef(onBack||inheritedBack);
 back.current=onBack||inheritedBack;
 const invalidate=useCallback(()=>setVersion(n=>n+1),[]);
 const register=useCallback((entry:Omit<WorkspaceBackEntry,'order'>)=>{const id=++sequence.current;entries.current.set(id,{...entry,order:id});setVersion(n=>n+1);return()=>{entries.current.delete(id);setVersion(n=>n+1);};},[]);
 const run=useCallback(()=>{const current=currentWorkspaceBack([...entries.current.values()]);if(current)current.handler();else back.current?.();},[]);
 const registry=useMemo(()=>({register,invalidate,run,entries:entries.current,version}),[register,invalidate,run,version]);
 return <RootBackContext.Provider value={onBack||inheritedBack}><BackRegistryContext.Provider value={inheritedRegistry||registry}><AccountContext.Provider value={accountId}>{children}</AccountContext.Provider></BackRegistryContext.Provider></RootBackContext.Provider>;
}

function useBackEntry(handler:()=>void,enabled:boolean,priority:number,modal=false){
 const registry=useContext(BackRegistryContext),element=useRef<HTMLElement|null>(null),latest=useRef(handler);latest.current=handler;
 const ref=useCallback((node:HTMLElement|null)=>{if(element.current===node)return;element.current=node;registry?.invalidate();},[registry?.invalidate]);
 useLayoutEffect(()=>enabled&&registry?registry.register({element:()=>element.current,handler:()=>latest.current(),priority,modal}):undefined,[enabled,registry?.register,priority,modal]);
 return {ref,scoped:!!registry};
}
export function useWorkspaceBack(handler:()=>void,enabled=true,priority=100){return useBackEntry(handler,enabled,priority).ref;}
export function useWorkspaceModalBack(handler:()=>void,enabled=true){return useBackEntry(handler,enabled,1000,true);}

export function WorkspaceBackButton({visible=true}:{visible?:boolean}){
 const registry=useContext(BackRegistryContext),back=useContext(RootBackContext),anchor=useRef<HTMLButtonElement|null>(null),[position,setPosition]=useState({left:16,top:16,width:100,height:48});
 const modal=registry?currentWorkspaceBack([...registry.entries.values()].filter(entry=>entry.modal))?.element():null;
 useLayoutEffect(()=>{if(!modal)return;const update=()=>{const rect=anchor.current?.getBoundingClientRect();if(!rect)return;const next={left:Math.max(8,Math.min(rect.left,window.innerWidth-rect.width-8)),top:Math.max(8,Math.min(rect.top,window.innerHeight-rect.height-8)),width:rect.width,height:rect.height};setPosition(old=>Object.keys(next).every(k=>old[k as keyof typeof old]===next[k as keyof typeof next])?old:next);};update();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);if(anchor.current)observer?.observe(anchor.current);window.addEventListener('resize',update);window.addEventListener('scroll',update,true);return()=>{observer?.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};},[modal]);
 if(!back&&!registry||!visible&&!modal)return null;
 const run=()=>registry?registry.run():back?.(),content=<><ArrowRight size={18}/>بازگشت</>;
 return <><button ref={anchor} data-workspace-header-back type="button" className="btn" onClick={run} aria-hidden={modal?true:undefined} disabled={!!modal} style={modal?{visibility:'hidden'}:undefined}>{content}</button>{modal&&createPortal(<button data-workspace-header-back type="button" className="btn workspace-modal-back" style={{position:'fixed',...position,zIndex:60,pointerEvents:'auto'}} onClick={run}>{content}</button>,modal)}</>;
}
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
export function ProgramWorkspace({programId,title,direct=false,children,status}:{programId:string;title:string;direct?:boolean;children:ReactNode;status?:ReactNode}){
 const parentNavigation=useContext(NavigationContext),rootBack=useContext(RootBackContext);
 const accountId=useContext(AccountContext),[menu,setMenu]=useState<Menu|null>(null),[showHome,setShowHome]=useState(!direct);
 const parentPath=useContext(ProgramPathContext),path=parentPath?parentPath+'/'+programId:programId;
 const register=useCallback((next:Menu|null)=>setMenu(next),[]);
 const select=useCallback((key:string)=>{if(!menu?.items.some(([id])=>id===key))return;if(menu.onChange(key)!==false)setShowHome(false)},[menu]);
 const open=useCallback(()=>{if(menu?.items.length)setShowHome(true);else if(parentNavigation)parentNavigation.open();else rootBack?.();},[menu?.items.length,parentNavigation?.open,rootBack]);
 const reveal=useCallback(()=>setShowHome(false),[]);
 useEffect(()=>{if(direct)setShowHome(false)},[direct]);
 const navigation=useMemo(()=>accountId?({register,showHome,open,reveal,select}):null,[accountId,register,showHome,open,reveal,select]);
 const canLaunch=!!accountId&&!!menu?.items.length;
 const backRef=useWorkspaceBack(()=>setShowHome(true),canLaunch&&!showHome);
 return <NavigationContext.Provider value={navigation}><div className="program-workspace" ref={backRef}>
 {status}
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
 const title=items.find(([key])=>key===value)?.[1];return title?<p className="subtle" aria-label="مسیر زیر‌برنامه">{title}</p>:null;
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
