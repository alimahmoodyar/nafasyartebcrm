CREATE TABLE `duty_files` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `duty_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_duty_files_task` ON `duty_files` (`task_id`);--> statement-breakpoint
CREATE TABLE `duty_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`recipient` text NOT NULL,
	`phase` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `duty_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_duty_notice_phase` ON `duty_notices` (`task_id`,`recipient`,`phase`);--> statement-breakpoint
CREATE INDEX `idx_duty_notice_recipient` ON `duty_notices` (`recipient`,`read_at`);--> statement-breakpoint
CREATE TABLE `duty_runs` (
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
	FOREIGN KEY (`assignee`) REFERENCES `app_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_duty_occurrence` ON `duty_runs` (`template_id`,`period`,`assignee`);--> statement-breakpoint
CREATE INDEX `idx_duty_assignee_state` ON `duty_runs` (`assignee`,`state`);--> statement-breakpoint
CREATE INDEX `idx_duty_supervisor` ON `duty_runs` (`supervisor`,`state`);