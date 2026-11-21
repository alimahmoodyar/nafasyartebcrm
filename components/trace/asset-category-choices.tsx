'use client';
import {Armchair,Laptop,Printer,Wrench,Component,Factory,Truck,Shapes,Check} from 'lucide-react';
import {assetCategories} from '@/lib/asset-categories';
const icons={Armchair,Laptop,Printer,Wrench,Component,Factory,Truck,Shapes};
export function AssetCategoryChoices({value,onChange,disabled=false,iconSize=27}:{value:string;onChange:(value:string)=>void;disabled?:boolean;iconSize?:number}){
 return <div className="asset-register__groups" role="group" aria-label="گروه مال">{assetCategories.map(category=>{
  const Icon=icons[category.icon],selected=value===category.name;
  return <button type="button" className={'asset-register__group'+(selected?' is-selected':'')} key={category.name} aria-pressed={selected} disabled={disabled} onClick={()=>onChange(category.name)}><Icon size={iconSize} aria-hidden="true"/><span>{category.name}</span>{selected&&<Check size={16} aria-hidden="true"/>}</button>;
 })}</div>;
}
