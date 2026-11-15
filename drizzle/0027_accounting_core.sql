
CREATE TABLE `accounting_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`parent_id` text,
	`level` text NOT NULL,
	`classification` text NOT NULL,
	`details` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "account_level" CHECK("accounting_accounts"."level" IN ('group','general','subsidiary'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_accounts_code_unique` ON `accounting_accounts` (`code`);--> statement-breakpoint
CREATE TABLE `accounting_journals` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`effect_key` text NOT NULL,
	`period_id` text NOT NULL,
	`day` text NOT NULL,
	`description` text NOT NULL,
	`state` text NOT NULL,
	`rule_id` text,
	`reverses_id` text,
	`total_debit` text NOT NULL,
	`total_credit` text NOT NULL,
	`actor` text NOT NULL,
	`reviewer` text,
	`created` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `economic_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`period_id`) REFERENCES `accounting_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `accounting_rules`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_journal_balanced" CHECK("accounting_journals"."total_debit" = "accounting_journals"."total_credit"),
	CONSTRAINT "account_journal_state" CHECK("accounting_journals"."state" IN ('draft','posted','cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_journals_effect_key_unique` ON `accounting_journals` (`effect_key`);--> statement-breakpoint
CREATE INDEX `idx_accounting_journal_day` ON `accounting_journals` (`day`,`id`);--> statement-breakpoint
CREATE INDEX `idx_accounting_journal_event` ON `accounting_journals` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounting_single_reversal` ON `accounting_journals` (`reverses_id`) WHERE "accounting_journals"."reverses_id" IS NOT NULL AND "accounting_journals"."state" != 'cancelled';--> statement-breakpoint
CREATE TABLE `accounting_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_id` text NOT NULL,
	`account_id` text NOT NULL,
	`debit` text NOT NULL,
	`credit` text NOT NULL,
	`details` text NOT NULL,
	`dimensions` text NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_accounting_lines_journal` ON `accounting_lines` (`journal_id`);--> statement-breakpoint
CREATE INDEX `idx_accounting_lines_account` ON `accounting_lines` (`account_id`,`journal_id`);--> statement-breakpoint
CREATE TABLE `accounting_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`actor` text NOT NULL,
	CONSTRAINT "account_period_state" CHECK("accounting_periods"."state" IN ('open','closed'))
);
--> statement-breakpoint
CREATE INDEX `idx_accounting_period_dates` ON `accounting_periods` (`start`,`end`);--> statement-breakpoint
CREATE TABLE `accounting_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`version` integer NOT NULL,
	`effective` text NOT NULL,
	`end` text,
	`state` text NOT NULL,
	`data` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounting_rule_version` ON `accounting_rules` (`kind`,`version`);--> statement-breakpoint
CREATE INDEX `idx_accounting_rule_effective` ON `accounting_rules` (`kind`,`effective`);--> statement-breakpoint
CREATE TABLE `accounting_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `economic_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`source_version` integer NOT NULL,
	`occurred_day` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	`payload` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`issue` text,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `economic_events_source_key_unique` ON `economic_events` (`source_key`);--> statement-breakpoint
CREATE INDEX `idx_economic_event_queue` ON `economic_events` (`state`,`created`,`id`);--> statement-breakpoint
CREATE INDEX `idx_economic_event_source` ON `economic_events` (`source_id`,`source_version`);
--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_settings_insert BEFORE INSERT ON accounting_settings WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_settings_update BEFORE UPDATE ON accounting_settings WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_settings_delete BEFORE DELETE ON accounting_settings WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_accounts_insert BEFORE INSERT ON accounting_accounts WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_accounts_update BEFORE UPDATE ON accounting_accounts WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_accounts_delete BEFORE DELETE ON accounting_accounts WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_periods_insert BEFORE INSERT ON accounting_periods WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_periods_update BEFORE UPDATE ON accounting_periods WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_periods_delete BEFORE DELETE ON accounting_periods WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_rules_insert BEFORE INSERT ON accounting_rules WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_rules_update BEFORE UPDATE ON accounting_rules WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_rules_delete BEFORE DELETE ON accounting_rules WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_economic_events_insert BEFORE INSERT ON economic_events WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_economic_events_update BEFORE UPDATE ON economic_events WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_economic_events_delete BEFORE DELETE ON economic_events WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_journals_insert BEFORE INSERT ON accounting_journals WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_journals_update BEFORE UPDATE ON accounting_journals WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_journals_delete BEFORE DELETE ON accounting_journals WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_lines_insert BEFORE INSERT ON accounting_lines WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_lines_update BEFORE UPDATE ON accounting_lines WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_accounting_lines_delete BEFORE DELETE ON accounting_lines WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER economic_event_immutable BEFORE UPDATE ON economic_events WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (OLD.id!=NEW.id OR OLD.source_key!=NEW.source_key OR OLD.payload!=NEW.payload OR OLD.kind!=NEW.kind OR OLD.source_id!=NEW.source_id OR OLD.source_version!=NEW.source_version OR OLD.occurred_day!=NEW.occurred_day OR OLD.actor!=NEW.actor OR OLD.created!=NEW.created) BEGIN SELECT RAISE(ABORT,'ECONOMIC_EVENT_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER economic_event_no_delete BEFORE DELETE ON economic_events WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (1=1) BEGIN SELECT RAISE(ABORT,'ECONOMIC_EVENT_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER journal_posted_immutable BEFORE UPDATE ON accounting_journals WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (OLD.state='posted') BEGIN SELECT RAISE(ABORT,'POSTED_JOURNAL_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER journal_no_delete BEFORE DELETE ON accounting_journals WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (OLD.state='posted') BEGIN SELECT RAISE(ABORT,'POSTED_JOURNAL_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER journal_insert_draft BEFORE INSERT ON accounting_journals WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (NEW.state!='draft') BEGIN SELECT RAISE(ABORT,'JOURNAL_MUST_BEGIN_DRAFT'); END;

--> statement-breakpoint
CREATE TRIGGER line_posted_insert BEFORE INSERT ON accounting_lines WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (EXISTS(SELECT 1 FROM accounting_journals WHERE id=NEW.journal_id AND state='posted')) BEGIN SELECT RAISE(ABORT,'POSTED_LINES_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER line_posted_update BEFORE UPDATE ON accounting_lines WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (EXISTS(SELECT 1 FROM accounting_journals WHERE id IN (OLD.journal_id,NEW.journal_id) AND state='posted')) BEGIN SELECT RAISE(ABORT,'POSTED_LINES_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER line_posted_delete BEFORE DELETE ON accounting_lines WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (EXISTS(SELECT 1 FROM accounting_journals WHERE id=OLD.journal_id AND state='posted')) BEGIN SELECT RAISE(ABORT,'POSTED_LINES_IMMUTABLE'); END;

--> statement-breakpoint
CREATE TRIGGER line_values BEFORE INSERT ON accounting_lines WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (NEW.debit='' OR NEW.credit='' OR NEW.debit GLOB '*[^0-9]*' OR NEW.credit GLOB '*[^0-9]*' OR length(NEW.debit)>18 OR length(NEW.credit)>18 OR (CAST(NEW.debit AS INTEGER)=0)=(CAST(NEW.credit AS INTEGER)=0) OR NOT json_valid(NEW.details) OR json_type(NEW.details)!='array' OR json_array_length(NEW.details)!=3 OR EXISTS(SELECT 1 FROM accounting_accounts a,json_each(a.details) d WHERE a.id=NEW.account_id AND ((json_extract(d.value,'$.required')=1 AND json_extract(NEW.details,'$['||d.key||']') IS NULL) OR (json_extract(NEW.details,'$['||d.key||']') IS NOT NULL AND (json_extract(d.value,'$.kind') IS NULL OR json_type(NEW.details,'$['||d.key||']')!='text')))) OR NOT EXISTS(SELECT 1 FROM accounting_accounts WHERE id=NEW.account_id AND active=1 AND level='subsidiary')) BEGIN SELECT RAISE(ABORT,'INVALID_ACCOUNTING_LINE'); END;
--> statement-breakpoint
CREATE TRIGGER line_values_update BEFORE UPDATE ON accounting_lines WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (NEW.debit='' OR NEW.credit='' OR NEW.debit GLOB '*[^0-9]*' OR NEW.credit GLOB '*[^0-9]*' OR length(NEW.debit)>18 OR length(NEW.credit)>18 OR (CAST(NEW.debit AS INTEGER)=0)=(CAST(NEW.credit AS INTEGER)=0) OR NOT json_valid(NEW.details) OR json_type(NEW.details)!='array' OR json_array_length(NEW.details)!=3 OR EXISTS(SELECT 1 FROM accounting_accounts a,json_each(a.details) d WHERE a.id=NEW.account_id AND ((json_extract(d.value,'$.required')=1 AND json_extract(NEW.details,'$['||d.key||']') IS NULL) OR (json_extract(NEW.details,'$['||d.key||']') IS NOT NULL AND (json_extract(d.value,'$.kind') IS NULL OR json_type(NEW.details,'$['||d.key||']')!='text')))) OR NOT EXISTS(SELECT 1 FROM accounting_accounts WHERE id=NEW.account_id AND active=1 AND level='subsidiary')) BEGIN SELECT RAISE(ABORT,'INVALID_ACCOUNTING_LINE'); END;

--> statement-breakpoint
CREATE TRIGGER journal_post_check BEFORE UPDATE OF state ON accounting_journals WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0 AND (NEW.state='posted') BEGIN SELECT CASE WHEN NEW.total_debit!=NEW.total_credit OR NEW.total_debit GLOB '*[^0-9]*' OR NEW.total_credit GLOB '*[^0-9]*' OR CAST(NEW.total_debit AS INTEGER)<=0 OR length(NEW.total_debit)>19 OR EXISTS(SELECT 1 FROM accounting_lines l LEFT JOIN accounting_accounts a ON a.id=l.account_id WHERE l.journal_id=NEW.id AND (a.active!=1 OR a.level!='subsidiary' OR CAST(l.debit AS INTEGER)<0 OR CAST(l.credit AS INTEGER)<0 OR (CAST(l.debit AS INTEGER)=0)=(CAST(l.credit AS INTEGER)=0))) OR NOT EXISTS(SELECT 1 FROM accounting_periods WHERE id=NEW.period_id AND state='open' AND start<=NEW.day AND end>=NEW.day) OR (SELECT COUNT(*) FROM accounting_lines WHERE journal_id=NEW.id)<2 OR (SELECT SUM(CAST(debit AS INTEGER)) FROM accounting_lines WHERE journal_id=NEW.id)!=CAST(NEW.total_debit AS INTEGER) OR (SELECT SUM(CAST(credit AS INTEGER)) FROM accounting_lines WHERE journal_id=NEW.id)!=CAST(NEW.total_credit AS INTEGER) THEN RAISE(ABORT,'JOURNAL_BALANCE_OR_PERIOD') END; END;

--> statement-breakpoint

--> statement-breakpoint
CREATE TRIGGER accounting_inventory_outbox AFTER INSERT ON inventory_entries
WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0
BEGIN
 INSERT OR IGNORE INTO economic_events(id,source_key,kind,source_id,source_version,occurred_day,created,actor,payload,state,attempts)
 SELECT 'inventory_reclassification:'||NEW.operation_id||':'||v.id,'inventory_reclassification:'||NEW.operation_id||':'||v.id,'inventory_reclassification',v.id,v.revision,strftime('%Y-%m-%d',o.created,'+3 hours','+30 minutes'),o.created,o.actor,json_object('contractVersion',1,'currency','IRR','partyId','company','receiptId',json_extract(v.data,'$.receiptId'),'operationId',NEW.operation_id),'pending',0
 FROM flow_entities v JOIN inventory_operations o ON o.id=NEW.operation_id WHERE v.type='accounting_valuation' AND (EXISTS(SELECT 1 FROM inventory_batches b WHERE b.batch_id=NEW.item_id AND b.part_code=json_extract(v.data,'$.partCode') AND b.unit=json_extract(v.data,'$.unit')) OR EXISTS(SELECT 1 FROM json_each(v.data,'$.allocations') a WHERE json_extract(a.value,'$.dimensions.device')=NEW.item_id) OR EXISTS(SELECT 1 FROM records r WHERE r.id=NEW.item_id AND (json_extract(r.payload,'$.routineLotId') IS NOT NULL OR json_extract(r.payload,'$.routineJobId') IS NOT NULL)));
END;

--> statement-breakpoint
CREATE TRIGGER accounting_stage_insert_outbox AFTER INSERT ON flow_entities
WHEN NEW.type IN ('build','sale','sales_invoice') AND COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0
BEGIN
 INSERT OR IGNORE INTO economic_events(id,source_key,kind,source_id,source_version,occurred_day,created,actor,payload,state,attempts)
 SELECT 'inventory_reclassification:stage:'||NEW.id||':'||NEW.revision||':'||v.id,'inventory_reclassification:stage:'||NEW.id||':'||NEW.revision||':'||v.id,'inventory_reclassification',v.id,v.revision,strftime('%Y-%m-%d',NEW.updated,'+3 hours','+30 minutes'),NEW.updated,'system:operational-stage',json_object('contractVersion',1,'currency','IRR','partyId','company','receiptId',json_extract(v.data,'$.receiptId'),'stageId',NEW.id,'stageRevision',NEW.revision),'pending',0
 FROM flow_entities v WHERE v.type='accounting_valuation' AND EXISTS(SELECT 1 FROM json_each(v.data,'$.allocations') a WHERE json_extract(a.value,'$.dimensions.device')=NEW.id OR EXISTS(SELECT 1 FROM json_each(NEW.data,'$.deviceIds') d WHERE d.value=json_extract(a.value,'$.dimensions.device')) OR NEW.type='sales_invoice' AND EXISTS(SELECT 1 FROM flow_entities sale,json_each(sale.data,'$.deviceIds') d WHERE sale.type='sale' AND json_extract(sale.data,'$.invoiceId')=NEW.id AND d.value=json_extract(a.value,'$.dimensions.device')));
END;

--> statement-breakpoint
CREATE TRIGGER accounting_stage_update_outbox AFTER UPDATE ON flow_entities
WHEN NEW.type IN ('build','sale','sales_invoice') AND COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0
BEGIN
 INSERT OR IGNORE INTO economic_events(id,source_key,kind,source_id,source_version,occurred_day,created,actor,payload,state,attempts)
 SELECT 'inventory_reclassification:stage:'||NEW.id||':'||NEW.revision||':'||v.id,'inventory_reclassification:stage:'||NEW.id||':'||NEW.revision||':'||v.id,'inventory_reclassification',v.id,v.revision,strftime('%Y-%m-%d',NEW.updated,'+3 hours','+30 minutes'),NEW.updated,'system:operational-stage',json_object('contractVersion',1,'currency','IRR','partyId','company','receiptId',json_extract(v.data,'$.receiptId'),'stageId',NEW.id,'stageRevision',NEW.revision),'pending',0
 FROM flow_entities v WHERE v.type='accounting_valuation' AND EXISTS(SELECT 1 FROM json_each(v.data,'$.allocations') a WHERE json_extract(a.value,'$.dimensions.device')=NEW.id OR EXISTS(SELECT 1 FROM json_each(NEW.data,'$.deviceIds') d WHERE d.value=json_extract(a.value,'$.dimensions.device')) OR NEW.type='sales_invoice' AND EXISTS(SELECT 1 FROM flow_entities sale,json_each(sale.data,'$.deviceIds') d WHERE sale.type='sale' AND json_extract(sale.data,'$.invoiceId')=NEW.id AND d.value=json_extract(a.value,'$.dimensions.device')));
END;
--> statement-breakpoint
CREATE TRIGGER accounting_routine_cost_outbox AFTER UPDATE ON flow_entities
WHEN NEW.type='routine_lot' AND json_extract(OLD.data,'$.cost') IS NULL AND json_extract(NEW.data,'$.cost') IS NOT NULL AND COALESCE((SELECT internal FROM reset_control WHERE id=1),0)=0
BEGIN
 INSERT OR IGNORE INTO economic_events(id,source_key,kind,source_id,source_version,occurred_day,created,actor,payload,state,attempts)
 SELECT 'inventory_reclassification:lot:'||NEW.id||':'||NEW.revision||':'||v.id,'inventory_reclassification:lot:'||NEW.id||':'||NEW.revision||':'||v.id,'inventory_reclassification',v.id,v.revision,strftime('%Y-%m-%d',NEW.updated,'+3 hours','+30 minutes'),NEW.updated,COALESCE(json_extract(NEW.data,'$.cost.actor'),'system:source'),json_object('contractVersion',1,'currency','IRR','partyId','company','receiptId',json_extract(v.data,'$.receiptId'),'routineLotId',NEW.id),'pending',0
 FROM flow_entities v WHERE v.type='accounting_valuation';
END;
