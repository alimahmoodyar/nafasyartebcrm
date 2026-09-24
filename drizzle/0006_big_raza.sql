CREATE TABLE `finance_files` (
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
CREATE UNIQUE INDEX `finance_files_object_key_unique` ON `finance_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_finance_files_period` ON `finance_files` (`cadence`,`period`);--> statement-breakpoint
CREATE TABLE `finance_notes` (
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
CREATE INDEX `idx_finance_notes_period` ON `finance_notes` (`cadence`,`period`);