import {storage} from './storage';
import {assetIdentity,afail} from './asset-workflow';
import {assetInternal} from './assets';
import {custodianProfileWork} from './asset-profile-work';
import type {Session} from './permissions';
const normalize=(s:string)=>s.normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u065F\u0670\u0640\u200c\u200d\s]/g,'').toLocaleLowerCase();
const holderIdSql="json_extract(data,'$.holderId')";
const currentEmployeeAssets="type='asset_item' AND json_extract(data,'$.holderKind')='employee' AND coalesce(json_extract(data,'$.lifecycle'),'active')<>'disposed'";
// Reads the accepted handover events and legacy snapshots; requests/cancellations
// never become receipts. Names come from the current asset passport, not a new ledger.
const historySql=`WITH moves AS (
 SELECT e.id,json_extract(e.data,'$.assetId') assetId,json_extract(e.data,'$.at') at,
 json_extract(e.data,'$.details.from.kind') fromKind,json_extract(e.data,'$.details.from.id') fromId,json_extract(e.data,'$.details.from.name') fromName,json_extract(e.data,'$.details.from.location') fromLocation,
 json_extract(e.data,'$.details.to.kind') toKind,json_extract(e.data,'$.details.to.id') toId,json_extract(e.data,'$.details.to.name') toName,json_extract(e.data,'$.details.to.location') toLocation,'event' source
 FROM flow_entities e WHERE e.type='asset_event' AND json_extract(e.data,'$.mode')='accept_transfer'
 UNION ALL
 SELECT a.id||':legacy:'||h.key,a.id,json_extract(h.value,'$.at'),
 json_extract(prev.value,'$.holderKind'),json_extract(prev.value,'$.holderId'),json_extract(prev.value,'$.holderName'),json_extract(prev.value,'$.location'),
 json_extract(h.value,'$.holderKind'),json_extract(h.value,'$.holderId'),json_extract(h.value,'$.holderName'),json_extract(h.value,'$.location'),'legacy'
 FROM flow_entities a,json_each(a.data,'$.history') h LEFT JOIN json_each(a.data,'$.history') prev ON CAST(prev.key AS INTEGER)=CAST(h.key AS INTEGER)-1
 WHERE a.type='asset_item' AND json_extract(h.value,'$.mode')='transfer'
 ) SELECT m.*,json_extract(a.data,'$.name') assetName,json_extract(a.data,'$.code') assetCode
 FROM moves m JOIN flow_entities a ON a.id=m.assetId AND a.type='asset_item'
 WHERE (m.fromKind='employee' AND m.fromId=?) OR (m.toKind='employee' AND m.toId=?)
 ORDER BY m.at DESC,m.id DESC LIMIT 31 OFFSET ?`;
export async function assetPersonView(u:Session,q:URLSearchParams){
 const a=await assetIdentity(u);if(!a.custodian)afail('دسترسی اموال‌دار لازم است.',403);
 const view=q.get('view')||'people',raw=q.get('offset')||'0',offset=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(offset)||offset>1000000)afail('شماره صفحه معتبر نیست.');
 if(view==='work')return {accountId:u.userId,...await custodianProfileWork(u)};
 const db=storage(),units=(await db.prepare('SELECT id,unit FROM app_members').all()).results as any[],unitMap=new Map(units.map(m=>[m.id,m.unit]));
 const people=a.members.filter(m=>assetInternal({...m,status:'active'})).map(m=>({...m,unit:unitMap.get(m.id)||''})),publicPerson=(p:any)=>({id:p.id,name:p.name,unit:p.unit||'',active:p.status==='active'});
 if(view==='people'){
  const words=normalize(String(q.get('q')||'').slice(0,120));if(!words)return {accountId:u.userId,people:[],hasMore:false};
  const holdersOnly=q.get('holdersOnly')==='true';
  const holders=holdersOnly?new Map((await db.prepare(`SELECT ${holderIdSql} AS id, COUNT(*) AS total FROM flow_entities WHERE ${currentEmployeeAssets} GROUP BY ${holderIdSql}`).all<{id:string;total:number}>()).results.map(holder=>[holder.id,holder.total])):null;
  const matches=people.filter(p=>(!holders||holders.has(p.id))&&normalize(p.name+' '+p.id+' '+(p.unit||'')).includes(words)).sort((x,y)=>x.name.localeCompare(y.name,'fa')||x.id.localeCompare(y.id));
  return {accountId:u.userId,people:matches.slice(offset,offset+20).map(p=>({...publicPerson(p),...(holders?{currentTotal:holders.get(p.id)}:{})})),hasMore:matches.length>offset+20};
 }
 if(!['current','history'].includes(view))afail('نوع فهرست معتبر نیست.');
 const person=people.find(p=>p.id===q.get('person'));if(!person)afail('شخص در فهرست کارکنان شرکت پیدا نشد.',404);
 const currentWhere=currentEmployeeAssets+' AND '+holderIdSql+'=?';
 const count:any=await db.prepare('SELECT COUNT(*) n FROM flow_entities WHERE '+currentWhere).bind(person.id).first();
 if(view==='history'){
  const rows=(await db.prepare(historySql).bind(person.id,person.id,offset).all()).results as any[];
  return {accountId:u.userId,person:publicPerson(person),currentTotal:Number(count?.n||0),view,history:rows.slice(0,30).map(m=>({id:m.id,assetId:m.assetId,assetName:m.assetName,assetCode:m.assetCode,at:m.at||'',direction:m.toKind==='employee'&&m.toId===person.id?'received':'released',fromName:m.fromName||'شرکت',toName:m.toName||'شرکت',location:m.toKind==='employee'&&m.toId===person.id?m.toLocation:m.fromLocation,source:m.source})),hasMore:rows.length>30,offset};
 }
 const rows=(await db.prepare('SELECT id,data,revision FROM flow_entities WHERE '+currentWhere+' ORDER BY updated DESC,id DESC LIMIT 31 OFFSET ?').bind(person.id,offset).all()).results as any[];
 return {accountId:u.userId,person:publicPerson(person),currentTotal:Number(count?.n||0),view,records:rows.slice(0,30).map(r=>{const d=JSON.parse(r.data);return {id:r.id,revision:r.revision,data:{name:d.name,code:d.code,category:d.category,condition:d.condition,location:d.location,holderKind:d.holderKind,holderId:d.holderId,holderName:d.holderName,handedAt:d.handedAt||'',handedDay:d.handedDay||'',pending:d.pending?{state:d.pending.state}:null,useState:d.useState}};}),hasMore:rows.length>30,offset};
}
