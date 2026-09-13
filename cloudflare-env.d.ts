declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TRACE_OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
