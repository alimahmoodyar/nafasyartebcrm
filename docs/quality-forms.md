# Product quality forms and device quality reports

Product detail now defines immutable quality template versions. Each criterion has a stable key, label, number/text/pass-fail type, required flag and optional numeric unit/bounds. Device passports can record results against any explicitly selected version for that device's product. Earlier reports retain their original template even when a new version is published. All dates/inspectors come from the authenticated server context.

A report and its final-test event are one D1 batch; retries use a UUID request ID and matching payload. Reports and templates are append-only. A failed criterion or out-of-range number cannot be submitted with a passing overall verdict. Unbounded measurements and free text still need the inspector's final verdict; this is not AI approval. Existing production-event behavior is preserved, including its existing status rules. Corrections use a new test with notes rather than altering history.

Endpoints: GET/POST `/api/quality/templates` (query product or device), GET/POST `/api/quality/reports` (query device for reads), GET/POST `/api/quality/files` (query report; id for downloads; requestId for uploads). Forms permit 1–40 criteria, JSON requests up to 128 KiB; files up to 10 MiB each. The existing private file panel is reused. Arbitrary formats are forced downloads, never rendered on the Site origin.

Permissions: product read/write for template management; device read plus event read for reports; device read plus event write and final-test stage for new reports and files. Server enforces the same permissions on every endpoint. Each report has a structured JSON export, including criteria, units, bounds, version, measurements and provenance; this prepares data for analysis but does not add an AI service. Attached file bytes are downloaded separately.

Migration 0005 adds quality_templates, quality_reports, quality_files. For the next requested .NET export, port these tables, rules, route contracts, UI and tests; include new tables in import/backup and `quality-files/` referenced objects in file transfer. Previous .NET export is unchanged. No user data was inserted by development tests.

Validation: tests/quality.cjs runs actual route modules with SQLite and an object-storage double; covers version preservation, required fields, Persian digits, limits, wrong-product references, atomic event/report writes, response-loss retry, upload/download and role/stage isolation. TypeScript check and production build pass. No browser acceptance or live storage write test was performed.
