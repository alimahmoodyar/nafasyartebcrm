CREATE TABLE `batch_files` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batch_files_object_key_unique` ON `batch_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_batch_files_batch` ON `batch_files` (`batch_id`);