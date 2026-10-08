"use client";
import {IconActions} from "./program-workspace";
import {formatDate} from '@/lib/persian-date';
import {useEffect,useState} from 'react';
import {Paperclip,Download,Upload,RefreshCw} from 'lucide-react';
import {validateBatchFile,type BatchFile} from '@/lib/batch-files';
type Pending={file:File;id:string;done:boolean};
export function BatchFilesPanel({batchId,demo,write,quality=false}:{batchId:string;demo:boolean;write:boolean;quality?:boolean}){
 const [files,setFiles]=useState<BatchFile[]>([]),[pending,setPending]=useState<Pending[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const endpoint=(quality?'/api/quality/files?report=':'/api/batch-files?batch=')+encodeURIComponent(batchId);
 async function load(){if(demo)return;setLoading(true);setError('');try{const r=await fetch(endpoint,{cache:'no-store'}),d=await r.json() as {error?:string;files:BatchFile[]};if(!r.ok)throw new Error(d.error);setFiles(d.files);}catch(e){setError(e instanceof Error?e.message:'دریافت فایل‌ها انجام نشد.');}finally{setLoading(false);}}
 useEffect(()=>{load();},[batchId,demo]);
 async function upload(){setBusy(true);setError('');setMessage('');let count=0;try{for(const item of pending.filter(p=>!p.done)){const form=new FormData();form.append('file',item.file);const r=await fetch(endpoint+'&requestId='+item.id,{method:'POST',body:form}),d=await r.json() as {error?:string;file:BatchFile};if(!r.ok)throw new Error(item.file.name+' — '+d.error);setFiles(prev=>[d.file,...prev.filter(f=>f.id!==d.file.id)]);setPending(prev=>prev.map(p=>p.id===item.id?{...p,done:true}:p));count++;}setMessage('فایل‌ها پیوست شدند.');setPending([]);}catch(e){setError((count?'فایل‌های موفق ذخیره شدند. ':'')+(e instanceof Error?e.message:'بارگذاری انجام نشد.'));}finally{setBusy(false);}}
 return <section className="detailsection"><IconActions scope="batch-files-panel-actions-4d645359be"><h2><Paperclip size={18} style={{display:'inline',marginLeft:8}}/>{quality?'عکس و فایل برگ کنترل کیفیت':'فایل‌های پیوست بچ'}</h2>{!demo&&<button type="button" className="btn" disabled={busy||loading} onClick={load}><RefreshCw size={16}/>تازه‌سازی</button>}</IconActions>
 {demo?<p className="subtle">در اطلاعات شرکت می‌توانید عکس کالا، نقشه، PDF، فایل اکسل یا هر مدرک مرتبط را به بچ پیوست کنید.</p>:<>
 {write&&<div style={{marginTop:16}}><label className="field"><span>انتخاب عکس، نقشه یا فایل · هر فایل تا ۱۰ مگابایت</span><input aria-label="انتخاب فایل‌های بچ" type="file" multiple disabled={busy} onChange={e=>{setError('');setMessage('');try{const selected=Array.from(e.target.files||[]);selected.forEach(f=>validateBatchFile(f.name,f.size));setPending(selected.map(file=>({file,id:crypto.randomUUID(),done:false})));}catch(err){setPending([]);setError((err as Error).message);e.target.value='';}}}/></label>{pending.length>0&&<><ul>{pending.map(p=><li key={p.id} style={{overflowWrap:'anywhere'}}>{p.file.name}{p.done?' · ذخیره شد':''}</li>)}</ul><button type="button" className="btn primary" disabled={busy} onClick={upload}><Upload size={16}/>{busy?'در حال بارگذاری…':'بارگذاری فایل‌های باقی‌مانده'}</button></>}</div>}
 {loading&&<p role="status">در حال دریافت فایل‌ها…</p>}{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
 {!loading&&!error&&!files.length&&<p className="subtle" style={{marginTop:12}}>هنوز فایلی ثبت نشده است.</p>}
 {files.map(f=><div className="recordline" key={f.id} style={{gap:12,flexWrap:'wrap'}}><div style={{minWidth:0,flex:'1 1 180px'}}><strong style={{overflowWrap:'anywhere'}}>{f.filename}</strong><p className="subtle">{(f.byte_size/1024).toLocaleString('fa-IR',{maximumFractionDigits:1})} کیلوبایت · {formatDate(f.uploaded_at)} · {f.uploaded_by}</p></div><a className="btn" href={endpoint+'&id='+encodeURIComponent(f.id)}><Download size={16}/>دانلود</a></div>)}
 </>}</section>;
}
