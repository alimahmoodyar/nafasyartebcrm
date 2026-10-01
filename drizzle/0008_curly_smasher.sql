CREATE TABLE `bom_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`lines` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bom_version` ON `bom_versions` (`product_id`,`version`);--> statement-breakpoint
CREATE TABLE `inventory_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "inventory_nonnegative" CHECK("inventory_balances"."quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inventory_balance` ON `inventory_balances` (`item_id`,`warehouse`);--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`batch_id` text PRIMARY KEY NOT NULL,
	`part_code` text NOT NULL,
	`unit` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`item_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`delta` integer NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `inventory_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_entries_item` ON `inventory_entries` (`item_id`);--> statement-breakpoint
CREATE TABLE `inventory_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	`guard` integer NOT NULL,
	CONSTRAINT "inventory_operation_guard" CHECK("inventory_operations"."guard" = 1)
);
--> statement-breakpoint
CREATE TABLE `production_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`warehouse` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`bom_id` text NOT NULL,
	`day` text NOT NULL,
	`operator` text NOT NULL,
	`notes` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bom_id`) REFERENCES `bom_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_orders_device_id_unique` ON `production_orders` (`device_id`);--> statement-breakpoint
CREATE TABLE `production_receipts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `inventory_operations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_receipts_operation_id_unique` ON `production_receipts` (`operation_id`);