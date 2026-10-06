declare namespace Cloudflare {
  interface Env {
    ASSISTANT_DEBUG?: string;
    TASK_SCHEDULER_TOKEN?: string;
    DB?: D1Database;
    LLM_CONFIG_ENCRYPTION_KEY?: string;
    TRACE_OWNER_EMAIL?: string;
    PASSWORD_VAULT_KEY?: string;
    INITIAL_ADMIN_PASSWORD?: string;
    BUCKET?: R2Bucket;
  }
}
