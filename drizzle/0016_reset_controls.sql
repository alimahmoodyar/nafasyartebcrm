CREATE TABLE `reset_control` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text,
	`phase` text DEFAULT 'testing' NOT NULL,
	`job_id` text,
	`internal` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	CONSTRAINT "reset_singleton" CHECK("reset_control"."id"=1),
	CONSTRAINT "reset_internal_flag" CHECK("reset_control"."internal" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `reset_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`scope` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	`backup_key` text,
	`backup_hash` text,
	`byte_size` integer,
	`summary` text,
	`downloaded_at` text,
	`completed` text,
	`guard` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reset_job_guard" CHECK("reset_jobs"."guard"=1)
);

--> statement-breakpoint
INSERT INTO reset_control(id,phase,internal,revision,updated) VALUES(1,'testing',0,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
--> statement-breakpoint
CREATE TRIGGER reset_freeze_assistant_actions_insert BEFORE INSERT ON assistant_actions WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_assistant_actions_update BEFORE UPDATE ON assistant_actions WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_assistant_actions_delete BEFORE DELETE ON assistant_actions WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_assistant_turns_insert BEFORE INSERT ON assistant_turns WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_assistant_turns_update BEFORE UPDATE ON assistant_turns WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_assistant_turns_delete BEFORE DELETE ON assistant_turns WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_files_insert BEFORE INSERT ON duty_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_files_update BEFORE UPDATE ON duty_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_files_delete BEFORE DELETE ON duty_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_notices_insert BEFORE INSERT ON duty_notices WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_notices_update BEFORE UPDATE ON duty_notices WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_notices_delete BEFORE DELETE ON duty_notices WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_runs_insert BEFORE INSERT ON duty_runs WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_runs_update BEFORE UPDATE ON duty_runs WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_duty_runs_delete BEFORE DELETE ON duty_runs WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_offsets_insert BEFORE INSERT ON service_offsets WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_offsets_update BEFORE UPDATE ON service_offsets WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_offsets_delete BEFORE DELETE ON service_offsets WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_reservations_insert BEFORE INSERT ON service_reservations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_reservations_update BEFORE UPDATE ON service_reservations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_reservations_delete BEFORE DELETE ON service_reservations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_files_insert BEFORE INSERT ON service_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_files_update BEFORE UPDATE ON service_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_files_delete BEFORE DELETE ON service_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_ledger_insert BEFORE INSERT ON service_ledger WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_ledger_update BEFORE UPDATE ON service_ledger WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_ledger_delete BEFORE DELETE ON service_ledger WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_lots_insert BEFORE INSERT ON service_lots WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_lots_update BEFORE UPDATE ON service_lots WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_lots_delete BEFORE DELETE ON service_lots WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_activations_insert BEFORE INSERT ON service_activations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_activations_update BEFORE UPDATE ON service_activations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_service_activations_delete BEFORE DELETE ON service_activations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_sourcing_holds_insert BEFORE INSERT ON sourcing_holds WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_sourcing_holds_update BEFORE UPDATE ON sourcing_holds WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_sourcing_holds_delete BEFORE DELETE ON sourcing_holds WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_files_insert BEFORE INSERT ON quality_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_files_update BEFORE UPDATE ON quality_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_files_delete BEFORE DELETE ON quality_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_reports_insert BEFORE INSERT ON quality_reports WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_reports_update BEFORE UPDATE ON quality_reports WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_reports_delete BEFORE DELETE ON quality_reports WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_batch_files_insert BEFORE INSERT ON batch_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_batch_files_update BEFORE UPDATE ON batch_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_batch_files_delete BEFORE DELETE ON batch_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_finance_files_insert BEFORE INSERT ON finance_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_finance_files_update BEFORE UPDATE ON finance_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_finance_files_delete BEFORE DELETE ON finance_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_finance_notes_insert BEFORE INSERT ON finance_notes WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_finance_notes_update BEFORE UPDATE ON finance_notes WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_finance_notes_delete BEFORE DELETE ON finance_notes WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_materials_insert BEFORE INSERT ON production_materials WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_materials_update BEFORE UPDATE ON production_materials WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_materials_delete BEFORE DELETE ON production_materials WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_receipts_insert BEFORE INSERT ON production_receipts WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_receipts_update BEFORE UPDATE ON production_receipts WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_receipts_delete BEFORE DELETE ON production_receipts WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_orders_insert BEFORE INSERT ON production_orders WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_orders_update BEFORE UPDATE ON production_orders WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_production_orders_delete BEFORE DELETE ON production_orders WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_entries_insert BEFORE INSERT ON inventory_entries WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_entries_update BEFORE UPDATE ON inventory_entries WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_entries_delete BEFORE DELETE ON inventory_entries WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_balances_insert BEFORE INSERT ON inventory_balances WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_balances_update BEFORE UPDATE ON inventory_balances WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_balances_delete BEFORE DELETE ON inventory_balances WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_batches_insert BEFORE INSERT ON inventory_batches WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_batches_update BEFORE UPDATE ON inventory_batches WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_batches_delete BEFORE DELETE ON inventory_batches WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_flow_slots_insert BEFORE INSERT ON flow_slots WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_flow_slots_update BEFORE UPDATE ON flow_slots WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_flow_slots_delete BEFORE DELETE ON flow_slots WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_serial_reservations_insert BEFORE INSERT ON serial_reservations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_serial_reservations_update BEFORE UPDATE ON serial_reservations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_serial_reservations_delete BEFORE DELETE ON serial_reservations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_serial_runs_insert BEFORE INSERT ON serial_runs WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_serial_runs_update BEFORE UPDATE ON serial_runs WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_serial_runs_delete BEFORE DELETE ON serial_runs WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_operations_insert BEFORE INSERT ON inventory_operations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_operations_update BEFORE UPDATE ON inventory_operations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_inventory_operations_delete BEFORE DELETE ON inventory_operations WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_templates_insert BEFORE INSERT ON quality_templates WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_templates_update BEFORE UPDATE ON quality_templates WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_quality_templates_delete BEFORE DELETE ON quality_templates WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_bom_versions_insert BEFORE INSERT ON bom_versions WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_bom_versions_update BEFORE UPDATE ON bom_versions WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_bom_versions_delete BEFORE DELETE ON bom_versions WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_firmware_files_insert BEFORE INSERT ON firmware_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_firmware_files_update BEFORE UPDATE ON firmware_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_firmware_files_delete BEFORE DELETE ON firmware_files WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_flow_entities_insert BEFORE INSERT ON flow_entities WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_flow_entities_update BEFORE UPDATE ON flow_entities WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_flow_entities_delete BEFORE DELETE ON flow_entities WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_records_insert BEFORE INSERT ON records WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_records_update BEFORE UPDATE ON records WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_records_delete BEFORE DELETE ON records WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_mcp_messages_insert BEFORE INSERT ON mcp_messages WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_mcp_messages_update BEFORE UPDATE ON mcp_messages WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_mcp_messages_delete BEFORE DELETE ON mcp_messages WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_mcp_streams_insert BEFORE INSERT ON mcp_streams WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_mcp_streams_update BEFORE UPDATE ON mcp_streams WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
--> statement-breakpoint
CREATE TRIGGER reset_freeze_mcp_streams_delete BEFORE DELETE ON mcp_streams WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
