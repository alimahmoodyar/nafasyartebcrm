ALTER TABLE password_accounts ADD COLUMN recovery_mobile TEXT;
--> statement-breakpoint
ALTER TABLE password_accounts ADD COLUMN recovery_backup_hash TEXT;
--> statement-breakpoint
ALTER TABLE password_accounts ADD COLUMN recovery_revision INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_password_recovery_mobile ON password_accounts(recovery_mobile);
--> statement-breakpoint
CREATE TABLE password_recovery_challenges (
 token_hash TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL REFERENCES password_accounts(member_id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CONSTRAINT password_recovery_purpose CHECK(purpose IN ('enroll','reset')),
 mobile TEXT NOT NULL,
 version INTEGER NOT NULL,
 recovery_revision INTEGER NOT NULL,
 proof TEXT NOT NULL,
 expires TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 delivered INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_password_recovery_member_purpose ON password_recovery_challenges(member_id,purpose);
--> statement-breakpoint
CREATE INDEX idx_password_recovery_expires ON password_recovery_challenges(expires);
