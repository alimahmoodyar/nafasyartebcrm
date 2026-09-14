CREATE TABLE `firmware_files` (
	`version_id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firmware_files_object_key_unique` ON `firmware_files` (`object_key`);