CREATE TABLE `llm_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`username` text NOT NULL,
	`profile_id` text NOT NULL,
	`profile_name` text NOT NULL,
	`model` text NOT NULL,
	`response_model` text,
	`source` text NOT NULL,
	`round` integer NOT NULL,
	`attempt` integer NOT NULL,
	`day` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`duration_ms` integer,
	`status` text NOT NULL,
	`http_status` integer,
	`error_code` text,
	`response_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`reported_total_tokens` integer,
	`cached_tokens` integer,
	`reasoning_tokens` integer,
	`usage_json` text,
	`usage_complete` integer DEFAULT 0 NOT NULL,
	`total_mismatch` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_llm_usage_day` ON `llm_usage` (`day`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_user_day` ON `llm_usage` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_llm_usage_request` ON `llm_usage` (`request_id`);
--> statement-breakpoint
CREATE TRIGGER reset_freeze_llm_usage_insert BEFORE INSERT ON llm_usage WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_llm_usage_update BEFORE UPDATE ON llm_usage WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

--> statement-breakpoint
CREATE TRIGGER reset_freeze_llm_usage_delete BEFORE DELETE ON llm_usage WHEN EXISTS(SELECT 1 FROM reset_control WHERE id=1 AND phase='maintenance' AND internal=0) BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;
