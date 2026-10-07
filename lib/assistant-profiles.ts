import {storage} from './storage';
import type {AssistantCatalog} from './assistant-profile-selection';
export async function assistantProfiles():Promise<AssistantCatalog>{
 const db=storage(),profiles=(await db.prepare('SELECT id,name,model FROM llm_configs ORDER BY name,id').all()).results as AssistantCatalog['profiles'];
 if(profiles.length<2)return {profiles,defaultProfileId:profiles[0]?.id||''};
 // Reuse existing, secret-free usage evidence for the current configuration.
 // Ignore an older success after a credential/quota/model rejection, or after
 // the administrator changed the profile. Never try other providers silently.
 let successful:any;
 try{successful=await db.prepare(`SELECT c.id,
  MAX(CASE WHEN u.status='succeeded' THEN u.started_at END) AS last_success,
  MAX(CASE WHEN u.status='failed' AND (u.http_status IN (401,403,404)
   OR u.error_code IN ('insufficient_quota','model_not_found')) THEN u.started_at END) AS last_rejection
  FROM llm_configs c JOIN llm_usage u ON u.profile_id=c.id AND u.model=c.model AND u.started_at>=c.updated
  GROUP BY c.id HAVING last_success IS NOT NULL AND (last_rejection IS NULL OR last_success>last_rejection)
  ORDER BY last_success DESC,c.id LIMIT 1`).first();}
 catch(e){if(!/no such table:\s*(?:main\.)?llm_usage\b/i.test(String(e)))throw e;}
 return {profiles,defaultProfileId:successful?.id||''};
}
