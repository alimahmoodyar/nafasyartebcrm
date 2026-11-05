CREATE TABLE role_preview_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  member_id TEXT NOT NULL,
  created TEXT NOT NULL,
  expires TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX role_preview_sessions_expiry_idx ON role_preview_sessions(expires);
--> statement-breakpoint
CREATE INDEX role_preview_sessions_member_idx ON role_preview_sessions(member_id);
