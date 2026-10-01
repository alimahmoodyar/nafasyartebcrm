# Serial lookup and unit access — version 3

## Product behavior

The primary workspace includes a serial lookup. An exact match (case-insensitive, trimming whitespace and normalizing Persian/Arabic digits) opens the existing device passport immediately. Partial matches produce a selectable list. No match displays a clear empty state. Search uses the currently loaded, authorized dataset; refresh retrieves changes made by other users. Demo search uses fictional records and remains separately marked.

The owner has a Users and access tab. Accounts are provisioned by authenticated email, name, unit, active/disabled state, and module permissions. This screen always manages real accounts, even while demonstration records are shown. No invitations or messages are sent. Application membership does not grant access through the Sites perimeter; the owner must separately authorize each employee in Site sharing. Site audience remains unchanged.

## Authentication

The platform supplies authenticated identity through the bundled ChatGPT helper. Passwords are neither created nor stored here. TRACE_OWNER_EMAIL is a hosted secret based on the verified Site owner's account. Missing configuration fails closed. First owner sign-in pins the stable Site-specific subject in app_identity. Provisioned members likewise bind the first matching authenticated subject to their email; later subject mismatch is denied. Client-supplied role, email and user ID are never authoritative.

Local .env and .env.example declare TRACE_OWNER_EMAIL without a default administrator. Production uses the hosted secret; do not commit its value. Future migrations to another hosting/identity provider must deliberately migrate these subject bindings.

## Authorization

All data/session/user/suggestion endpoints check identity and current enabled membership. Record reads return only allowed module kinds. Writes require the module write permission; event creation also checks permitted stages. A write grant requires read access to that module. Event/service/action writers must be able to read referenced devices and batches. Permissions are checked on the server on each request and mirrored in the interface.

- Inventory: batches read/write.
- Production: batches/devices/events read, devices/events write, consumption/assembly/packaging stages.
- QC: all modules read, batches/events/actions write, final-test stage.
- Sales/delivery: batches/devices/events read, events write, delivery stage.
- Service: all modules read, services/actions write.
- Management read-only: all modules read, no writes.
- Custom: explicit grants.

Only the configured owner manages users. No delegated user-administration permission is exposed in this increment. The owner's account cannot be disabled through the member API. Member emails cannot be edited; provision a new account and disable the old account for an email change.

Grants apply to whole modules, not individual fields, customers or records. For example, service read access includes stored service costs and complaint details. Event-stage restrictions apply to writes, while event read grants show all events. Export contains only the viewer's authorized dataset. Previously downloaded data cannot be recalled by revoking future access.

## Audit and integrity

New records, record updates, member creation and member changes are appended to access_audit with server-authenticated actor, target, time and snapshots. Audit and mutation use the same D1 batch transaction. Member changes use optimistic revisions; stale updates are rejected. Disabling a member is effective on subsequent requests, including open sessions. The new schema is an additive migration; earlier records and identifiers are not rewritten. Historical writes predating this feature are not attributed retroactively.

## Verification

Run `node tests/access-control.cjs`, `node tests/batch-number.cjs`, TypeScript check and the established build. Access tests execute the actual API/authorization modules with injected trusted identity and real in-memory SQLite, covering anonymous/unlisted rejection, owner pinning, member binding, module reads/writes, event-stage denial, forged role fields, CSRF, revocation, stale updates and auditing. Batch tests retain prior numbering coverage. Browser/SIWC interaction was not exercised in a browser in this increment; user sign-in is platform-owned. No public sharing or staff invitations were performed.

### بازرگانی
در تعریف یا ویرایش حساب، «واحد سازمانی ← بازرگانی» و سپس «داخلی» یا «خارجی» را انتخاب کنید. دسترسی‌ها مستقل تنظیم می‌شوند. در API و MCP مقدار `unit` برابر `بازرگانی — داخلی` یا `بازرگانی — خارجی` است و در فیلد موجود ذخیره می‌شود. نام واحد بدون زیرمجموعه پذیرفته نمی‌شود.
