import {storage} from './storage';
import {trainingContext} from './training-context';
import {trainingRoles} from './training-contract';
import {dayAt,addDay} from './duties';
export async function prepareTechnicianTraining(){if(!trainingContext.getStore())throw Error('Training only');const db=storage(),now=new Date().toISOString(),today=dayAt();
 const stmts:D1PreparedStatement[]=[];
 for(const r of trainingRoles.filter(r=>['تکنسین فنی بیمارستانی','تکنسین فنی خانگی'].includes(r.name)))stmts.push(db.prepare("INSERT OR IGNORE INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'آموزش','active',?,?,1,?,?)").bind(r.memberId,r.session.email,r.session.name,r.session.userId,JSON.stringify(r.session.permissions),now,now));
 if(await db.prepare("SELECT id FROM flow_entities WHERE id='training-technician-ready'").first()){if(stmts.length)await db.batch(stmts);return;}
 const who=(name:string)=>trainingRoles.find(r=>r.name===name)!.memberId,tid=who('تکنسین فنی بیمارستانی');
 const put=(id:string,type:string,data:any)=>stmts.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now));
 put('training-technician-job','hospital_job',{centerId:'training-hospital-1',assetId:'training-hospital-asset-1',deviceId:'training-device-1-2',serial:'TEST-TP1-002',model:'مدل آموزشی ۱',description:'بازدید آموزشی پنل تکنسین فنی بیمارستانی',contact:'مسئول فرضی مرکز',kind:'service',urgency:'normal',state:'dispatched',technicianId:tid,dispatch:{at:now,notes:'اعزام فرضی آموزشی'},quote:null,report:null,confirmation:null});
 put('training-technician-form','hospital_form',{centerId:'training-hospital-1',assetId:'training-hospital-asset-1',title:'فرم آموزشی بازدید تکنسین — فاقد معیار پزشکی',version:1,state:'published',audience:'technician',reference:'آزمون نرم‌افزار',fields:[{key:'label',label:'برچسب فرضی دستگاه خوانده شد',type:'result',unit:'',min:'',max:'',required:true},{key:'notes',label:'شرح مشاهده آموزشی',type:'text',unit:'',min:'',max:'',required:true}]});
 const policy:any=await db.prepare("SELECT * FROM flow_entities WHERE id='training-expense-policy'").first();if(policy){const d=JSON.parse(policy.data);if(!d.assignments.some((a:any)=>a.ownerId===tid)){d.assignments.push({ownerId:tid,managerId:who('هماهنگ‌کننده خدمات'),financeId:who('مالی خدمات')});stmts.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify(d),now,policy.id));}}
 put('training-technician-ready','training_workspace',{ready:true});await db.batch(stmts);
}
