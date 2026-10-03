ALTER TABLE `password_accounts` ADD `password_ciphertext` text;--> statement-breakpoint
ALTER TABLE `password_accounts` ADD `must_change` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `password_accounts` ADD `password_changed_at` text;
--> statement-breakpoint
-- Existing locally provisioned accounts must select a personal password at rollout.
UPDATE password_accounts SET must_change=1 WHERE member_id IN (SELECT id FROM app_members WHERE status!='deleted');
