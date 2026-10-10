CREATE TABLE `personal_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_personal_reminders_owner` ON `personal_reminders` (`owner`,`updated`);
--> statement-breakpoint
CREATE TRIGGER reset_freeze_personal_reminders_insert BEFORE INSERT ON personal_reminders WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_personal_reminders_update BEFORE UPDATE ON personal_reminders WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_personal_reminders_delete BEFORE DELETE ON personal_reminders WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE INDEX idx_personal_reminders_event ON personal_reminders(json_extract(data,'$.linkId'), json_extract(data,'$.trigger'), json_extract(data,'$.state'));
--> statement-breakpoint
CREATE TRIGGER capture_personal_reminder_event AFTER UPDATE OF data ON flow_entities
WHEN OLD.data <> NEW.data
BEGIN
 UPDATE personal_reminders SET data=json_set(data,'$.eventPending',json_object('at',strftime('%Y-%m-%dT%H:%M:%fZ','now'))),revision=revision+1,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE json_extract(data,'$.linkId')=NEW.id AND json_extract(data,'$.entityType')=NEW.type
 AND json_extract(data,'$.trigger')='event' AND json_extract(data,'$.state')='active'
 AND json_extract(data,'$.eventPending') IS NULL AND json_extract(data,'$.eventAt') IS NULL
 AND (
 json_extract(data,'$.eventField')='updated'
 OR ((json_extract(data,'$.eventField')='history[#-1].mode' AND json_extract(OLD.data,'$.history') IS NOT json_extract(NEW.data,'$.history') OR json_extract(OLD.data,'$.'||json_extract(data,'$.eventField')) IS NOT json_extract(NEW.data,'$.'||json_extract(data,'$.eventField')))
 AND (json_extract(data,'$.eventCondition')='changed' OR CAST(json_extract(NEW.data,'$.'||json_extract(data,'$.eventField')) AS TEXT)=json_extract(data,'$.eventValue')))
 );
END;

--> statement-breakpoint
CREATE TRIGGER capture_personal_reminder_task AFTER UPDATE OF data,state ON duty_runs
WHEN OLD.data <> NEW.data OR OLD.state <> NEW.state
BEGIN
 UPDATE personal_reminders SET data=json_set(data,'$.eventPending',json_object('at',strftime('%Y-%m-%dT%H:%M:%fZ','now'))),revision=revision+1,updated=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE json_extract(data,'$.linkId')=NEW.id AND json_extract(data,'$.entityType')='duty_run'
 AND json_extract(data,'$.trigger')='event' AND json_extract(data,'$.state')='active'
 AND json_extract(data,'$.eventPending') IS NULL AND json_extract(data,'$.eventAt') IS NULL
 AND (json_extract(data,'$.eventField')='updated' OR (json_extract(data,'$.eventField')='state' AND OLD.state<>NEW.state
 AND (json_extract(data,'$.eventCondition')='changed' OR NEW.state=json_extract(data,'$.eventValue'))));
END;
