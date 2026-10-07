export type AssistantCatalog={profiles:{id:string;name:string;model:string}[];defaultProfileId?:string};
// Browser preferences are explicit, account-specific choices. An alphabetical
// list is not evidence that the first provider is usable.
export function selectAssistantProfile(catalog:AssistantCatalog,preferred=''){
 const exists=(id:string)=>catalog.profiles.some(p=>p.id===id);
 if(preferred&&exists(preferred))return preferred;
 if(catalog.defaultProfileId&&exists(catalog.defaultProfileId))return catalog.defaultProfileId;
 return catalog.profiles.length===1?catalog.profiles[0].id:'';
}
