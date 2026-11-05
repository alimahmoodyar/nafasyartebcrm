 'use client';
import {useEffect,useState} from 'react';
import type {Session} from '@/lib/permissions';
import {financeEntries,parseFinanceTarget} from '@/lib/finance-workspace';
import {ProgramWorkspace,SubprogramNavigation} from './program-workspace';
import {TreasuryPanel} from './treasury-panel';
import {GuaranteesPanel} from './guarantees-panel';
import {SalesBankPanel} from './sales-bank-panel';
import {PurchasePayablesPanel} from './purchase-payables-panel';
import {PurchaseSettlementPanel} from './purchase-settlement-panel';
import {ExpenseRegisterPanel} from './expense-register-panel';
import {CostingPanel} from './costing-panel';
import {PricingPanel} from './pricing-panel';
import {FinanceControl} from './finance-control';
import {AssetsPanel} from './assets-panel';
import {PersonnelPanel} from './personnel-panel';
import {SourcingReviewInbox} from './sourcing-review-inbox';
import {FinanceBridge} from './finance-bridge';
export function FinanceWorkspace({user,targetId=''}:{user:Session;targetId?:string}){
 const initial=parseFinanceTarget(targetId),[view,setView]=useState(initial?.key||''),[target,setTarget]=useState(initial?.target||'');
 useEffect(()=>{const next=parseFinanceTarget(targetId);setView(next?.key||'');setTarget(next?.target||'')},[targetId]);
 if(!user.isAdmin)return <p role="alert">دسترسی به ماژول مدیریت مالی ندارید.</p>;
 return <ProgramWorkspace programId="finance-hub" title="مالی" direct={!!targetId}><section className="panel inside" dir="rtl"><h2>مالی</h2><SubprogramNavigation items={financeEntries.map(([key,title])=>[key,title])} value={view} onChange={key=>{setTarget('');setView(key)}}/>
 {view==='treasury'&&<TreasuryPanel targetId={target}/>}
 {view==='guarantees'&&<GuaranteesPanel targetId={target}/>}
 {view==='sales-bank'&&<SalesBankPanel/>}
 {view==='purchase-review'&&<SourcingReviewInbox workspace="finance" targetId={target}/>}
 {view==='payables'&&<PurchasePayablesPanel/>}
 {view==='settlements'&&<PurchaseSettlementPanel/>}
 {view==='expenses'&&<ExpenseRegisterPanel/>}
 {view==='costing'&&<CostingPanel purchaseSections={false}/>}
 {view==='pricing'&&<PricingPanel/>}
 {view==='finance-control'&&<FinanceControl write={true} demo={false} purchase={false} targetId={target}/>}
 {view==='assets'&&<AssetsPanel targetId={target}/>}
 {view==='payroll'&&<PersonnelPanel key="finance-payroll" initialManagementView="hr_payroll"/>}
 {view==='advances'&&<PersonnelPanel key="finance-advances" initialManagementView="advances"/>}
 {view==='bridge'&&<FinanceBridge/>}
 </section></ProgramWorkspace>;
}
