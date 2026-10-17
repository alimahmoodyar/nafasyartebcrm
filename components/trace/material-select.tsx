'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';

type Choice={id:string;code:string;name:string};
const normalize=(s:string)=>s.toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\u200c/g,' ').trim();
export function searchMaterials(choices:Choice[],query:string){
 const words=normalize(query).split(/\s+/).filter(Boolean);
 return choices.filter(c=>words.every(word=>normalize(c.code+' '+c.name).includes(word)));
}

export function MaterialSelect({value,onChange,choices}:{value:string;onChange:(id:string)=>void;choices:Choice[]}){
 const id=useId(),input=useRef<HTMLInputElement>(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const selected=choices.find(c=>c.id===value),matches=searchMaterials(choices,query),shown=matches.slice(0,100),index=Math.min(active,Math.max(0,shown.length-1));
 const label=(c:Choice)=>[c.code,c.name].filter(Boolean).join(' · ');
 useEffect(()=>{input.current?.setCustomValidity(selected?'':'کالا را از فهرست انتخاب کنید.');},[selected?.id]);
 useEffect(()=>{if(open)document.getElementById(id+'-option-'+index)?.scrollIntoView({block:'nearest'});},[open,index,id]);
 function choose(c:Choice){onChange(c.id);setQuery('');setOpen(false);}
 function close(){setOpen(false);setQuery('');setActive(0);}
 return <div className="field" style={{position:'relative',minWidth:0}}>
  <label id={id+'-label'} htmlFor={id+'-input'}>کالا</label>
  <div style={{position:'relative'}}>
   <input ref={input} id={id+'-input'} role="combobox" aria-labelledby={id+'-label'} aria-autocomplete="list" aria-expanded={open} aria-controls={open?id+'-list':undefined} aria-activedescendant={open&&shown.length?id+'-option-'+index:undefined} type="search" autoComplete="off" required placeholder="جست‌وجو با نام یا کد کالا" value={open?query:selected?label(selected):''} onFocus={()=>{setQuery('');setActive(0);setOpen(true);}} onBlur={close} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}} onKeyDown={e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){setOpen(true);setQuery('');setActive(0);}else setActive(n=>Math.max(0,Math.min(shown.length-1,n+(e.key==='ArrowDown'?1:-1))));}
    else if(e.key==='Enter'&&open){e.preventDefault();if(shown[index])choose(shown[index]);}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
   }} style={{paddingInlineEnd:36}}/>
   <ChevronDown size={18} aria-hidden style={{position:'absolute',insetInlineEnd:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
  </div>
  {open&&<div id={id+'-list'} role="listbox" aria-label="کالاها" style={{position:'absolute',top:'100%',insetInline:0,zIndex:80,maxHeight:260,overflowY:'auto',background:'var(--background,#fff)',border:'1px solid #d6deec',borderRadius:10,boxShadow:'0 8px 24px #0002'}}>
   {!shown.length?<p role="status" style={{padding:12}}>کالایی با این نام یا کد پیدا نشد.</p>:shown.map((c,i)=><button key={c.id} id={id+'-option-'+i} type="button" role="option" tabIndex={-1} aria-selected={value===c.id} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(c)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'right',padding:'10px 12px',border:0,color:'inherit',background:i===index?'#eef2fb':'transparent'}}><span style={{flex:1}}><bdi dir="ltr">{c.code}</bdi>{c.code&&' · '}{c.name}</span>{value===c.id&&<Check size={16} aria-hidden/>}</button>)}
   {matches.length>shown.length&&<p role="status" style={{padding:12}}>برای دیدن نتیجهٔ موردنظر نام یا کد را دقیق‌تر وارد کنید.</p>}
  </div>}
 </div>;
}
