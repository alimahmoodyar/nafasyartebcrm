-- Isolated training workspace. Intentionally preserved by company resets and their freeze triggers.
CREATE TABLE `training_access_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`action` text NOT NULL,
	`before` text,
	`after` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_app_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_app_identity_subject_unique` ON `training_app_identity` (`subject`);--> statement-breakpoint
CREATE TABLE `training_app_members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`status` text NOT NULL,
	`subject` text,
	`permissions` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_app_members_email_unique` ON `training_app_members` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `training_app_members_subject_unique` ON `training_app_members` (`subject`);--> statement-breakpoint
CREATE TABLE `training_assistant_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`turn_id` text NOT NULL,
	`tool` text NOT NULL,
	`args` text NOT NULL,
	`state` text NOT NULL,
	`result` text,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `training_assistant_turns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_assistant_actions_owner` ON `training_assistant_actions` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `training_assistant_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`model` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_idx_assistant_turns_owner` ON `training_assistant_turns` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `training_batch_files` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_batch_files_object_key_unique` ON `training_batch_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `training_idx_batch_files_batch` ON `training_batch_files` (`batch_id`);--> statement-breakpoint
CREATE TABLE `training_bom_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`lines` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_bom_version` ON `training_bom_versions` (`product_id`,`version`);--> statement-breakpoint
CREATE TABLE `training_duty_files` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `training_duty_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_duty_files_task` ON `training_duty_files` (`task_id`);--> statement-breakpoint
CREATE TABLE `training_duty_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`recipient` text NOT NULL,
	`phase` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `training_duty_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_duty_notice_phase` ON `training_duty_notices` (`task_id`,`recipient`,`phase`);--> statement-breakpoint
CREATE INDEX `training_idx_duty_notice_recipient` ON `training_duty_notices` (`recipient`,`read_at`);--> statement-breakpoint
CREATE TABLE `training_duty_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`period` text NOT NULL,
	`assignee` text NOT NULL,
	`supervisor` text,
	`due` text NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`assignee`) REFERENCES `training_app_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_duty_occurrence` ON `training_duty_runs` (`template_id`,`period`,`assignee`);--> statement-breakpoint
CREATE INDEX `training_idx_duty_assignee_state` ON `training_duty_runs` (`assignee`,`state`);--> statement-breakpoint
CREATE INDEX `training_idx_duty_supervisor` ON `training_duty_runs` (`supervisor`,`state`);--> statement-breakpoint
CREATE TABLE `training_finance_files` (
	`id` text PRIMARY KEY NOT NULL,
	`cadence` text NOT NULL,
	`period` text NOT NULL,
	`report_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_finance_files_object_key_unique` ON `training_finance_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `training_idx_finance_files_period` ON `training_finance_files` (`cadence`,`period`);--> statement-breakpoint
CREATE TABLE `training_finance_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`cadence` text NOT NULL,
	`period` text NOT NULL,
	`report_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`responsible` text NOT NULL,
	`parent_id` text,
	`created` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_idx_finance_notes_period` ON `training_finance_notes` (`cadence`,`period`);--> statement-breakpoint
CREATE TABLE `training_firmware_files` (
	`version_id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_firmware_files_object_key_unique` ON `training_firmware_files` (`object_key`);--> statement-breakpoint
CREATE TABLE `training_flow_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_idx_flow_type` ON `training_flow_entities` (`type`);--> statement-breakpoint
CREATE TABLE `training_flow_slots` (
	`location` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "training_flow_slot_nonnegative" CHECK("training_flow_slots"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE `training_inventory_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "training_inventory_nonnegative" CHECK("training_inventory_balances"."quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_inventory_balance` ON `training_inventory_balances` (`item_id`,`warehouse`);--> statement-breakpoint
CREATE TABLE `training_inventory_batches` (
	`batch_id` text PRIMARY KEY NOT NULL,
	`part_code` text NOT NULL,
	`unit` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `training_inventory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`item_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`delta` integer NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `training_inventory_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_inventory_entries_item` ON `training_inventory_entries` (`item_id`);--> statement-breakpoint
CREATE TABLE `training_inventory_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	`guard` integer NOT NULL,
	CONSTRAINT "training_inventory_operation_guard" CHECK("training_inventory_operations"."guard" = 1)
);
--> statement-breakpoint
CREATE TABLE `training_llm_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`base_url` text NOT NULL,
	`system_prompt` text NOT NULL,
	`temperature` text NOT NULL,
	`max_tokens` integer NOT NULL,
	`token_ciphertext` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_mcp_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stream_id` text NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response` text,
	`created` text NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `training_mcp_streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_mcp_request` ON `training_mcp_messages` (`stream_id`,`request_key`);--> statement-breakpoint
CREATE TABLE `training_mcp_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`expires` text NOT NULL,
	`lease` text NOT NULL,
	`lease_until` text NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `training_mcp_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_mcp_streams_token` ON `training_mcp_streams` (`token_id`);--> statement-breakpoint
CREATE TABLE `training_mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`subject` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`expires` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_mcp_tokens_token_hash_unique` ON `training_mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `training_password_accounts` (
	`member_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_ciphertext` text,
	`must_change` integer DEFAULT 0 NOT NULL,
	`password_changed_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `training_app_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_password_accounts_username_unique` ON `training_password_accounts` (`username`);--> statement-breakpoint
CREATE TABLE `training_password_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`version` integer NOT NULL,
	`expires` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `training_app_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_password_sessions_member` ON `training_password_sessions` (`member_id`);--> statement-breakpoint
CREATE TABLE `training_production_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `training_production_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `training_production_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`bom_id` text NOT NULL,
	`day` text NOT NULL,
	`operator` text NOT NULL,
	`notes` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bom_id`) REFERENCES `training_bom_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_production_orders_device_id_unique` ON `training_production_orders` (`device_id`);--> statement-breakpoint
CREATE TABLE `training_production_receipts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `training_production_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `training_inventory_operations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_production_receipts_operation_id_unique` ON `training_production_receipts` (`operation_id`);--> statement-breakpoint
CREATE TABLE `training_quality_files` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `training_quality_reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_quality_files_object_key_unique` ON `training_quality_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `training_idx_quality_files_report` ON `training_quality_files` (`report_id`);--> statement-breakpoint
CREATE TABLE `training_quality_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`template_id` text NOT NULL,
	`values` text NOT NULL,
	`verdict` text NOT NULL,
	`notes` text NOT NULL,
	`created` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `training_quality_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_quality_reports_device` ON `training_quality_reports` (`device_id`);--> statement-breakpoint
CREATE TABLE `training_quality_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`fields` text NOT NULL,
	`created` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_quality_template_version` ON `training_quality_templates` (`product_id`,`version`);--> statement-breakpoint
CREATE TABLE `training_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_idx_records_kind` ON `training_records` (`kind`);--> statement-breakpoint
CREATE TABLE `training_reset_control` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text,
	`phase` text DEFAULT 'testing' NOT NULL,
	`job_id` text,
	`internal` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	CONSTRAINT "training_reset_singleton" CHECK("training_reset_control"."id"=1),
	CONSTRAINT "training_reset_internal_flag" CHECK("training_reset_control"."internal" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `training_reset_jobs` (
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
	CONSTRAINT "training_reset_job_guard" CHECK("training_reset_jobs"."guard"=1)
);
--> statement-breakpoint
CREATE TABLE `training_serial_reservations` (
	`serial` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`product_id` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `training_serial_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_serial_reservations_run` ON `training_serial_reservations` (`run_id`);--> statement-breakpoint
CREATE TABLE `training_serial_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`actor` text NOT NULL,
	`day` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_serial_runs_day_created` ON `training_serial_runs` (`day`,`created`);--> statement-breakpoint
CREATE TABLE `training_service_activations` (
	`serial` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`months` integer NOT NULL,
	`source` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_service_files` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`purpose` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `training_flow_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_service_files_case` ON `training_service_files` (`case_id`);--> statement-breakpoint
CREATE TABLE `training_service_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`domain` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`debit` text NOT NULL,
	`credit` text NOT NULL,
	`due` text,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `training_flow_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_service_ledger_source_kind` ON `training_service_ledger` (`source_id`,`kind`);--> statement-breakpoint
CREATE INDEX `training_idx_service_ledger_agent` ON `training_service_ledger` (`agent_id`,`created`);--> statement-breakpoint
CREATE TABLE `training_service_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`domain` text NOT NULL,
	`batch_id` text NOT NULL,
	`order_id` text,
	`line_id` text,
	`quantity` integer NOT NULL,
	`unit_rial` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "training_service_lot_nonnegative" CHECK("training_service_lots"."quantity">=0)
);
--> statement-breakpoint
CREATE INDEX `training_idx_service_lots_owner` ON `training_service_lots` (`owner`,`domain`);--> statement-breakpoint
CREATE TABLE `training_service_offsets` (
	`id` text PRIMARY KEY NOT NULL,
	`debit_id` text NOT NULL,
	`credit_id` text NOT NULL,
	`amount` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`debit_id`) REFERENCES `training_service_ledger`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_id`) REFERENCES `training_service_ledger`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `training_idx_service_offset_debit` ON `training_service_offsets` (`debit_id`);--> statement-breakpoint
CREATE INDEX `training_idx_service_offset_credit` ON `training_service_offsets` (`credit_id`);--> statement-breakpoint
CREATE TABLE `training_service_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`line_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `training_flow_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `training_service_lots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "training_service_reservation_positive" CHECK("training_service_reservations"."quantity">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_service_reserve_line_lot` ON `training_service_reservations` (`case_id`,`line_id`,`lot_id`);--> statement-breakpoint
CREATE INDEX `training_idx_service_reserve_lot` ON `training_service_reservations` (`lot_id`);--> statement-breakpoint
CREATE TABLE `training_sourcing_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`part_code` text NOT NULL,
	`unit` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `training_flow_entities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "training_sourcing_hold_positive" CHECK("training_sourcing_holds"."quantity">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_idx_sourcing_hold_source_plan` ON `training_sourcing_holds` (`plan_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `training_idx_sourcing_hold_source` ON `training_sourcing_holds` (`source_type`,`source_id`);