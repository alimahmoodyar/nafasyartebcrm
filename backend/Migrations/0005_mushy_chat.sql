CREATE TABLE `quality_files` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `quality_reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quality_files_object_key_unique` ON `quality_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_quality_files_report` ON `quality_files` (`report_id`);--> statement-breakpoint
CREATE TABLE `quality_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`template_id` text NOT NULL,
	`values` text NOT NULL,
	`verdict` text NOT NULL,
	`notes` text NOT NULL,
	`created` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `quality_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_quality_reports_device` ON `quality_reports` (`device_id`);--> statement-breakpoint
CREATE TABLE `quality_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`fields` text NOT NULL,
	`created` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quality_template_version` ON `quality_templates` (`product_id`,`version`);