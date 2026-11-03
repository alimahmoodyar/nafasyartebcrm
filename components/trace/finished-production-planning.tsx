'use client';
import {useEffect,useState} from 'react';
import {DailyProductionPlans} from './daily-production-plans';
import {tehranDay} from '@/lib/serials';
export function FinishedProductionPlanning({orders,initialOrderId,onSaved}:{orders:any[];initialOrderId?:string;onSaved:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 async function load(){const r=await fetch('/api/routine-production',{cache:'no-store'}),v:any=await r.json();if(!r.ok)throw Error(v.error);setData(v);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 if(error)return <p role="alert" className="notice error">{error}</p>;
 if(!data)return <p role="status">در حال دریافت کارسنجی و زمان افراد…</p>;
 return <DailyProductionPlans data={data} day={tehranDay()} finished={{orders,initialOrderId}} selected="" onSelect={()=>{}} onAction={()=>{}} onSaved={async()=>{await load();onSaved();}}/>;
}
