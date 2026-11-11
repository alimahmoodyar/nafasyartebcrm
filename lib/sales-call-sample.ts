import {trainingContext} from './training-context';
import {storage} from './storage';
import {dayAt,addDay} from './duties';
import type {Session} from './permissions';

const roles=['home-sales','hospital-sales','sales-manager'];
export const usesSalesCallSample=(u:Session)=>!!u.profileReview&&!u.profileReview.buyerId&&roles.includes(u.profileReview.id);

export async function withSalesCallSample<T>(u:Session,work:()=>Promise<T>):Promise<T>{
 if(!usesSalesCallSample(u))return work();
 return trainingContext.run({actor:u.userId,role:u.profileReview!.id},async()=>{
  const {seedTraining}=await import('./training-seed');
  await seedTraining(u.userId);
  const db=storage(),today=dayAt(),now=new Date().toISOString(),prefix='sales-call-demo:'+u.userId+':';
  const seed=(id:string,type:string,data:any,age=0)=>db.prepare('INSERT OR IGNORE INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(prefix+id,type,JSON.stringify({...data,callSample:u.userId}),addDay(today,-age)+'T08:00:00.000Z',now);
  if(!await db.prepare('SELECT 1 FROM flow_entities WHERE id=?').bind(prefix+'ready').first()){
   const home=prefix+'home',hospital=prefix+'hospital';
   const order=prefix+'order',lead=prefix+'lead';
   const writes=[
    seed('home','sales_agent',{kind:'representative',name:'نمایندگی آزمایشی سپهر',active:true,ownerId:prefix+'home-sales',contactDays:30,reorderDays:60},90),
    seed('hospital','sales_agent',{kind:'reseller',name:'عامل فروش آزمایشی آفتاب',active:true,ownerId:prefix+'hospital-sales',contactDays:30,reorderDays:60},100),
    seed('invoice-1','sales_invoice',{agentId:home,day:addDay(today,-40),amount:'10000000',lines:[{quantity:10,net:'10000000',productId:'training-product-1'}],installments:[]},40),
    seed('invoice-2','sales_invoice',{agentId:home,day:addDay(today,-8),amount:'4000000',lines:[{quantity:4,net:'4000000',productId:'training-product-1'}],installments:[]},8),
    seed('reward','sales_reward',{agentId:home,start:addDay(today,-40),end:addDay(today,30),basis:'units',target:'50',productIds:['training-product-1'],period:'quarter',state:'active'},40),
    seed('lead','sales_lead',{title:'مرکز درمانی آزمایشی',contactName:'مرکز درمانی آزمایشی',phone:'02155501010',ownerId:prefix+'hospital-sales',segment:'hospital',stage:'converted',orderId:order},3),
    seed('order','sales_order',{agentId:hospital,leadId:lead,state:'submitted',code:'سفارش آزمایشی',createdBy:prefix+'hospital-sales'}),
    seed('call-1','sales_contact',{agentId:home,name:'نمایندگی آزمایشی سپهر',day:addDay(today,-35),channel:'call',callKind:'partner',result:'discussed',segment:'home',actor:prefix+'home-sales',actorName:'کارشناس خانگی · آزمایشی',notes:'تأمین مدل پرفروش بررسی شود.'},35),
    seed('call-2','sales_contact',{leadId:lead,name:'مرکز درمانی آزمایشی',day:today,channel:'call',callKind:'incoming',result:'quote',segment:'hospital',actor:prefix+'hospital-sales',actorName:'کارشناس بیمارستانی · آزمایشی',notes:'پیش‌فاکتور برای مرکز درخواست شد.'}),
    seed('call-3','sales_contact',{agentId:hospital,name:'عامل فروش آزمایشی آفتاب',day:addDay(today,-2),channel:'call',callKind:'partner',result:'no_answer',nextAction:'تماس مجدد دربارهٔ نیاز خرید',nextDue:addDay(today,-1),segment:'hospital',actor:prefix+'hospital-sales',actorName:'کارشناس بیمارستانی · آزمایشی'},2),
    seed('ready','training_workspace',{})
   ];
   await db.batch(writes);
  }
  return work();
 });
}
