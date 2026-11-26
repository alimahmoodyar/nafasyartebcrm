'use client';

import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {RotateCw} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {initialProfilePhotoCrop,profilePhotoFrame,profilePhotoImageLimit,profilePhotoSourceLimit,profilePhotoMinZoom,profilePhotoMaxZoom,type ProfilePhotoCrop} from '@/lib/profile-photo';
import './profile-photo-editor.css';

export type ProfilePhotoDraft={url:string;revision:number;crop:ProfilePhotoCrop;source?:string};

async function decodePhoto(url:string){
 const image=new Image();
 image.src=url;
 try{await image.decode()}catch{throw Error('این تصویر باز نشد. عکس دیگری انتخاب کنید.');}
 if(!image.naturalWidth||!image.naturalHeight)throw Error('اندازهٔ تصویر معتبر نیست.');
 return image;
}

function encodeJpeg(canvas:HTMLCanvasElement,limit:number){
 for(const quality of [0.90,0.82,0.72,0.58,0.42,0.30]){
  const data=canvas.toDataURL('image/jpeg',quality).split(',')[1];
  if(!data)break;
  const padding=data.endsWith('==')?2:data.endsWith('=')?1:0;
  if(data.length*3/4-padding<=limit)return data;
 }
 throw Error('اندازهٔ عکس برای ذخیره زیاد است. عکس دیگری انتخاب کنید.');
}

export async function normalizeProfilePhoto(file:File){
 if(!file.size||file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))
  throw Error('عکس JPG، PNG یا WebP حداکثر ۸ مگابایت انتخاب کنید.');
 const url=URL.createObjectURL(file);
 try{
  const image=await decodePhoto(url);
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');
  if(!context)throw Error('آماده‌سازی عکس انجام نشد.');
  context.fillStyle='#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return encodeJpeg(canvas,profilePhotoSourceLimit);
 }finally{URL.revokeObjectURL(url);}
}

function drawCrop(canvas:HTMLCanvasElement,image:HTMLImageElement,crop:ProfilePhotoCrop){
 const context=canvas.getContext('2d'),size=canvas.width;
 if(!context)throw Error('آماده‌سازی عکس انجام نشد.');
 const width=image.naturalWidth,height=image.naturalHeight;
 const {scale,panX,panY}=profilePhotoFrame(width,height,crop,size);
 context.save();
 context.fillStyle='#fff';
 context.fillRect(0,0,size,size);
 context.translate(size/2+crop.x*panX,size/2+crop.y*panY);
 context.rotate(crop.turns*Math.PI/2);
 context.scale(scale,scale);
 context.drawImage(image,-width/2,-height/2);
 context.restore();
}

const clampOffset=(offset:number)=>Math.max(-1,Math.min(1,offset));

export function ProfilePhotoEditor({draft,name,busy,onClose,onSave}:{draft:ProfilePhotoDraft;name:string;busy:boolean;onClose:()=>void;onSave:(image:string,crop:ProfilePhotoCrop)=>Promise<void>}){
 const [image,setImage]=useState<HTMLImageElement|null>(null);
 const [crop,setCrop]=useState(draft.crop);
 const zoomRange=crop.zoom<1?1-profilePhotoMinZoom:profilePhotoMaxZoom-1;
 const zoomPosition=Math.round((crop.zoom-1)/zoomRange*50);
 const [error,setError]=useState('');
 const frame=useRef<HTMLCanvasElement>(null),preview=useRef<HTMLCanvasElement>(null);
 const drag=useRef<{id:number;x:number;y:number;crop:ProfilePhotoCrop}|null>(null);
 useEffect(()=>{
  let active=true;
  void decodePhoto(draft.url).then(result=>{if(active)setImage(result);}).catch(error=>{if(active)setError(error.message);});
  return()=>{active=false;};
 },[draft.url]);
 useEffect(()=>{
  if(!image)return;
  try{if(frame.current)drawCrop(frame.current,image,crop);if(preview.current)drawCrop(preview.current,image,crop);}
  catch(error){setError((error as Error).message);}
 },[image,crop]);

 function position(base:ProfilePhotoCrop,dx:number,dy:number,size:number){
  if(!image)return base;
  const {panX,panY}=profilePhotoFrame(image.naturalWidth,image.naturalHeight,base,size);
  return {...base,x:panX?clampOffset(base.x+dx/panX):0,y:panY?clampOffset(base.y+dy/panY):0};
 }
 function startDrag(event:PointerEvent<HTMLCanvasElement>){
  if(!image||busy||event.button!==0)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,crop};
 }
 function moveDrag(event:PointerEvent<HTMLCanvasElement>){
  const start=drag.current;
  if(!start||start.id!==event.pointerId||busy)return;
  const size=event.currentTarget.getBoundingClientRect().width;
  if(size)setCrop(position(start.crop,event.clientX-start.x,event.clientY-start.y,size));
 }
 async function save(){
  if(!image||busy)return;
  setError('');
  try{
   const canvas=document.createElement('canvas');
   canvas.width=canvas.height=256;
   drawCrop(canvas,image,crop);
   await onSave(encodeJpeg(canvas,profilePhotoImageLimit),crop);
  }catch(error){setError((error as Error).message);}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose()}}>
  <DialogContent className="profile-photo-editor" showCloseButton={false} dir="rtl" data-workspace-mutation-busy={busy||undefined}>
   <DialogTitle>ویرایش عکس پروفایل</DialogTitle>
   <DialogDescription>عکس را بکشید تا داخل کادر درست قرار بگیرد.</DialogDescription>
   <div className="profile-photo-editor-layout">
    <div className="profile-photo-crop">
     <canvas ref={frame} width={320} height={320} tabIndex={0} aria-label="کادر برش. با کلیدهای جهت، جای عکس را تنظیم کنید."
      onPointerDown={startDrag} onPointerMove={moveDrag}
      onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}
      onKeyDown={event=>{
       const offsets:Record<string,[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};
       const delta=offsets[event.key];
       if(!image||busy||!delta)return;
       event.preventDefault();
       const size=event.currentTarget.getBoundingClientRect().width;
       if(size)setCrop(current=>position(current,...delta,size));
      }}/>
    </div>
    <div className="profile-photo-editor-tools">
     <section className="profile-photo-example" aria-label="پیش‌نمایش در پیام‌رسان">
      <span>پیش‌نمایش در پیام‌رسان</span>
      <div><canvas ref={preview} width={96} height={96} aria-hidden="true"/><strong>{name}</strong></div>
     </section>
     <fieldset disabled={busy||!image}>
      <label className="field">بزرگ‌نمایی
       <input type="range" dir="ltr" min={-50} max={50} step={1} value={zoomPosition} aria-valuetext={Math.round(crop.zoom*100)+'٪'}
        onChange={event=>{
         const position=Number(event.target.value)/50;
         const range=position<0?1-profilePhotoMinZoom:profilePhotoMaxZoom-1;
         setCrop(current=>({...current,zoom:Number((1+position*range).toFixed(2))}));
        }}/>
      </label>
      <button type="button" className="btn" onClick={()=>setCrop({zoom:crop.zoom,turns:(crop.turns+1)%4,x:-crop.y,y:crop.x})}><RotateCw size={18}/> چرخش ۹۰ درجه</button>
      <button type="button" className="btn" onClick={()=>setCrop(initialProfilePhotoCrop)}>بازنشانی برش</button>
     </fieldset>
    </div>
   </div>
   {!image&&!error&&<p role="status">در حال آماده‌سازی عکس…</p>}
   {error&&<p className="notice error" role="alert">{error}</p>}
   <div className="tools"><button type="button" className="btn primary" disabled={busy||!image} onClick={()=>void save()}>{busy?'در حال ذخیره…':'ذخیره عکس'}</button><button type="button" className="btn" disabled={busy} onClick={onClose}>انصراف</button></div>
  </DialogContent>
 </Dialog>;
}
