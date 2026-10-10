import {mcpActor} from './mcp/context';
import type {Session} from './permissions';
import {reminderFields} from './reminder-contract';
import {toolOptions} from './form-options';
import {caseStates} from './after-sales-labels';
import {inboxStates} from './inbox-contract';
import {salesStates} from './sales-contract';
import {personnelStates} from './personnel-contract';
import {qmsStates} from './qms-contract';
import {transportStates} from './transport-contract';
import {developmentStates} from './development-contract';
import {supplyStates} from './sourcing-labels';
import {foreignPhysicalStates,foreignSelectionStates} from './foreign-purchase-contract';
import {shipmentStates} from './shipment-contract';
type Adapter={load:()=>Promise<any>;path:string;keys:string[];types?:string[];flat?:string};
const adapters:Record<string,Adapter>={
 tasks:{load:()=>import('@/app/api/tasks/route'),path:'tasks',keys:['tasks'],flat:'duty_run'},
 inbox:{load:()=>import('@/app/api/inbox/route'),path:'inbox',keys:['threads'],flat:'inbox_thread'},
 projects:{load:()=>import('@/app/api/build-projects/route'),path:'build-projects',keys:['projects']},
 sourcing:{load:()=>import('@/app/api/sourcing/route'),path:'sourcing',keys:['plans'],flat:'sourcing_plan'},
 purchases:{load:()=>import('@/app/api/purchase-payables/route'),path:'purchase-payables',keys:['cases','orders','settlements']},
 shipments:{load:()=>import('@/app/api/purchase-shipments/route'),path:'purchase-shipments',keys:['shipments','orders']},
 foreign:{load:()=>import('@/app/api/foreign-purchases/route'),path:'foreign-purchases',keys:['shipments','selections']},
 flow:{load:()=>import('@/app/api/flow/route'),path:'flow',keys:['entities'],types:['material','receipt','request','supply','plan','build','repair','finaltest','assignment']},
 routine:{load:()=>import('@/app/api/routine-production/route'),path:'routine-production',keys:['jobs','lots']},
 sales:{load:()=>import('@/app/api/sales/route'),path:'sales',keys:['orders','returns','targets','goals']},
 leads:{load:()=>import('@/app/api/sales/leads/route'),path:'sales/leads',keys:['records']},
 home_service:{load:()=>import('@/app/api/after-sales/route'),path:'after-sales?domain=home',keys:['cases','orders','shipments','claims']},
 hospital_service:{load:()=>import('@/app/api/after-sales/route'),path:'after-sales?domain=hospital',keys:['cases','orders','shipments','claims']},
 hospital:{load:()=>import('@/app/api/hospital/route'),path:'hospital',keys:['rows'],types:['hospital_job','hospital_asset','hospital_payment','hospital_invoice','hospital_part_request']},
 transport:{load:()=>import('@/app/api/transport/route'),path:'transport',keys:['missions']},
 personnel:{load:()=>import('@/app/api/personnel/route'),path:'personnel',keys:['records'],types:['hr_request','hr_ruling','hr_payroll','hr_period','hr_assignment','hr_document']},
 qms:{load:()=>import('@/app/api/qms/route'),path:'qms',keys:['records'],types:['qms_record']},
 guarantees:{load:()=>import('@/app/api/guarantees/route'),path:'guarantees',keys:['records']},
 assets:{load:()=>import('@/app/api/assets/route'),path:'assets',keys:['records'],types:['asset_item','asset_custody','asset_clearance']},
 treasury:{load:()=>import('@/app/api/treasury/route'),path:'treasury',keys:['requests','checks','expenses']},
 development:{load:()=>import('@/app/api/development/route'),path:'development?limit=100',keys:['requests']}
};
const common:Record<string,string>={draft:'پیش‌نویس',open:'باز',active:'فعال',pending:'در انتظار بررسی',approved:'تأییدشده',rejected:'ردشده',cancelled:'لغوشده',closed:'بسته‌شده',completed:'تکمیل‌شده',done:'انجام‌شده'};
const catalogs:Record<string,Record<string,string>>={
 tasks:{open:'باز',blocked:'دارای مانع',submitted:'منتظر بررسی',completed:'انجام‌شده',cancelled:'لغوشده'},inbox:inboxStates,sales:salesStates,personnel:personnelStates,qms:qmsStates,transport:transportStates,development:developmentStates,sourcing:supplyStates,
 leads:{new:'جدید',contacted:'تماس اولیه',qualified:'نیازسنجی',proposal:'ارائه پیشنهاد',negotiation:'مذاکره',nurture:'فعلاً آماده خرید نیست',converted:'تبدیل به سفارش',lost:'ازدست‌رفته'},
 shipments:shipmentStates,foreign:foreignSelectionStates,
 purchases:{...common,issued:'صادرشده',paid:'پرداخت‌شده',preparing:'آماده‌سازی',shipped:'ارسال‌شده',received:'دریافت‌شده',partial:'پرداخت جزئی',recognized:'تشخیص داده‌شده',released:'آزادشده'},
 flow:{...common,assembled:'برگ تولید ثبت‌شده',awaiting_receipt:'منتظر رسید محصول',finished:'انبار محصول نهایی',reserved:'رزروشده',in_transit:'در حمل',pending_qc:'منتظر کنترل کیفیت ورودی',awaiting_warehouse:'منتظر جانمایی انبار',stored:'جانمایی‌شده',issued:'تحویل مواد',planned:'برنامه‌ریزی‌شده',assigned:'تخصیص‌یافته',prepared:'آماده',building:'در حال ساخت',testing:'در حال آزمون',passed:'تأیید آزمون',failed:'رد آزمون'},
 projects:{open:'باز',closed:'بسته'},routine:{open:'باز',closed:'بسته'},
 guarantees:{draft:'پیش‌نویس',review:'بررسی مالی',approved:'منتظر صدور یا دریافت',active:'فعال',terminated:'خاتمه؛ پیگیری استرداد',closed:'بسته'},
 treasury:{...common,partial:'پرداخت جزئی',paid:'پرداخت کامل',issued:'صادرشده',settled:'وصول‌شده',returned:'برگشت‌شده'},assets:{...common,cleared:'تسویه‌شده'},
 home_service:{...caseStates,requested:'درخواست جدید',rejected:'ردشده',prepared:'بسته آماده',shipped:'در راه',awaiting_return:'منتظر داغی',sent:'داغی ارسال‌شده',credited:'بستانکاری ثبت شد'},hospital_service:caseStates
};
export async function reminderSources(u:Session,kind:string,targetId?:string,query=''){
 const a=adapters[kind];if(!a)return [];
 if(kind==='tasks'&&targetId){try{const {requireAccess}=await import('./authorization'),{taskAccess}=await import('./duties');await mcpActor.run(u,()=>requireAccess());const r=await taskAccess(targetId,u);return [{id:r.id,type:'duty_run',kind,revision:r.revision,title:r.data.title,fields:{state:{label:'وضعیت وظیفه',current:r.state,options:catalogs.tasks},updated:{label:'هر تغییر ثبت‌شده در وظیفه',current:'',options:{}}}}];}catch(e){if((e as any).status===403||(e as any).status===404)return [];throw e;}}
 const url=new URL('https://reminder.internal/api/'+a.path);if(kind==='inbox'&&targetId)url.searchParams.set('thread',targetId);if(kind==='development'){if(targetId)url.searchParams.set('requestId',targetId);if(query)url.searchParams.set('query',query);}const api=await a.load(),response:Response=await mcpActor.run(u,()=>api.GET(new Request(url)));
 if(response.status===401||response.status===403||response.status===404)return [];
 if(!response.ok)throw Error('REMINDER_SOURCE_UNAVAILABLE');
 const body:any=await response.json();if(body.request)body.requests=[body.request];if(body.thread)body.threads=[body.thread];const stateLabels={...(catalogs[kind]||common),...body.states,...body.stages};
 return a.keys.flatMap(key=>(body[key]||[]).filter((r:any)=>r.id&&(r.type||a.flat)&&(!a.types||a.types.includes(r.type))).map((r:any)=>{
 const d=r.data||r;if(kind==='tasks')d.state=r.state;const tool:Record<string,string>={projects:'build_project_apply',routine:'routine_production_apply',leads:'sales_lead_apply',personnel:'personnel_apply',qms:'apply_qms_record',transport:'transport_apply',foreign:'foreign_purchase_apply',shipments:'purchase_shipment_apply',purchases:'purchase_payables_apply',home_service:'after_sales_apply',hospital_service:'after_sales_apply',treasury:'treasury_apply',assets:'assets_apply',guarantees:'guarantee_apply'};let actions={...(toolOptions[tool[kind]]?.mode||{})};if(kind==='projects'&&!body.roles?.financial)for(const m of ['budget','expense','approve_time','commitment','close_commitment','void','close'])delete actions[m];if(Array.isArray(d.history)&&Object.keys(actions).length)d['history[#-1].mode']=d.history.at(-1)?.mode||'';if(d.foreign&&typeof d.foreign.physical==='string')d['foreign.physical']=d.foreign.physical;const fields=Object.fromEntries(Object.entries(reminderFields).filter(([k])=>k==='updated'||typeof d[k]==='string'||k==='lastReceiptAt'&&r.type==='purchase_order').map(([k,label])=>[k,{label,current:k==='updated'?'':d[k]||'',options:k==='updated'||k.endsWith('At')?{}:{...(k==='history[#-1].mode'?actions:k==='foreign.physical'?foreignPhysicalStates:stateLabels),...(d[k]&&!stateLabels[d[k]]&&k!=='foreign.physical'&&k!=='history[#-1].mode'?{[d[k]]:d[k]}:{})}}]));
 return {id:r.id,type:r.type||a.flat,kind,revision:r.revision,title:String(d.title||d.name||d.productName||d.reference||d.number||d.code||d.serial||r.id),fields};
 }));
}
