-- Release login names only for deleted identities. Keep member IDs for historical attribution.
-- '@' cannot occur in a valid login, so archived credentials cannot be used to sign in.
UPDATE password_accounts
SET username='@deleted:'||member_id, password_hash='deleted', password_ciphertext=NULL, version=version+1
WHERE member_id IN (SELECT id FROM app_members WHERE status='deleted')
  AND username!='@deleted:'||member_id;
--> statement-breakpoint
DELETE FROM password_sessions WHERE member_id IN (SELECT id FROM app_members WHERE status='deleted');
--> statement-breakpoint
UPDATE mcp_tokens SET revoked=1 WHERE subject IN (
  SELECT 'local:'||id FROM app_members WHERE status='deleted'
  UNION SELECT subject FROM app_members WHERE status='deleted' AND subject IS NOT NULL
);
--> statement-breakpoint
DELETE FROM mcp_streams WHERE token_id IN (
  SELECT id FROM mcp_tokens WHERE subject IN (
    SELECT 'local:'||id FROM app_members WHERE status='deleted'
    UNION SELECT subject FROM app_members WHERE status='deleted' AND subject IS NOT NULL
  )
);
