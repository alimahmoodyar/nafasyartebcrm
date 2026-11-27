// Source serials are evidence; previously generated values never vote for themselves.
function classification(scope:string){
 return `WITH codes AS MATERIALIZED (
 SELECT id,json_extract(data,'$.event.serial') AS code,
 coalesce(json_extract(data,'$.event.deviceSetSerial'),'') AS existing,
 coalesce(json_extract(data,'$.serialRecovery.method'),'') AS method
 FROM flow_entities WHERE type='legacy_activation_event' ${scope}
 ), bases AS (SELECT *,CASE WHEN length(code)=10 AND code NOT GLOB '*[^0-9]*' THEN substr(code,1,7) END AS base FROM codes),
 candidates AS MATERIALIZED (
 SELECT *,CASE WHEN base LIKE '9%' THEN '59'||base
 WHEN base LIKE '13%' THEN '500'||substr(base,3)
 WHEN base LIKE '14%' THEN '100'||substr(base,3)
 WHEN base LIKE '8%' THEN '50'||substr(base,2)
 WHEN substr(base,1,1) IN ('1','2','3','4') THEN
 (CASE WHEN CAST(substr(base,6,2) AS INTEGER)>70 THEN '1' ELSE '5' END)||base END AS candidate FROM bases
 ), exact AS (
 SELECT code,min(existing) lo,max(existing) hi FROM candidates WHERE base IS NOT NULL AND method='' AND existing<>'' GROUP BY code
 ), family AS (
 SELECT base,min(existing) lo,max(existing) hi FROM candidates WHERE base IS NOT NULL AND method='' AND existing<>'' GROUP BY base
 ), reviewed AS MATERIALIZED (
 SELECT c.*,x.lo AS witness,x.hi AS witnessMax,f.lo AS baseLow,f.hi AS baseHigh,CASE
 WHEN c.method='' AND c.existing<>'' THEN CASE
 WHEN x.lo<>x.hi OR c.candidate<>c.existing THEN 'mismatch' ELSE 'original' END
 WHEN x.lo<>x.hi OR (x.lo IS NOT NULL AND c.candidate<>x.lo) THEN 'conflict'
 WHEN x.lo IS NOT NULL THEN 'exact'
 WHEN c.candidate IS NULL THEN 'unsupported'
 WHEN f.lo<>c.candidate OR f.hi<>c.candidate THEN 'conflict'
 ELSE 'formula' END AS status
 FROM candidates c LEFT JOIN exact x ON x.code=c.code LEFT JOIN family f ON f.base=c.base
 )`;
}
const all=classification('');
export const recoveryCounts=all+' SELECT status,count(*) n FROM reviewed GROUP BY status';
export const recoveryReview=all+` SELECT id,code,existing,candidate,witness,witnessMax,baseLow,baseHigh,status FROM reviewed
 WHERE status IN ('mismatch','conflict','unsupported') AND id>? ORDER BY id LIMIT 41`;
export function recoveryUpdate(scoped:boolean){
 const prefix=scoped?"AND substr(json_extract(data,'$.event.serial'),1,7) IN (SELECT value FROM json_each(?))":'';
 return classification(prefix)+`, targets AS (
 SELECT *,CASE status WHEN 'exact' THEN witness WHEN 'formula' THEN candidate ELSE '' END AS target FROM reviewed
 WHERE method<>'' OR existing=''
 ) UPDATE flow_entities AS e SET
 data=CASE WHEN r.target='' THEN json_remove(json_set(e.data,'$.event.deviceSetSerial',''),'$.serialRecovery')
 ELSE json_set(e.data,'$.event.deviceSetSerial',r.target,'$.serialRecovery',json_object('method',r.status,'actor',?,'at',?)) END,
 revision=e.revision+1,updated=?
 FROM targets r WHERE e.id=r.id AND (r.existing<>r.target OR (r.target<>'' AND r.method<>r.status))`;
}
