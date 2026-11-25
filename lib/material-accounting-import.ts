import {AccessError} from './authorization';
import {clean} from './bom-import';
import {materialAccountingCode,materialAccountingKey,materialAccountingSql,nextMaterialCode} from './material-accounting-code';
import {normalizeMaterialUnit} from './material-units';
import {financeMaterialImportLimit} from './material-import';
import type {Session} from './permissions';
import {storage} from './storage';

type Master={id:string;data:string;revision:number};
type CatalogEntry=Master&{values:{code:string;name:string;unit:string;accountingCode?:string}};
type SourceRow={code:string;name:string;unit:string;existingCode:string;createNew:boolean;issue?:string};
type Change={row:number;accountingCode:string;internalCode:string;name:string;status:'new'|'link'|'existing'|'duplicate'|'skipped'|'review'|'excluded';message:string};
type Plan=Change&{match?:CatalogEntry;source:SourceRow};
const operation='material_accounting_import';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const normName=(value:string)=>clean(value).replace(/[\u200c\u200d\s]+/g,' ').trim().toLowerCase();
const short=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max?clean(value):'';

function importRows(value:unknown,finance:boolean){
 if(!Array.isArray(value)||!value.length||value.length>(finance?financeMaterialImportLimit:200))fail(finance?'فایل باید بین ۱ تا ۱۲۰۰ قلم داشته باشد.':'فایل باید بین ۱ تا ۲۰۰ قلم داشته باشد.');
 return (value as any[]).map((entry,i):SourceRow=>{
  if(!entry||typeof entry!=='object'||['code','name','unit'].some(k=>typeof entry[k]!=='string'))fail('کد، نام و واحد قلم '+(i+1)+' باید متن باشند.');
  if(finance){
   const code=short(entry.code,80),name=short(entry.name,200),unit=normalizeMaterialUnit(short(entry.unit,40));
   const issue=!/^\d{8}$/.test(code)||!name?'کد حسابداری یا نام کالا ناقص یا نامعتبر است.':
    entry.financeIssue==='classification'?'نوع قلم یا عنوان اجرت نیاز به بررسی دارد.':
    entry.financeIssue==='catalog'?'ردیف در فهرست اصلی یافت نشد یا کد، عنوان یا واحد آن مغایرت دارد.':
    !unit?'واحد اصلی خالی است یا در هم‌نفس پشتیبانی نمی‌شود.':undefined;
   return {code,name,unit,existingCode:'',createNew:false,...(issue?{issue}:{})};
  }
  if(entry.name.length>200||entry.unit.length>40||entry.existingCode!==undefined&&typeof entry.existingCode!=='string')fail('اطلاعات قلم '+(i+1)+' معتبر نیست.');
  const code=materialAccountingCode(entry.code),existingCode=short(entry.existingCode,12),unit=clean(entry.unit);
  if(entry.existingCode&&!/^\d{2,12}$/.test(existingCode)||existingCode&&entry.createNew)fail('برای قلم '+(i+1)+' یک تصمیم انتخاب کنید.');
  return {code,name:clean(entry.name),unit:normalizeMaterialUnit(unit)||unit,existingCode,createNew:entry.createNew===true};
 });
}

export async function accountingMaterialImport(user:Session,input:any){
 // Administrator role previews must follow their selected operational rights.
 if(!user.isAdmin||user.profileReview)fail('ورود اکسل حسابداری فقط برای مدیر سامانه است.',403);
 if(!['preview','commit'].includes(input.mode))fail('عملیات ورود کالا معتبر نیست.');
 const finance=input.profile==='finance-frequent';
 const rows=importRows(input.rows,finance),source=short(input.source,500),db=storage();
 if(!source)fail('نام فایل معتبر نیست.');
 const commit=input.mode==='commit',id=String(input.id||'');
 const profile=finance?{profile:input.profile}:{};
 const signature=JSON.stringify({source,rows,catalogSnapshot:input.catalogSnapshot,...profile});
 if(commit){
  if(input.confirmed!==true||!/^[-a-f0-9]{36}$/i.test(id))fail('پیش‌نمایش را تأیید کنید.');
  const prior=await db.prepare('SELECT kind,payload,actor FROM inventory_operations WHERE id=?').bind(id).first<{kind:string;payload:string;actor:string}>();
  if(prior){
   if(prior.kind!==operation||prior.payload!==signature||prior.actor!==user.userId)fail('شناسه عملیات قبلاً استفاده شده است.',409);
   const audit=await db.prepare('SELECT after FROM access_audit WHERE target=? AND actor=? AND action=?').bind(id,user.userId,operation).first<{after:string}>();
   if(!audit)fail('نتیجهٔ ثبت قبلی در دسترس نیست.',409);
   return {...JSON.parse(audit!.after),repeated:true};
  }
 }
 const masters=(await db.prepare("SELECT id,data,revision FROM flow_entities WHERE type='material' ORDER BY id").all<Master>()).results.map(master=>({...master,values:JSON.parse(master.data)}) as CatalogEntry);
 const byCode=new Map(masters.map(m=>[m.values.code,m]));
 const byAccounting=new Map<string,CatalogEntry[]>(),byName=new Map<string,CatalogEntry[]>();
 for(const master of masters){
  const code=materialAccountingKey(master.values.accountingCode||''),name=normName(master.values.name);
  if(code)byAccounting.set(code,[...byAccounting.get(code)||[],master]);
  if(name)byName.set(name,[...byName.get(name)||[],master]);
 }
 const plans:Plan[]=[],seen=new Map<string,SourceRow>(),used=new Set<string>(),warnings:string[]=[],errors:string[]=[];
 const financeCodes=new Map<string,number>();
 if(finance)for(const row of rows)financeCodes.set(row.code,(financeCodes.get(row.code)||0)+1);
 for(const [index,row] of rows.entries()){
  const key=materialAccountingKey(row.code),rowNumber=index+1;
  const add=(status:Change['status'],message:string,match?:CatalogEntry,code=match?.values.code||'')=>{
   plans.push({row:rowNumber,status:finance&&status==='review'?'excluded':status,message,match,internalCode:code,name:match?.values.name||row.name,accountingCode:row.code,source:row});
   if(status==='review'&&!finance)errors.push('قلم '+rowNumber+' ('+row.code+'): '+message);
  };
  if(row.issue){add('excluded',row.issue);continue;}
  if(finance&&(financeCodes.get(key)||0)>1){add('excluded','کد حسابداری در برگه تکرار شده است.');continue;}
  if(!row.code){
   const match=byCode.get(row.existingCode);
   if(match)add('skipped','کد حسابداری خالی است؛ پرونده حفظ می‌شود.',match);
   else add('review','کد حسابداری وارد نشده است.');
   continue;
  }
  const earlier=seen.get(key);
  if(earlier){
   if(normName(earlier.name)===normName(row.name)&&earlier.unit===row.unit&&earlier.existingCode===row.existingCode&&earlier.createNew===row.createNew)add('duplicate','ردیف تکراری داخل فایل');
   else add('review','این کد حسابداری در فایل با اطلاعات متفاوت آمده است.');
   continue;
  }
  seen.set(key,row);
  const registered=byAccounting.get(key)||[],explicit=byCode.get(row.existingCode),legacy=byCode.get(row.code);
  if(registered.length>1){add('review','این کد حسابداری به بیش از یک شناسنامه وصل است.');continue;}
  if(row.existingCode&&!explicit){add('review','کد هم‌نفس واردشده پیدا نشد.');continue;}
  if(registered.length&&(row.createNew||explicit&&explicit.id!==registered[0].id)){
   add('review','این کد حسابداری قبلاً به کالای دیگری وصل شده است.',registered[0]);continue;
  }
  const legacyMatches=legacy&&normName(legacy.values.name)===normName(row.name)&&(!row.unit||normalizeMaterialUnit(legacy.values.unit)===row.unit);
  const match=registered[0]||explicit||(!row.createNew&&legacyMatches?legacy:undefined);
  if(match){
   if(row.unit&&normalizeMaterialUnit(match.values.unit)!==row.unit){add('review','واحد فایل با واحد شناسنامه فرق دارد.',match);continue;}
   if(match.values.accountingCode&&materialAccountingKey(match.values.accountingCode)!==key){add('review','شناسنامهٔ انتخاب‌شده کد حسابداری دیگری دارد.',match);continue;}
   if(used.has(match.values.code)){add('review','بیش از یک کد حسابداری برای همین شناسنامه در فایل انتخاب شده است.',match);continue;}
   used.add(match.values.code);
   if(row.name&&normName(row.name)!==normName(match.values.name))warnings.push('قلم '+rowNumber+': نام شناسنامه «'+match.values.name+'» حفظ می‌شود.');
   add(match.values.accountingCode?'existing':'link',match.values.accountingCode?'از قبل متصل است':'اتصال کد به شناسنامهٔ موجود',match);
   continue;
  }
  const suggestions=byName.get(normName(row.name))||[];
  if(!row.createNew&&(legacy||suggestions.length)){
   const options=[...new Set([legacy,...suggestions].flatMap(m=>m?[m.values.code]:[]))].slice(0,5);
   add('review','پروندهٔ مشابه: '+options.join('، ')+(finance?'؛ تطبیق دستی لازم است.':'؛ کد هم‌نفس را وارد کنید یا «کالای جدید» را انتخاب کنید.'));
   continue;
  }
  const unit=normalizeMaterialUnit(row.unit);
  if(!row.name||!unit){add('review','برای ساخت کالای جدید، نام و واحد معتبر لازم است.');continue;}
  const code=await nextMaterialCode(key,value=>byCode.has(value)||used.has(value));
  used.add(code);add('new','ایجاد شناسنامهٔ جدید',undefined,code);
 }
 const changes=plans.map(({source,match,...change})=>change);
 const fingerprint=JSON.stringify({source,rows,changes,matches:plans.map(x=>x.match?[x.match.id,x.match.revision,x.match.data]:null),...profile});
 const catalogSnapshot=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const count=(status:Change['status'])=>changes.filter(c=>c.status===status).length;
 const counts={totalCount:rows.length,newMaterialCount:count('new'),linkedCount:count('link'),existingCount:count('existing'),duplicateCount:count('duplicate'),skippedCount:count('skipped'),excludedCount:count('excluded')};
 if(!commit)return {changes,errors,warnings,catalogSnapshot,...counts};
 if(errors.length)fail('مغایرت‌های فایل را در پیش‌نمایش برطرف کنید.');
 if(input.catalogSnapshot!==catalogSnapshot)fail('ردیف یا شناسنامه تغییر کرده است. پیش‌نمایش را دوباره بررسی کنید.',409);
 const now=new Date().toISOString(),validations:unknown[][]=[],inserts:unknown[][]=[],updates:unknown[][]=[];
 for(const item of plans){
  if(item.status==='duplicate'||item.status==='skipped'||item.status==='excluded')continue;
  const current=item.match,mid='material:'+item.internalCode;
  validations.push([current?.id||mid,current?.revision??null,current?.data??null,item.status==='existing'?null:materialAccountingKey(item.accountingCode)]);
  if(item.status==='link'&&current)updates.push([current.id,current.revision,{...current.values,accountingCode:item.accountingCode}]);
  if(item.status==='new')inserts.push([mid,{code:item.internalCode,accountingCode:item.accountingCode,name:item.source.name,unit:item.source.unit,kind:'raw',specs:'',fields:[],qcSetupRequired:true,importSource:source,importKind:operation}]);
 }
 const statements=(rows:unknown[][],query:string,...args:unknown[])=>{
  const result:D1PreparedStatement[]=[];
  for(let i=0;i<rows.length;i+=100)result.push(db.prepare(query).bind(JSON.stringify(rows.slice(i,i+100)),...args));
  return result;
 };
 const checks=statements(validations,`WITH candidates AS (
  SELECT json_extract(value,'$[0]') AS item_id,json_extract(value,'$[1]') AS revision,
   json_extract(value,'$[2]') AS original,json_extract(value,'$[3]') AS accounting_key FROM json_each(?)
 ) UPDATE inventory_operations SET guard=CASE WHEN NOT EXISTS(
  SELECT 1 FROM candidates c LEFT JOIN flow_entities f ON f.id=c.item_id
  WHERE (c.revision IS NULL AND f.id IS NOT NULL)
  OR (c.revision IS NOT NULL AND (f.id IS NULL OR f.type<>'material' OR f.revision<>c.revision OR f.data<>c.original))
  OR (c.accounting_key IS NOT NULL AND EXISTS(SELECT 1 FROM flow_entities WHERE type='material' AND ${materialAccountingSql}=c.accounting_key))
 ) THEN guard ELSE 0 END WHERE id=?`,id);
 const writes=[
  ...statements(inserts,"WITH incoming AS (SELECT value FROM json_each(?)) INSERT INTO flow_entities(id,type,data,revision,created,updated) SELECT json_extract(value,'$[0]'),'material',json_extract(value,'$[1]'),1,?,? FROM incoming",now,now),
  ...statements(updates,"WITH changes AS (SELECT json_extract(value,'$[0]') AS item_id,json_extract(value,'$[1]') AS expected,json_extract(value,'$[2]') AS next FROM json_each(?)) UPDATE flow_entities AS f SET data=c.next,revision=f.revision+1,updated=? FROM changes c WHERE f.id=c.item_id AND f.revision=c.expected",now)
 ];
 const result={saved:true,importId:id,source,...counts};
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,operation,signature,user.userId,now),...checks,...writes,
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,id,operation,JSON.stringify(result),now)]);
 return result;
}
