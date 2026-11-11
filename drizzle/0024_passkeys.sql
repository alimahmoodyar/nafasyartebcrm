CREATE TABLE auth_passkeys (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES app_members(id) ON DELETE CASCADE,
 account_version INTEGER NOT NULL, rp_id TEXT NOT NULL, public_key TEXT NOT NULL,
 counter INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '[]', name TEXT NOT NULL,
 created TEXT NOT NULL, last_used TEXT
);
--> statement-breakpoint
CREATE INDEX auth_passkeys_member ON auth_passkeys(member_id,rp_id);
--> statement-breakpoint
CREATE TABLE auth_passkey_challenges (
 hash TEXT PRIMARY KEY, kind TEXT NOT NULL, challenge TEXT NOT NULL, origin TEXT NOT NULL,
 rp_id TEXT NOT NULL, member_id TEXT, account_version INTEGER, expires TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX auth_passkey_challenges_expiry ON auth_passkey_challenges(expires);
