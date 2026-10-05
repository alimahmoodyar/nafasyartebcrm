import {syncHospitalTasks} from '@/lib/hospital-tasks';
import {syncMaterialTasks} from '@/lib/material-tasks';
import {scanSalesMonitor} from '@/lib/sales-monitor';
import {syncSalesTasks} from '@/lib/sales-tasks';
import {syncSupplierQuality} from '@/lib/supplier-quality';
import {scanReplenishment} from '@/lib/replenishment';
import {syncTransportTasks,installTransportPositions} from '@/lib/transport';
import {syncServiceTasks,installServicePositions} from '@/lib/after-sales';
import {installSupplyPositions,syncSourcingFollowups} from '@/lib/sourcing';
import {env} from 'cloudflare:workers';
import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {tickDuties} from '@/lib/duties';
import {storage} from '@/lib/storage';
import {installDutyStarter} from '@/lib/duty-starter-install';
import {sha256} from '@/lib/firmware';
export async function POST(request:Request){try{
 let source='interactive';const supplied=request.headers.get('authorization');
 if(supplied){if(!env.TASK_SCHEDULER_TOKEN||await sha256(new TextEncoder().encode(supplied).buffer)!==await sha256(new TextEncoder().encode('Bearer '+env.TASK_SCHEDULER_TOKEN).buffer))throw new AccessError('دسترسی زمان‌بند مجاز نیست.',401);source='background';}else{checkOrigin(request);const user=await requireAccess();if(user.isAdmin){await installDutyStarter(user);await installSupplyPositions(user);await installServicePositions(user);await installTransportPositions(user);}}
 const last:any=await storage().prepare("SELECT updated FROM flow_entities WHERE id='duty_scheduler'").first();if(source!=='background'&&last&&Date.now()-Date.parse(last.updated)<60000)return Response.json({skipped:true,at:last.updated},{headers:{'Cache-Control':'no-store'}});
 await syncHospitalTasks();
 await syncMaterialTasks();
 await scanReplenishment();
 await syncSourcingFollowups();
 await syncSupplierQuality();
 await syncSalesTasks();
 await scanSalesMonitor({source});
 await syncServiceTasks();
 await syncTransportTasks();
 const result=await tickDuties(new Date(),source);if(source==='background'){const now=new Date().toISOString();await storage().prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('replenishment-background','workflow_health','{}',1,?,?) ON CONFLICT(id) DO UPDATE SET revision=flow_entities.revision+1,updated=excluded.updated").bind(now,now).run();}
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'زمان‌بند اجرا نشد؛ مهاجرت‌های 0013، 0014 و 0015 و تنظیمات سرور را بررسی کنید.'},{status:503})}}
