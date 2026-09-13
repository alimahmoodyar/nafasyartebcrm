CREATE TABLE `serial_reservations` (
	`serial` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`product_id` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `serial_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_serial_reservations_run` ON `serial_reservations` (`run_id`);--> statement-breakpoint
CREATE TABLE `serial_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`actor` text NOT NULL,
	`day` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_serial_runs_day_created` ON `serial_runs` (`day`,`created`);