'use client';
import {ArrowRight,Boxes,ChevronLeft,ClipboardCheck,MapPin,PackageOpen,RotateCcw,ShoppingCart,Truck,type LucideIcon} from 'lucide-react';
import type {WarehouseMenu} from '@/lib/central-warehouse-menu';
import './employee-self-service.css';

const icons:Record<string,LucideIcon>={stock:Boxes,operations:PackageOpen,supply:ShoppingCart,dispatch:Truck,returns:RotateCcw,counts:ClipboardCheck,locations:MapPin};

export function CentralWarehouseMenu({menus,activeId,onSelect,onNavigate}:{menus:WarehouseMenu[];activeId:string;onSelect:(id:string)=>void;onNavigate:(section:string,target?:string)=>void}){
 const active=menus.find(menu=>menu.id===activeId);
 function openMenu(menu:WarehouseMenu){
  if(menu.id==='locations'&&menu.links.length===1){const [link]=menu.links;onNavigate(link.section,link.target);return;}
  onSelect(menu.id);
 }
 if(!menus.length)return null;
 return <section className="employee-workspace-tools central-warehouse-menu" aria-label={active?.title||'ابزارهای انبار مرکزی'}>
  <header className="central-warehouse-menu-heading">
   <h2>{active?.title||'ابزارهای انبار مرکزی'}</h2>
   {active&&<button type="button" className="employee-workspace-back" onClick={()=>onSelect('')}><ArrowRight size={16} aria-hidden="true"/>بازگشت به ابزارها</button>}
  </header>
  <div className="employee-workspace-grid central-warehouse-grid">
   {active?active.links.map(link=><button type="button" className="employee-workspace-tile central-warehouse-tile" key={link.section+link.target} onClick={()=>onNavigate(link.section,link.target)}><strong>{link.title}</strong><ChevronLeft size={17} aria-hidden="true"/></button>):
    menus.map(menu=>{const Icon=icons[menu.id];return <button type="button" className="employee-workspace-tile central-warehouse-tile" key={menu.id} onClick={()=>openMenu(menu)}><span className="employee-service-icon"><Icon size={20} aria-hidden="true"/></span><span className="central-warehouse-tile-copy"><strong>{menu.title}</strong>{menu.id!=='locations'&&<small>{menu.links.slice(0,2).map(link=>link.title).join('، ')}</small>}</span><ChevronLeft size={17} aria-hidden="true"/></button>})}
  </div>
 </section>;
}
