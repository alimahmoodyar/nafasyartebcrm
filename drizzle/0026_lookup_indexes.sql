CREATE INDEX IF NOT EXISTS idx_records_kind_code ON records(kind,json_extract(payload,'$.code'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_flow_receipt_batch ON flow_entities(json_extract(data,'$.batchId')) WHERE type='receipt';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_receipt_retired_candidates ON flow_entities(type,id) WHERE type='receipt' AND json_array_length(data,'$.identityHistory')>0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_office_serial_created ON flow_entities(type,json_extract(data,'$.domain'),COALESCE(json_extract(data,'$.agentId'),''),json_extract(data,'$.serial'),created DESC,id) WHERE type='as_case' AND json_extract(data,'$.domain')='home' AND COALESCE(json_extract(data,'$.agentId'),'')='';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_office_open_created ON flow_entities(type,json_extract(data,'$.domain'),COALESCE(json_extract(data,'$.agentId'),''),created DESC,id) WHERE type='as_case' AND json_extract(data,'$.domain')='home' AND COALESCE(json_extract(data,'$.agentId'),'')='' AND NOT (json_extract(data,'$.state') IN ('closed','resolved','returned'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_office_history_created ON flow_entities(type,json_extract(data,'$.domain'),COALESCE(json_extract(data,'$.agentId'),''),created DESC,id) WHERE type='as_case' AND json_extract(data,'$.domain')='home' AND COALESCE(json_extract(data,'$.agentId'),'')='' AND json_extract(data,'$.state') IN ('closed','resolved','returned');
