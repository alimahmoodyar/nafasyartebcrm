CREATE TABLE `access_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`action` text NOT NULL,
	`before` text,
	`after` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_identity_subject_unique` ON `app_identity` (`subject`);--> statement-breakpoint
CREATE TABLE `app_members` (
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
CREATE UNIQUE INDEX `app_members_email_unique` ON `app_members` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_members_subject_unique` ON `app_members` (`subject`);