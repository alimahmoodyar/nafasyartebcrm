import {hasSupply,needSupply,day,quantity,rial} from './sourcing';
import {taskRequired as req,taskText as text,dayAt} from './duties';
import {storedAccessPermissions} from './permissions';
import {AccessError} from './authorization';
export const procurementOperationModes=['freight_quote','select_freight','review_freight','freight_exception','plan_freight','confirm_selection'] as const;
export async function procurementOperation(c:any){
 const {b,u,plan,get,put,now,db,guard}=c;
 const fail=(s:string,status=400):never=>{throw new AccessError(s,status)};
 const o=await get(req(b.orderId),'purchase_order'),d=o.data;
 if(d.planId!==plan.id||o.revision!==b.orderRevision||['closed','cancelled'].includes(d.state))fail('نسخه جاری سفارش فعال لازم است.',409);
 const supply=()=>{if(!hasSupply(u,'commerce_manager'))needSupply(u,d.route);};
 const stamp={by:u.name,actor:u.userId,at:now};
 if(b.mode==='confirm_selection'){needSupply(u,'commerce_manager');if(!d.selectionReviewRequired||d.state!=='awaiting_funding')fail('انتخاب در انتظار بازبینی نیست.',409);d.selectionReviewRequired=false;d.selectionReason=req(b.notes,4000);d.selectionReviewedBy=u.userId;}
 if(b.mode==='freight_quote'){
  supply();if((d.freightQuotes||[]).length>=20)fail('حداکثر ۲۰ استعلام حمل برای این سفارش.');
  const q={id:b.id,carrier:req(b.carrier,200),phone:req(b.phone,50),vehicle:req(b.vehicle,120),amountRial:rial(b.amountRial),costScope:req(b.costScope,1000),paymentTerms:req(b.paymentTerms,1000),pickupDay:day(b.pickupDay),deliveryDay:day(b.deliveryDay),...stamp};
  if(q.pickupDay<dayAt()||q.deliveryDay<q.pickupDay)fail('زمان حمل معتبر نیست.');
  d.freightQuotes=[...(d.freightQuotes||[]),q];
 }
 if(b.mode==='freight_exception'){needSupply(u,'ceo');d.freightException={notes:req(b.notes,4000),...stamp};}
 if(b.mode==='select_freight'){
  supply();const q=d.freightQuotes?.find((q:any)=>q.id===b.freightQuoteId);if(!q)fail('استعلام حمل انتخاب شود.');
  if(new Set((d.freightQuotes||[]).map((q:any)=>q.carrier.trim())).size<2&&!d.freightException)fail('حداقل دو استعلام حمل یا مجوز استثنا لازم است.');
  const min=(d.freightQuotes||[]).reduce((n:bigint,q:any)=>BigInt(q.amountRial)<n?BigInt(q.amountRial):n,BigInt(q.amountRial));
  const reason=BigInt(q.amountRial)>min?req(b.notes,4000):text(b.notes||'',4000);
  d.selectedFreight={...q,state:'finance',selectionReason:reason,selected:stamp};
 }
 if(b.mode==='review_freight'){
  needSupply(u,'finance');await c.enforceOwner('finance');if(d.selectedFreight?.state!=='finance'||!['pass','fail'].includes(b.result))fail('حمل در انتظار کنترل مالی نیست.');
  d.selectedFreight={...d.selectedFreight,state:b.result==='pass'?'approved':'returned',review:{...stamp,notes:b.result==='fail'?req(b.notes,4000):text(b.notes||'',4000)}};
 }
 if(b.mode==='plan_freight'){
  supply();if(d.transportId){const prior=await get(d.transportId,'transport');if(!['delivered','cancelled'].includes(prior.data.state))fail('حمل قبلی هنوز باز است؛ از همان پرونده ادامه دهید.',409);}if(!d.purchaseConfirmedAt)fail('ابتدا توافق شروع سفارش ثبت شود.');
  if(!['company','carrier','seller'].includes(b.method))fail('روش حمل را انتخاب کنید.');if(b.method==='carrier'&&d.selectedFreight?.state!=='approved')fail('استعلام منتخب حمل باید تأیید مالی شده باشد.');
  const packs=Number(b.packages);if(!Number.isInteger(packs)||packs<1||packs>10000)fail('تعداد بسته معتبر وارد کنید.');
  const amount=quantity(b.quantity);let shipped=0;for(const prior of d.shipments||[]){if(!prior.transportId){shipped+=prior.declaredQuantity||0;continue;}const mission=await get(prior.transportId,'transport');if(mission.data.state!=='cancelled')shipped+=prior.declaredQuantity||0;}if(amount+shipped>d.quantity)fail('مقدار بار از سفارش بیشتر است.');
  const drivers=(await db.prepare("SELECT * FROM app_members WHERE id=? AND status='active'").bind(b.driverId||'').all()).results;
  let driver:any=null,vehicle:any=null;if(b.method==='company'){
   driver=drivers[0];const p=driver&&storedAccessPermissions(driver.permissions);if(!p||!p.transportRoles?.includes('driver')&&!p.flowRoles?.includes('logistics'))fail('راننده فعال مجاز انتخاب کنید.');
   vehicle=await get(req(b.vehicleId),'transport_vehicle');if(!vehicle.data.active)fail('خودرو غیرفعال است.');guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",driver.id,driver.permissions);
  }
  const due=day(b.deliveryDay);if(due<dayAt())fail('موعد حمل در گذشته نباشد.');
  const shipment={id:b.id,declaredQuantity:amount,expectedDay:due,packages:packs,vehicleSize:req(b.vehicleSize,120),packageType:req(b.packageType,100),weight:text(b.weight||'',100),dimensions:text(b.dimensions||'',200),equipment:text(b.equipment||'',1000),pickup:req(b.pickup,1000),pickupPhone:req(b.pickupPhone,50),destination:req(b.destination,1000),recipient:req(b.recipient,200),phone:req(b.destinationPhone,50),notes:text(b.notes||'',4000),...stamp};
  const mission={code:'TR-'+b.id.slice(0,8).toUpperCase(),kind:'purchase_order',sourceId:o.id,sourceRevision:o.revision,sourceIds:[o.id],purchaseRoute:d.route,inbound:true,domain:'',items:[{partCode:d.partCode,name:plan.data.lines?.find((l:any)=>l.partCode===d.partCode)?.name||d.partCode,unit:d.unit,quantity:amount/1000}],route:b.method==='carrier'?'carrier':'direct',state:b.method==='company'?'assigned':'requested',packages:packs,pickup:shipment.pickup,destination:shipment.destination,recipient:shipment.recipient,phone:shipment.phone,pickupPhone:shipment.pickupPhone,due,driverId:driver?.id||'',driverName:driver?.name||'',vehicleId:vehicle?.id||'',vehicleName:vehicle?vehicle.data.name+' · '+vehicle.data.plate:shipment.vehicleSize,receiverId:'',carrier:d.selectedFreight?.carrier||'',waybill:'',tracking:'',missingDocuments:true,notes:shipment.notes,expenses:[],purchaseShipmentId:b.id,purchaseShipping:shipment,history:[{mode:'create',...stamp}]};
  put(b.id,'transport',mission);d.transportId=b.id;d.transportIds=[...(d.transportIds||[]),b.id];d.shipments=[...(d.shipments||[]),{...shipment,transportId:b.id}];
 }
 put(o.id,'purchase_order',{...d,history:[...(d.history||[]),{stage:b.mode,...stamp,notes:text(b.notes||'',4000)}]},o);
}
