CREATE TABLE `llm_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`base_url` text NOT NULL,
	`system_prompt` text NOT NULL,
	`temperature` text NOT NULL,
	`max_tokens` integer NOT NULL,
	`token_ciphertext` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mcp_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stream_id` text NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response` text,
	`created` text NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `mcp_streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mcp_request` ON `mcp_messages` (`stream_id`,`request_key`);--> statement-breakpoint
CREATE TABLE `mcp_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`expires` text NOT NULL,
	`lease` text NOT NULL,
	`lease_until` text NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `mcp_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_streams_token` ON `mcp_streams` (`token_id`);--> statement-breakpoint
CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`subject` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`expires` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_unique` ON `mcp_tokens` (`token_hash`);