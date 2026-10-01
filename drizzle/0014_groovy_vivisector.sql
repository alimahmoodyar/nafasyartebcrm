CREATE TABLE `sourcing_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`part_code` text NOT NULL,
	`unit` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `flow_entities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sourcing_hold_positive" CHECK("sourcing_holds"."quantity">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sourcing_hold_source_plan` ON `sourcing_holds` (`plan_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_sourcing_hold_source` ON `sourcing_holds` (`source_type`,`source_id`);