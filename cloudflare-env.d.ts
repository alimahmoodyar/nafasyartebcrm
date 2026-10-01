declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    LLM_CONFIG_ENCRYPTION_KEY?: string;
    TRACE_OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
