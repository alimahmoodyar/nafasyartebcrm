CREATE TABLE bale_config (
 id TEXT PRIMARY KEY CHECK(id='company'), token_cipher TEXT NOT NULL, bot_id TEXT NOT NULL,
 username TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL,
 poll_offset INTEGER NOT NULL DEFAULT 0, poll_after INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL
);
CREATE TABLE bale_links (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('user','supplier')),
 label TEXT NOT NULL, bot_id TEXT NOT NULL, chat_id TEXT, chat_name TEXT,
 state TEXT NOT NULL CHECK(state IN ('unlinked','active','revoked')), revision INTEGER NOT NULL, updated TEXT NOT NULL
);
CREATE UNIQUE INDEX bale_active_chat ON bale_links(bot_id,chat_id) WHERE state='active';
CREATE TABLE bale_invites (
 id TEXT PRIMARY KEY, link_id TEXT NOT NULL REFERENCES bale_links(id), bot_id TEXT NOT NULL,
 expires INTEGER NOT NULL, candidate_chat TEXT, candidate_name TEXT, state TEXT NOT NULL CHECK(state IN ('waiting','claimed','consumed','cancelled'))
);
CREATE INDEX bale_invites_link ON bale_invites(link_id,expires);
CREATE TABLE bale_outbox (
 id TEXT PRIMARY KEY, link_id TEXT NOT NULL REFERENCES bale_links(id), actor TEXT NOT NULL,
 purpose TEXT NOT NULL, source_ref TEXT NOT NULL, payload_hash TEXT NOT NULL, bot_id TEXT NOT NULL,
 chat_id TEXT NOT NULL, link_revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('sending','sent','failed','unknown')),
 message_id TEXT, error TEXT, created TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE INDEX bale_outbox_link ON bale_outbox(link_id,created);

CREATE TRIGGER freeze_bale_config_insert BEFORE INSERT ON bale_config WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_config_update BEFORE UPDATE ON bale_config WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_config_delete BEFORE DELETE ON bale_config WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_links_insert BEFORE INSERT ON bale_links WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_links_update BEFORE UPDATE ON bale_links WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_links_delete BEFORE DELETE ON bale_links WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_invites_insert BEFORE INSERT ON bale_invites WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_invites_update BEFORE UPDATE ON bale_invites WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_invites_delete BEFORE DELETE ON bale_invites WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_outbox_insert BEFORE INSERT ON bale_outbox WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_outbox_update BEFORE UPDATE ON bale_outbox WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER freeze_bale_outbox_delete BEFORE DELETE ON bale_outbox WHEN (SELECT phase FROM reset_control WHERE id=1)='maintenance' AND (SELECT internal FROM reset_control WHERE id=1)=0 BEGIN SELECT RAISE(ABORT,'RESET_MAINTENANCE'); END;

CREATE TRIGGER bale_send_reset_guard BEFORE UPDATE OF phase ON reset_control WHEN NEW.phase='maintenance' AND OLD.phase!='maintenance' AND EXISTS(SELECT 1 FROM bale_outbox WHERE state='sending' AND created>strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 minutes')) BEGIN SELECT RAISE(ABORT,'BALE_SEND_IN_PROGRESS'); END;
