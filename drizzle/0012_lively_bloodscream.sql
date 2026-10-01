CREATE TABLE `assistant_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`turn_id` text NOT NULL,
	`tool` text NOT NULL,
	`args` text NOT NULL,
	`state` text NOT NULL,
	`result` text,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `assistant_turns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_assistant_actions_owner` ON `assistant_actions` (`owner`,`created`);