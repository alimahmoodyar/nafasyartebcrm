import {prepareTechnicianTraining} from './technician-training';
import {prepareExpenseTraining} from './expense-training';
import {prepareHospitalTraining} from './hospital-training';
import {storage} from './storage';
import {trainingRoles} from './training-contract';
import {mcpActor} from './mcp/context';
import {trainingRoutes} from './training-routes';
import {syncMaterialTasks} from './material-tasks';
import {syncSalesTasks} from './sales-tasks';
import {syncSourcingFollowups} from './sourcing';
import {syncServiceTasks} from './after-sales';
import {dayAt,addDay} from './duties';
export async function prepareTrainingExercises(origin:string){
 const db=storage();await prepareHospitalTraining();await prepareExpenseTraining();await prepareTechnicianTraining();if(await db.prepare("SELECT id FROM flow_entities WHERE id='training-ready'").first())return;
 const admin=trainingRoles.find(r=>r.name==='مدیر سامانه')!;
 await mcpActor.run(admin.session,async()=>{
  async function post(path:string,body:any){
   if(body.id&&await db.prepare('SELECT id FROM inventory_operations WHERE id=?').bind(body.id).first())return;
   const r=await trainingRoutes[path].POST(new Request(new URL('/api/'+path,origin),{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({...body,confirmed:true})}));const d=await r.json();if(!r.ok)throw Error('Training '+path+': '+JSON.stringify(d));return d as any;
  }
  for(let i=1;i<=3;i++){
   const agentId='training-sales-agent-'+i,id='00000000-0000-4000-8000-00000000000'+i;
   if(!await db.prepare('SELECT id FROM inventory_operations WHERE id=?').bind(id).first()){
    const items=[{productId:'training-product-'+i,quantity:i+1}],q=await post('sales/quote',{agentId,items});
    await post('sales',{id,mode:'order',agentId,items,quoteHash:q.quoteHash,notes:'سفارش فرضی برای تمرین',requestSource:{channel:'phone',contactName:'نماینده نمونه',day:dayAt(),reference:'درخواست آموزشی'}});
   }
  }
  const agentId='training-sales-agent-1',orderId='00000000-0000-4000-8000-000000000001';
  await post('sales',{id:'00000000-0000-4000-8000-000000000011',mode:'order_review',agentId,orderId,revision:1,approved:true,notes:'تأیید آزمایشی سفارش'});
  await post('sales',{id:'00000000-0000-4000-8000-000000000012',mode:'invoice',agentId,orderId,revision:2,reference:'TEST-INVOICE-001',installments:[{id:'test-installment-1',due:addDay(dayAt(),7),amount:'20000000'}],notes:'فاکتور فرضی'});
  for(let i=1;i<=2;i++)await post('after-sales',{id:'00000000-0000-4000-8000-00000000002'+i,mode:'create',domain:'home',agentId:i===1?'training-service-agent-1':'',serial:'TEST-TP'+i+'-002',day:dayAt(),model:'مدل آموزشی '+i,customer:'مشتری فرضی '+i,phone:'000-TEST',province:'تهران',city:'تهران',complaint:'صدای فرضی برای تمرین عیب‌یابی'});
  await post('after-sales',{id:'00000000-0000-4000-8000-000000000031',mode:'office_stock',domain:'home',batchId:'training-batch-1',location:'A-1-1-1',quantity:'5',costRial:'100000'});
  await post('transport',{id:'00000000-0000-4000-8000-000000000041',mode:'vehicle',name:'خودروی فرضی ۱',plate:'TEST-001',active:true,notes:'صرفاً آموزش'});
  await post('transport',{id:'00000000-0000-4000-8000-000000000042',mode:'create',sourceKey:'as_case:00000000-0000-4000-8000-000000000021',packages:1,route:'direct',pickup:'نشانی فرضی مشتری',destination:'پذیرش خدمات نمونه',recipient:'مسئول پذیرش',phone:'000-TEST',due:addDay(dayAt(),2),receiverId:trainingRoles.find(r=>r.name==='پذیرش خدمات')!.memberId,notes:'درخواست حمل آزمایشی'});
  await syncMaterialTasks();await syncSalesTasks();await syncServiceTasks();await syncSourcingFollowups();
 });
 const now=new Date().toISOString();await db.prepare("INSERT OR IGNORE INTO flow_entities(id,type,data,revision,created,updated) SELECT 'training-ready','training_workspace',data,1,?,? FROM flow_entities WHERE id='training-base'").bind(now,now).run();
}
