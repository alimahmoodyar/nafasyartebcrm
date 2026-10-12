import {buyerSearchText} from './buyer-search';
import {partnerKinds} from './sales-network-contract';

export type AssignedBuyer={id:string;name:string;revision:number;kind:string;ownerId:string;ownerName:string};
export type AssignmentMember={id:string;name:string};
export type AssignmentDirectory={buyers:AssignedBuyer[];members:AssignmentMember[]};
export function assignmentOwners(data:AssignmentDirectory){
 const owners=new Map(data.members.map(m=>[m.id,{...m,eligible:true}]));
 for(const b of data.buyers)if(b.ownerId&&!owners.has(b.ownerId))owners.set(b.ownerId,{id:b.ownerId,name:b.ownerName||'مسئول قبلی',eligible:false});
 return [...owners.values()].sort((a,b)=>a.name.localeCompare(b.name,'fa'));
}
export function assignmentGroups(data:AssignmentDirectory,search='',owner='all',kind=''){
 const words=buyerSearchText(search).split(' ').filter(Boolean),owners=new Map(assignmentOwners(data).map(o=>[o.id,o])),groups=new Map<string,{id:string;name:string;eligible:boolean;total:number;buyers:AssignedBuyer[]}>();
 for(const b of data.buyers){
  const o=owners.get(b.ownerId),name=o?.name||'بدون کارشناس';
  if(!groups.has(b.ownerId))groups.set(b.ownerId,{id:b.ownerId,name,eligible:!!o?.eligible,total:0,buyers:[]});
  const group=groups.get(b.ownerId)!;group.total++;
  const matchesOwner=owner==='all'||owner==='unassigned'&&!b.ownerId||owner==='member:'+b.ownerId;
  const text=buyerSearchText(b.name+' '+name+' '+(partnerKinds[b.kind]||'خریدار'));
  if(matchesOwner&&(!kind||b.kind===kind)&&words.every(word=>text.includes(word)))group.buyers.push(b);
 }
 return [...groups.values()].filter(g=>g.buyers.length).map(g=>({...g,buyers:g.buyers.sort((a,b)=>a.name.localeCompare(b.name,'fa'))})).sort((a,b)=>!a.id?1:!b.id?-1:a.name.localeCompare(b.name,'fa'));
}
