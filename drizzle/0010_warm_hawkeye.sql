CREATE TABLE `assistant_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`model` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_assistant_turns_owner` ON `assistant_turns` (`owner`,`created`);