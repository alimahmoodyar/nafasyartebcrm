CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `password_accounts` (
	`member_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `app_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_accounts_username_unique` ON `password_accounts` (`username`);--> statement-breakpoint
CREATE TABLE `password_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`version` integer NOT NULL,
	`expires` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `app_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_password_sessions_member` ON `password_sessions` (`member_id`);