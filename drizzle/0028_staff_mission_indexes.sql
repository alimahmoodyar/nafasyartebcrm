-- Shared operational flow JSON, no duplicated personnel/customer/financial tables.
CREATE INDEX IF NOT EXISTS staff_mission_source_idx ON flow_entities(json_extract(data,'$.source.type'),json_extract(data,'$.source.id'),json_extract(data,'$.state')) WHERE type='staff_mission';
CREATE INDEX IF NOT EXISTS staff_mission_children_idx ON flow_entities(type,json_extract(data,'$.missionId'),created,id) WHERE type IN ('staff_mission_report','staff_mission_point','staff_mission_file');
CREATE INDEX IF NOT EXISTS staff_mission_event_idx ON flow_entities(type,json_extract(data,'$.eventId'),created) WHERE type='staff_mission_point';
CREATE INDEX IF NOT EXISTS staff_mission_report_file_idx ON flow_entities(json_extract(data,'$.reportId')) WHERE type='staff_mission_file';
