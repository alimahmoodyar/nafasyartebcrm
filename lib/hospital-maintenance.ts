import {storage} from './storage';
import {hospitalRows} from './hospital';
import {salesLock} from './sales';
import {dayAt} from './duties';
export const dayDiff=(a:string,b:string)=>(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;
export function maintenanceForecast(asset:any,rows:any[],today=dayAt()){
 const p=asset.data.maintenance;if(!p?.enabled)return {enabled:false};
 const readings=rows.filter(r=>r.type==='hospital_reading'&&r.data.assetId===asset.id&&!r.data.voided).sort((a,b)=>a.data.day.localeCompare(b.data.day)||a.data.hours-b.data.hours);
 const services=rows.filter(r=>r.type==='hospital_job'&&r.data.assetId===asset.id&&r.data.pm&&r.data.state==='confirmed'&&Number.isFinite(r.data.report?.serviceHours)).sort((a,b)=>b.data.report.serviceHours-a.data.report.serviceHours);
 const completed=services.find(r=>r.data.report.serviceHours>=p.baselineHours&&r.data.report.serviceDay>=p.baselineDay);
 const baselineHours=completed?.data.report.serviceHours??p.baselineHours,baselineDay=completed?.data.report.serviceDay??p.baselineDay,baselineSource=completed?.id||'policy-'+p.version,target=baselineHours+p.interval;
 const eligible=readings.filter(r=>r.data.day>=baselineDay&&r.data.hours>=baselineHours),last=eligible.at(-1);
 // Use latest reading of each day; three separate observed dates are required.
 const daily=new Map<string,any>();for(const r of readings)daily.set(r.data.day,r);const recent=[...daily.values()].slice(-5),span=recent.length?dayDiff(recent.at(-1).data.day,recent[0].data.day):0;
 const rate=recent.length>=3&&span>0?Math.min(24,(recent.at(-1).data.hours-recent[0].data.hours)/span):null;
 const age=last?dayDiff(today,last.data.day):null,stale=!last||age!>p.staleDays;
 const remaining=last?target-last.data.hours:null,estimatedHours=last&&!stale&&rate!==null?last.data.hours+rate*age!:null;
 const daysRemaining=estimatedHours!==null&&rate!>0?Math.max(0,Math.ceil((target-estimatedHours)/rate!)):null;
 const predictedDay=daysRemaining!==null&&daysRemaining<=36500?new Date(Date.parse(today+'T00:00:00Z')+daysRemaining*86400000).toISOString().slice(0,10):null;
 const overdue=remaining!==null&&remaining<=0,near=remaining!==null&&remaining<=p.leadHours,forecastNear=!stale&&daysRemaining!==null&&daysRemaining<=p.leadDays;
 const activeJob=rows.find(r=>r.type==='hospital_job'&&r.data.assetId===asset.id&&r.data.pm&&r.data.state!=='confirmed');
 return {enabled:true,baselineHours,baselineDay,baselineSource,target,last:last?{id:last.id,...last.data}:null,readings:eligible.length,distinctDays:daily.size,rate,age,stale,remaining,estimatedHours,daysRemaining,predictedDay,overdue,due:overdue||near||forecastNear,reason:overdue?'ساعت ثبت‌شده از موعد سرویس عبور کرده':near?'ساعت ثبت‌شده نزدیک موعد سرویس است':forecastNear?'پیش‌بینی رسیدن به موعد سرویس در بازه هشدار':'هنوز به محدوده هشدار نرسیده',activeJobId:activeJob?.id||'',policy:p};
}
export async function scanHospitalMaintenance(source='interactive'){
 const db=storage(),id=crypto.randomUUID(),checks=await salesLock(db,id),rows=await hospitalRows(),now=new Date().toISOString(),stmts:D1PreparedStatement[]=[],created:string[]=[];
 for(const a of rows.filter(r=>r.type==='hospital_asset')){const center=rows.find(r=>r.id===a.data.centerId&&r.type==='hospital_center');if(!center?.data.active)continue;const f:any=maintenanceForecast(a,rows);if(!f.enabled||!f.due||f.activeJobId)continue;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.id+':'+f.baselineSource)))).map(v=>v.toString(16).padStart(2,'0')).join('');const jid='hospital-pm:'+digest;if(rows.some(r=>r.id===jid))continue;
 const data={centerId:a.data.centerId,assetId:a.id,deviceId:a.data.deviceId,serial:a.data.serial,model:a.data.model,kind:'service',urgency:f.overdue?'urgent':'normal',description:'سرویس دوره‌ای در '+f.target+' ساعت — '+f.reason,contact:center.data.phone||'',state:'requested',quote:null,quoteVersion:0,consent:null,technicianId:'',report:null,confirmation:null,pm:{target:f.target,baselineHours:f.baselineHours,baselineSource:f.baselineSource,forecastAt:now,predictedDay:f.predictedDay,rate:f.rate,readingId:f.last?.id,reason:f.reason},history:[{mode:'pm_auto_request',actor:'workflow',at:now}]};
 stmts.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(jid,'hospital_job',JSON.stringify(data),now,now));created.push(jid);
 }
 const previous=rows.find(r=>r.id==='hospital-monitor-health');const health={lastScan:now,source,lastRequested:source==='requested'?now:previous?.data.lastRequested||null,lastBackground:source==='background'?now:previous?.data.lastBackground||null,created:created.length};
 stmts.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('hospital-monitor-health','hospital_health',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind(JSON.stringify(health),now,now));
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'hospital_pm_scan',?,'workflow',?,1)").bind(id,JSON.stringify({source,created}),now),...checks,...stmts]);return {created,health};
}
