CREATE TABLE `flow_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_flow_type` ON `flow_entities` (`type`);--> statement-breakpoint
CREATE TABLE `flow_slots` (
	`location` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "flow_slot_nonnegative" CHECK("flow_slots"."quantity" >= 0)
);
