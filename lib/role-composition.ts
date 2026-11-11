import type {Session} from './permissions';
import {roleProfiles,type RoleLink,type ProfileWork} from './role-profiles';
import {profileSession,validProfileScope} from './profile-review';

// Inactive infrastructure: no cookie, route, account or displayed profile uses
// this composition until an explicit activation change is requested.
export type RoleComposition={profileIds:string[];title:string;contexts:Session[];links:(RoleLink&{profileIds:string[]})[]};
export function compositionProfiles(input:unknown){
 if(!Array.isArray(input)||!input.length||input.length>roleProfiles.length||input.some(id=>typeof id!=='string'))throw Error('حداقل یک نقش معتبر انتخاب کنید.');
 const ids=[...new Set(input as string[])].sort(),profiles=ids.map(id=>roleProfiles.find(p=>p.id===id));
 if(profiles.some(p=>!p?.operational))throw Error('نقش عملیاتی معتبر انتخاب کنید.');
 const selected=profiles as NonNullable<typeof profiles[number]>[];
 if(selected.length>1&&selected.some(p=>p.buyerScope==='required'))throw Error('نمایندگی بیرونی با نقش‌های کارکنان ترکیب نمی‌شود.');
 return selected;
}
export function compositionLinks(profiles:ReturnType<typeof compositionProfiles>){
 const links=new Map<string,RoleLink&{profileIds:string[]}>();
 for(const p of profiles)for(const link of p.links){if(link.taskOnly)continue;const key=JSON.stringify([link.section,link.target||'']);const old=links.get(key);if(old){if(!old.profileIds.includes(p.id))old.profileIds.push(p.id);}else links.set(key,{...link,profileIds:[p.id]});}
 return [...links.values()];
}
export async function prepareRoleComposition(admin:Session,input:unknown,warehouses:any[],scopes:Record<string,string>={}):Promise<RoleComposition>{
 if(!admin.isAdmin)throw Error('آماده‌سازی ترکیب آزمایشی فقط برای مدیر سامانه مجاز است.');
 const profiles=compositionProfiles(input);
 if(Object.keys(scopes).some(id=>!profiles.some(p=>p.id===id)))throw Error('محدوده‌ای برای نقش انتخاب‌نشده فرستاده شده است.');
 if(profiles.length>1&&profiles.some(p=>p.serviceScope&&scopes[p.id]))throw Error('نمایندگی بیرونی با نقش‌های کارکنان ترکیب نمی‌شود.');
 const contexts:Session[]=[];
 for(const p of profiles){const scope=scopes[p.id]||'';if(!await validProfileScope(p.id,scope))throw Error('محدوده یا پرونده مربوط به نقش معتبر نیست.');contexts.push(profileSession(admin,p.id,warehouses,scope));}
 return {profileIds:profiles.map(p=>p.id),title:profiles.map(p=>p.title).join(' + '),contexts,links:compositionLinks(profiles)};
}
// Evaluate each complete role/scope independently. Flattening service roles and
// service domains would grant a hospital manager authority over home services.
export function compositionAllows(composition:RoleComposition,allows:(context:Session)=>boolean){return composition.contexts.some(context=>allows(context));}
export type ComposedWork=ProfileWork&{profileIds:string[]};
export function compositionWork(queues:{profileId:string;work:ProfileWork[]}[]):ComposedWork[]{
 const work=new Map<string,ComposedWork>();
 for(const q of queues)for(const item of q.work){
  // A destination alone is not a step: different actions on one case stay separate.
  const key=JSON.stringify([item.section,item.target,item.sourceId,item.id]);
  const old=work.get(key);if(old){if(!old.profileIds.includes(q.profileId))old.profileIds.push(q.profileId);}else work.set(key,{...item,profileIds:[q.profileId]});
 }
 return [...work.values()];
}
