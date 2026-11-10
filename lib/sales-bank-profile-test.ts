import {AccessError} from './authorization';
import {storage} from './storage';
import {trainingContext} from './training-context';
import {salesEntity,salesRows} from './sales';
import {usesAssignedSalesAccounts} from './sales-contract';
import type {Session} from './permissions';

export function runBankProfileTest<T>(user:Session,work:()=>Promise<T>){
 const role=user.profileReview?.id;
 if(role!=='sales-finance'&&role!=='treasurer'&&role!=='sales-representative')throw new AccessError('پروفایل آزمایشی فروش یا خزانه‌دار لازم است.',403);
 return trainingContext.run({actor:user.userId,role,salesBankTest:true},work);
}

export async function bankTestBuyer(user:Session,id:string){
 const buyer=await salesEntity(id,'sales_agent');
 if(!buyer.data.active||!usesAssignedSalesAccounts(buyer.data.kind))throw new AccessError('نماینده یا عامل فروش فعال لازم است.',404);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.userId+'\n'+buyer.id));
 const testId='role-bank-buyer:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 return {id:testId,realId:buyer.id,data:{name:buyer.data.name,kind:buyer.data.kind||'representative',active:true,province:buyer.data.province||'',city:buyer.data.city||'',creditLimit:'0',termDays:0,profileTestOwner:user.userId,profileTestBuyerId:buyer.id}};
}

export async function bankTestBuyers(){
 return (await salesRows()).filter(buyer=>buyer.type==='sales_agent'&&buyer.data.active&&usesAssignedSalesAccounts(buyer.data.kind)).map(buyer=>({id:buyer.id,name:buyer.data.name,kind:buyer.data.kind||'representative'}));
}

export async function openBankTestBuyer(buyer:Awaited<ReturnType<typeof bankTestBuyer>>){
 const now=new Date().toISOString();
 await storage().prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_agent',?,1,?,?) ON CONFLICT(id) DO NOTHING").bind(buyer.id,JSON.stringify(buyer.data),now,now).run();
}
