'use client';
import {WarehouseDispatchPanel} from './warehouse-dispatch-panel';
import {WarehouseHistoryPanel} from './warehouse-history-panel';
import {WarehouseOperations} from './warehouse-operations';
import {useEffect,useState} from 'react';
import type {Session} from '@/lib/permissions';
import type {Row} from '@/lib/model';
import {warehouseNavigation} from '@/lib/navigation-access';
import {warehouseGroupTitles,warehouseTarget,parseWarehouseTarget,stockHistoryTarget,parseStockHistory,type WarehouseEntry} from '@/lib/warehouse-workspace';
import {ProgramWorkspace,SubprogramNavigation} from './program-workspace';
import {MaterialFlow} from './material-flow';
import {ProductionPanel} from './production-panel';
import {FulfillmentPanel} from './fulfillment-panel';
import {AfterSalesPanel} from './after-sales-panel';
import {WarehouseReturnsPanel} from './warehouse-returns-panel';
import {BuildProjectsPanel} from './build-projects-panel';
import {WarehouseStockPanel} from './warehouse-stock-panel';

export function WarehouseHub({user,records,demo,onSaved,onOpen,onNavigate,targetId=''}:{user:Session;records:Row[];demo:boolean;onSaved:()=>void;onOpen:(row:Row)=>void;onNavigate:(section:string,target?:string)=>void;targetId?:string}){
 const groups=warehouseNavigation(user),[group,setGroup]=useState(''),[leaf,setLeaf]=useState(''),[focus,setFocus]=useState('');
 const available=Object.entries(groups).filter(([,items])=>items.length);
 useEffect(()=>{
  const target=parseWarehouseTarget(targetId);setFocus('');
  if(!target){setGroup('');setLeaf('');return;}
  const entries=available.flatMap(([group,items])=>items.map(item=>({group,item})));
  const preferred=target.source==='after-sales'&&['home:stock','hospital:stock'].includes(target.view)?'material-stock':!target.view&&(target.source==='flow'&&target.target?(records.some(r=>r.id===target.target&&r.kind==='device')?'production':'receipts'):target.source==='inventory'?'material-stock':target.source==='fulfillment'?'dispatch':'');
  const match=(preferred?entries.find(({item})=>item.key===preferred):undefined)||entries.find(({group,item})=>(!target.view.startsWith('operation:')||group==='operations')&&item.source===target.source&&(!target.view||item.view===target.view.replace(/^operation:/,'')));
  if(match){setGroup(match.group);setLeaf(match.item.key);setFocus(target.target);if(target.source==='batch'&&target.target){const row=records.find(row=>row.id===target.target&&row.kind==='batch');if(row)onOpen(row);}}else{setGroup('');setLeaf('');}
 },[targetId]);
 const choices=groups[group]||[],active=choices.find(item=>item.key===leaf),taskOverview=group==='tasks'&&!leaf;
 const openGroup=(key:string)=>{if(!groups[key]?.length)return false;setGroup(key);setFocus('');setLeaf(key!=='tasks'&&groups[key].length===1?groups[key][0].key:'');};
 function render(item:WarehouseEntry,receiptLaunch?:number){
  const key=item.key+focus;
  if((item.source==='flow'||item.source==='warehouse')&&item.view==='stock')return <WarehouseStockPanel key={key} user={user} demo={demo} onOpen={onOpen} onHistory={g=>onNavigate('warehouse',stockHistoryTarget(g))}/>;
  if(item.source==='flow')return <MaterialFlow key={key} hideHeading receiptLaunch={receiptLaunch} initialTab={item.view==='nonconforming'?'requests':item.view} initialAction={item.view==='nonconforming'?'reject':undefined} embedded onWarehouseReceipt={item.view==='materials'?(mid=>onNavigate('warehouse',warehouseTarget('flow','new-receipt:'+mid,'receipts'))):undefined} targetId={focus} demo={demo} onSaved={onSaved} onOpen={onOpen}/>;
  if(item.source==='inventory')return <ProductionPanel key={key} embedded stockMode={item.view as 'report'|'transfer'|'opening'} view="stock" records={records} user={user} demo={demo} onSaved={onSaved}/>;
  if(item.source==='fulfillment')return <FulfillmentPanel key={key} embedded initialTab={item.view} demo={demo} onSaved={onSaved}/>;
  if(item.source==='batch')return <WarehouseHistoryPanel key={key} demo={demo} initial={parseStockHistory(focus)}/>;
  if(item.source==='sales')return <WarehouseReturnsPanel key={key} demo={demo} onSaved={onSaved}/>;
  if(item.source==='after-sales'){const [domain,tab]=item.view.split(':');return <AfterSalesPanel key={key} embedded initialTab={tab} demo={demo} user={user} domain={domain} onNavigate={onNavigate}/>;}
  if(item.source==='build-projects')return <BuildProjectsPanel key={key} warehouseOnly initialTab="materials" onNavigate={onNavigate} demo={demo} targetId={focus}/>;
  return null;
 }
 return <ProgramWorkspace programId="warehouse" title="انبار" direct={!!active&&!!targetId}>
  <SubprogramNavigation showLabel={false} items={available.map(([key])=>[key,warehouseGroupTitles[key]])} value={group} onChange={openGroup}/>
  {group&&<ProgramWorkspace key={group+(active||taskOverview?'leaf':'menu')} programId={'warehouse-'+group} title={warehouseGroupTitles[group]} direct={group==='operations'||!!active||taskOverview}>
   {group!=='operations'&&group!=='dispatch'&&!taskOverview&&<SubprogramNavigation showLabel={false} items={choices.map(item=>[item.key,item.title])} value={leaf} onChange={key=>{if(!choices.some(item=>item.key===key))return false;setLeaf(key);setFocus('');}}/>}
   <nav className="warehouse-page-path" aria-label="مسیر صفحه انبار" dir="rtl"><ol>{['انبار',warehouseGroupTitles[group],...(active&&active.title!==warehouseGroupTitles[group]?[active.title]:[])].map((title,index,path)=><li key={index}>{index>0&&<span className="warehouse-page-path__separator" aria-hidden="true">←</span>}<span aria-current={index===path.length-1?'page':undefined}>{title}</span></li>)}</ol></nav>
   {taskOverview&&<>{choices.map(item=><div key={item.key}>{render(item)}</div>)}</>}
   {group==='operations'&&<WarehouseOperations key={leaf+focus} entries={choices} initial={active} renderSource={render} demo={demo} onSaved={onSaved}/>}
   {group==='dispatch'&&<WarehouseDispatchPanel demo={demo} user={user} onSaved={onSaved} onNavigate={onNavigate}/>}
   {group!=='operations'&&group!=='dispatch'&&active&&render(active)}
  </ProgramWorkspace>}
  {!available.length&&<p className="notice">برای این حساب کار مجازی در انبار تعریف نشده است.</p>}
 </ProgramWorkspace>;
}
