'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import {searchBuyers,type BuyerChoice} from '@/lib/buyer-search';
export function BuyerSelect({value,onChange,choices,disabled=false,required=true}:{value:string;onChange:(id:string)=>void;choices:BuyerChoice[];disabled?:boolean;required?:boolean}){
 const id=useId(),input=useRef<HTMLInputElement>(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const selected=choices.find(c=>c.id===value),matches=searchBuyers(choices,query),shown=matches.slice(0,100),index=Math.min(active,Math.max(0,shown.length-1));
 useEffect(()=>{input.current?.setCustomValidity(required&&!selected?'خریدار را از فهرست انتخاب کنید.':'');},[required,selected?.id]);
 useEffect(()=>{setActive(0);},[query,open]);
 useEffect(()=>{if(open)document.getElementById(id+'-option-'+index)?.scrollIntoView({block:'nearest'});},[open,index,id]);
 function choose(c:BuyerChoice){onChange(c.id);setQuery(c.name);setOpen(false);}
 return <div className="field buyer-select" style={{position:'relative',minWidth:0}}><label id={id+'-label'} htmlFor={id+'-input'}>خریدار</label>
  <div style={{position:'relative'}}><input ref={input} id={id+'-input'} role="combobox" aria-labelledby={id+'-label'} aria-autocomplete="list" aria-expanded={open} aria-controls={open?id+'-list':undefined} aria-activedescendant={open&&shown.length?id+'-option-'+index:undefined} aria-invalid={!open&&!!query&&!selected||undefined} placeholder="نام خریدار را جست‌وجو و انتخاب کنید" autoComplete="off" type="search" required={required} disabled={disabled} value={open?query:selected?.name||query} onFocus={e=>{setQuery(selected?.name||query);setOpen(true);e.currentTarget.select();}} onBlur={()=>setOpen(false)} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);if(value)onChange('');}} onKeyDown={e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){setOpen(true);setQuery('');}else setActive(n=>Math.max(0,Math.min(shown.length-1,n+(e.key==='ArrowDown'?1:-1))));}
   else if(e.key==='Enter'&&open){e.preventDefault();if(shown[index])choose(shown[index]);}
   else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);}
  }} style={{paddingInlineEnd:36}}/><ChevronDown size={18} aria-hidden style={{position:'absolute',insetInlineEnd:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/></div>
  {open&&<div id={id+'-list'} role="listbox" aria-label="خریداران" style={{position:'absolute',top:'100%',insetInline:0,zIndex:80,maxHeight:260,overflowY:'auto',background:'var(--background,#fff)',border:'1px solid #d6deec',borderRadius:10,boxShadow:'0 8px 24px #0002'}}>
   {!shown.length?<p role="status" style={{padding:12}}>خریداری با این نام پیدا نشد.</p>:shown.map((c,i)=><button key={c.id} id={id+'-option-'+i} type="button" role="option" tabIndex={-1} aria-selected={value===c.id} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(c)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'right',padding:'10px 12px',border:0,color:'inherit',background:i===index?'#eef2fb':'transparent'}}><span style={{flex:1}}>{c.name}{c.detail&&<small style={{display:'block',color:'#667085'}}>{c.detail}</small>}</span>{value===c.id&&<Check size={16} aria-hidden/>}</button>)}
   {matches.length>shown.length&&<p role="status" style={{padding:12}}>نام را دقیق‌تر وارد کنید تا از بین {matches.length.toLocaleString('fa-IR')} خریدار پیدا شود.</p>}
  </div>}
  {!open&&!!query&&!selected&&<small role="status">برای ثبت، خریدار را از نتیجه‌های جست‌وجو انتخاب کنید.</small>}
 </div>;
}
