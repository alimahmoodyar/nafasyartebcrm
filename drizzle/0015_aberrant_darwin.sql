CREATE TABLE `service_activations` (
	`serial` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`months` integer NOT NULL,
	`source` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_files` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`purpose` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `flow_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_service_files_case` ON `service_files` (`case_id`);--> statement-breakpoint
CREATE TABLE `service_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`domain` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`debit` text NOT NULL,
	`credit` text NOT NULL,
	`due` text,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `flow_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_ledger_source_kind` ON `service_ledger` (`source_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_service_ledger_agent` ON `service_ledger` (`agent_id`,`created`);--> statement-breakpoint
CREATE TABLE `service_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`domain` text NOT NULL,
	`batch_id` text NOT NULL,
	`order_id` text,
	`line_id` text,
	`quantity` integer NOT NULL,
	`unit_rial` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "service_lot_nonnegative" CHECK("service_lots"."quantity">=0)
);
--> statement-breakpoint
CREATE INDEX `idx_service_lots_owner` ON `service_lots` (`owner`,`domain`);--> statement-breakpoint
CREATE TABLE `service_offsets` (
	`id` text PRIMARY KEY NOT NULL,
	`debit_id` text NOT NULL,
	`credit_id` text NOT NULL,
	`amount` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`debit_id`) REFERENCES `service_ledger`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_id`) REFERENCES `service_ledger`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_service_offset_debit` ON `service_offsets` (`debit_id`);--> statement-breakpoint
CREATE INDEX `idx_service_offset_credit` ON `service_offsets` (`credit_id`);--> statement-breakpoint
CREATE TABLE `service_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`line_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `flow_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `service_lots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "service_reservation_positive" CHECK("service_reservations"."quantity">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_service_reserve_line_lot` ON `service_reservations` (`case_id`,`line_id`,`lot_id`);--> statement-breakpoint
CREATE INDEX `idx_service_reserve_lot` ON `service_reservations` (`lot_id`);