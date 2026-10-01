'use client';
import {useEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {boundAssistant,assistantPanel,type Point,type Viewport} from '@/lib/assistant-position';
export function useAssistantPosition(button:RefObject<HTMLButtonElement|null>,accountId:string,compact=false){
 const [point,setPoint]=useState<Point|null>(null),[viewport,setViewport]=useState<Viewport>({left:0,top:0,width:1024,height:768}),[dragging,setDragging]=useState(false);
 const current=useRef<Point|null>(null),bounds=useRef(viewport),drag=useRef<{id:number;x:number;y:number;start:Point;moved:boolean}|null>(null),suppress=useRef(false);
 const key='nafasyar-assistant-position:'+accountId;
 function size(){return {w:button.current?.offsetWidth||160,h:button.current?.offsetHeight||64}}
 function move(p:Point,save=false){const {w,h}=size(),next=boundAssistant(p,bounds.current,w,h);current.current=next;setPoint(next);if(save)try{localStorage.setItem(key,JSON.stringify(next))}catch{}}
 useEffect(()=>{
 function measure(){const vv=window.visualViewport,v={left:vv?.offsetLeft||0,top:vv?.offsetTop||0,width:vv?.width||window.innerWidth,height:vv?.height||window.innerHeight};bounds.current=v;setViewport(v);move(current.current||{x:v.left+24,y:v.top+v.height-size().h-104});}
 current.current=null;try{const p=JSON.parse(localStorage.getItem(key)||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))current.current=p}catch{}
 measure();window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);
 return()=>{window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);drag.current=null;};
 },[key]);
 function onPointerDown(e:ReactPointerEvent<HTMLButtonElement>){if(!e.isPrimary||e.button!==0)return;suppress.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:current.current||{x:24,y:104},moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
 function onPointerMove(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<6)return;d.moved=true;suppress.current=true;setDragging(true);move({x:d.start.x+dx,y:d.start.y+dy});}
 function finish(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.id!==e.pointerId)return;if(d.moved&&current.current)move(current.current,true);drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 function onKeyDown(e:ReactKeyboardEvent<HTMLButtonElement>){if(!e.altKey)return;const p=current.current;if(!p)return;const step=e.shiftKey?40:12;const delta:Record<string,Point>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};if(delta[e.key]){e.preventDefault();move({x:p.x+delta[e.key].x,y:p.y+delta[e.key].y},true)}else if(e.key==='Home'){e.preventDefault();reset();}}
 function reset(){const v=bounds.current;move({x:v.left+24,y:v.top+v.height-size().h-104},true)}
 return {dragging,reset,widgetStyle:point?{left:point.x,top:point.y,bottom:'auto' as const}:undefined,panelStyle:point?assistantPanel(point,viewport,size().h,compact):undefined,onPointerDown,onPointerMove,onPointerUp:finish,onPointerCancel:finish,onKeyDown,consumeDrag:()=>{const was=suppress.current;suppress.current=false;return was}};
}
