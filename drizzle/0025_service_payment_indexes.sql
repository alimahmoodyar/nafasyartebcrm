CREATE INDEX IF NOT EXISTS idx_flow_agent_created ON flow_entities(type,json_extract(data,'$.agentId'),created,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_idx_flow_agent_created ON training_flow_entities(type,json_extract(data,'$.agentId'),created,id);
