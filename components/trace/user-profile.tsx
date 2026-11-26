'use client';

import {useEffect,useRef,useState} from 'react';
import {Camera,Pencil,X} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {initialProfilePhotoCrop,type ProfilePhotoCrop} from '@/lib/profile-photo';
import {AccountCredentials} from './account-credentials';
import {BaleSettings} from './bale-settings';
import {RecoverySettings} from './password-recovery';
import {PasskeySettings} from './passkeys';
import {normalizeProfilePhoto,ProfilePhotoEditor,type ProfilePhotoDraft} from './profile-photo-editor';

type Profile={accountId:string;revision:number;hasPhoto:boolean;hasSource?:boolean;crop?:ProfilePhotoCrop|null;authType?:string;username?:string};

export function UserProfile({accountId,name,onPersonnel,onAssets}:{accountId:string;name:string;onPersonnel?:()=>void;onAssets?:()=>void}){
 const [open,setOpen]=useState(false);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [editing,setEditing]=useState<ProfilePhotoDraft|null>(null);
 const [removeRevision,setRemoveRevision]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const input=useRef<HTMLInputElement>(null),keepPhoto=useRef<HTMLButtonElement>(null),saving=useRef(false);
 const url='/api/profile?account='+encodeURIComponent(accountId);
 const photo=profile?.hasPhoto?url+'&image=1&v='+profile.revision:'';
 async function load(signal?:AbortSignal){
  const response=await fetch(url,{cache:'no-store',signal});
  const data=await response.json() as Profile&{error?:string};
  if(!response.ok)throw Error(data.error||'پروفایل دریافت نشد.');
  if(data.accountId!==accountId)throw Error('حساب تغییر کرده است.');
  setProfile(current=>current?.accountId===accountId&&current.revision>data.revision?current:data);
 }
 useEffect(()=>{
  const abort=new AbortController();
  void load(abort.signal).catch(error=>{if(!abort.signal.aborted)setError(error.message);});
  return()=>abort.abort();
 },[accountId]);

 async function choose(file:File){
  if(!profile||busy)return;
  const revision=profile.revision;
  setBusy(true);setError('');setMessage('');
  try{
   const source=await normalizeProfilePhoto(file);
   setEditing({source,url:'data:image/jpeg;base64,'+source,revision,crop:initialProfilePhotoCrop});
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 function editCurrent(){
  if(!profile?.hasPhoto||busy)return;
  setError('');setMessage('');
  const useOriginal=profile.hasSource===true;
  setEditing({url:useOriginal?url+'&source=1&v='+profile.revision:photo,revision:profile.revision,crop:useOriginal&&profile.crop?profile.crop:initialProfilePhotoCrop});
 }
 async function save(mode:'upload'|'remove',revision:number,details?:{image:string;source?:string;crop:ProfilePhotoCrop}){
  if(saving.current)return;
  saving.current=true;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json','x-profile-account':accountId},body:JSON.stringify({mode,revision,confirmed:true,...details})});
   const data=await response.json() as {error?:string;revision:number};
   if(!response.ok){
    if(response.status===409)void load().catch(()=>{});
    throw Error(data.error||'ذخیره انجام نشد.');
   }
   setProfile(current=>current&&current.accountId===accountId&&current.revision<=data.revision?{...current,revision:data.revision,hasPhoto:mode==='upload',hasSource:mode==='upload',crop:details?.crop||null}:current);
   setEditing(null);setRemoveRevision(null);
   setMessage(mode==='remove'?'عکس پروفایل حذف شد.':'عکس پروفایل ذخیره شد.');
   window.dispatchEvent(new Event('nafasyar-profile-photo-changed'));
  }finally{saving.current=false;setBusy(false);}
 }
 return <div className="user-profile">
  <button className="user-profile-button" onClick={()=>{setOpen(!open);if(!open)void load().catch(error=>setError(error.message));}} aria-expanded={open} aria-label="پروفایل من">
   {photo?<img src={photo} alt="عکس پروفایل من"/>:<span className="profile-avatar-initial" aria-hidden="true">{Array.from(name.trim())[0]||'؟'}</span>}
   <span><strong>{name}</strong></span>
  </button>
  {open&&<section className="user-profile-card" aria-label="پروفایل من">
   <button className="link" aria-label="بستن پروفایل" onClick={()=>setOpen(false)}><X size={18}/></button>
   <h3>{name}</h3>
   {onPersonnel&&<button className="btn primary" onClick={()=>{setOpen(false);onPersonnel();}}>پرتال پرسنلی من</button>}
   {onAssets&&<button className="btn primary" onClick={()=>{setOpen(false);onAssets();}}>اموال امانی من</button>}
   <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="انتخاب فایل عکس پروفایل" hidden onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void choose(file);}}/>
   <div className="tools">
    <button type="button" className="btn" disabled={busy||!profile} onClick={()=>input.current?.click()}><Camera size={18}/> {busy&&!editing&&removeRevision===null?'در حال آماده‌سازی…':photo?'تغییر عکس':'انتخاب عکس'}</button>
    {photo&&<><button type="button" className="btn" disabled={busy} onClick={editCurrent}><Pencil size={18}/> ویرایش عکس</button>
     <button type="button" className="btn" disabled={busy} onClick={()=>{if(profile){setError('');setMessage('');setRemoveRevision(profile.revision);}}}>حذف عکس</button></>}
   </div>
   {profile?.authType==='password'&&<><AccountCredentials accountId={accountId} username={profile.username||''}/><RecoverySettings key={accountId} accountId={accountId}/><PasskeySettings/></>}
   <BaleSettings/>
   {error&&removeRevision===null&&<p role="alert">{error}</p>}
   {message&&<p role="status">{message}</p>}
  </section>}
  {editing&&<ProfilePhotoEditor draft={editing} name={name} busy={busy} onClose={()=>setEditing(null)}
   onSave={(image,crop)=>save('upload',editing.revision,{image,crop,source:editing.source})}/>}
  {removeRevision!==null&&<Dialog open onOpenChange={value=>{if(!value&&!busy)setRemoveRevision(null);}}>
   <DialogContent dir="rtl" showCloseButton={false} data-workspace-mutation-busy={busy||undefined} onOpenAutoFocus={event=>{event.preventDefault();keepPhoto.current?.focus();}}>
    <DialogTitle>حذف عکس پروفایل</DialogTitle>
    <DialogDescription>مطمئنی می‌خواهی عکس پروفایلت را حذف کنی؟</DialogDescription>
    {error&&<p className="notice error" role="alert">{error}</p>}
    <div className="tools">
     <button type="button" ref={keepPhoto} className="btn" disabled={busy} onClick={()=>setRemoveRevision(null)}>انصراف</button>
     <button type="button" className="btn bg-destructive text-white" disabled={busy} onClick={()=>void save('remove',removeRevision).catch(error=>setError(error.message))}>{busy?'در حال حذف…':'حذف عکس'}</button>
    </div>
   </DialogContent>
  </Dialog>}
 </div>;
}
