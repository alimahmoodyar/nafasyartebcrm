# Online change: batch notes and attachments

Batch data now accepts editable `notes` (4000 characters) for descriptions and differences from previous lots. Existing batches need no backfill.

`/api/batch-files?batch=<record-id>` lists/uploads; `&id=<attachment-id>` downloads. Upload requires POST multipart `file` and UUID-v4 `requestId`; retries of the same ID/name/hash do not duplicate. Batch read/write permissions apply on the server. Any file extension is accepted, up to 10 MiB, downloaded as an attachment with octet-stream and nosniff; uploaded HTML/SVG cannot execute on the app origin. Bytes are private R2 objects; metadata and audit are an atomic D1 batch. Failed uploads reconcile before cleanup.

Migration 0004 adds `batch_files` with its parent record FK and indexes. Preserve the old migrations. For future full exports, include the `batch_files` table and all referenced `batch-files/` objects, together with existing tables/firmware objects. Records-only browser JSON export does not contain attachment bytes.

.NET export v12 has NOT been updated. At the next requested .NET handoff, port notes validation/editability, the new schema, route contract, idempotent uploads, arbitrary-file forced download, frontend panel, import/backup tables and objects, and these regression cases.

Validation: tests/batch-files.cjs exercises actual route modules against in-memory SQLite and an object-storage test double, including permissions, audit, response-loss recovery, failed-write cleanup and integrity. It is not a live R2/real-browser test.
