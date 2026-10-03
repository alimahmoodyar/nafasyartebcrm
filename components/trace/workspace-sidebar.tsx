"use client";
import type {LucideIcon} from "lucide-react";
import {Users,ChevronLeft} from "lucide-react";
import {Sidebar,SidebarHeader,SidebarContent,SidebarFooter,useSidebar} from "@/components/ui/sidebar";
import {TabsList,TabsTrigger} from "@/components/ui/tabs";
import {CompanyBrand} from "./company-brand";
export function WorkspaceSidebar({sections,name,admin,demo}:{sections:{key:string;title:string;icon:LucideIcon}[];name:string;admin:boolean;demo:boolean}){
 const {setOpenMobile}=useSidebar();
 const groups=[{label:"میز کار",keys:["overview","my-account","tasks","development","analytics"]},{label:"تولید و رهگیری",keys:["transport","sourcing","fulfillment","flow","serials","device","batch","inventory","event","distribution"]},{label:"کیفیت و خدمات",keys:["after-sales","service","action"]},{label:"مالی",keys:["finance-control","finance"]},{label:"مدیریت",keys:["product","firmware","llm","users","system-reset"]}];
 return <Sidebar side="right" className="nafasyar-sidebar"><SidebarHeader className="workspace-brand"><CompanyBrand/></SidebarHeader><SidebarContent><TabsList className="workspace-nav" aria-label="بخش‌های نرم‌افزار">{groups.map(group=>{const items=sections.filter(s=>group.keys.includes(s.key));if(!items.length&&!(admin&&group.keys.includes("users")))return null;return <div className="nav-group" key={group.label}><p className="nav-group-label">{group.label}</p>{items.map(s=><TabsTrigger className="workspace-nav-item" value={s.key} key={s.key} onClick={()=>setOpenMobile(false)}><s.icon size={19}/><span>{s.title}</span><ChevronLeft className="nav-chevron" size={14}/></TabsTrigger>)}{admin&&group.keys.includes("users")&&<TabsTrigger className="workspace-nav-item" value="users" onClick={()=>setOpenMobile(false)}><Users size={19}/><span>کاربران و دسترسی‌ها</span><ChevronLeft className="nav-chevron" size={14}/></TabsTrigger>}</div>})}</TabsList></SidebarContent><SidebarFooter className="workspace-account"><span className="account-avatar">{name.trim().slice(0,1)}</span><div><strong>{name}</strong><p>{admin?"مدیر سامانه":"کاربر واحد"} · {demo?"محیط نمونه":"اطلاعات شرکت"}</p></div></SidebarFooter></Sidebar>;
}
