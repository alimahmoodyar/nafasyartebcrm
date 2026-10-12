# Serial lookup and unit access — version 3

## Product behavior

The primary workspace includes a serial lookup. An exact match (case-insensitive, trimming whitespace and normalizing Persian/Arabic digits) opens the existing device passport immediately. Partial matches produce a selectable list. No match displays a clear empty state. Search uses the currently loaded, authorized dataset; refresh retrieves changes made by other users. Demo search uses fictional records and remains separately marked.

The owner has a Users and access tab. Accounts are provisioned by authenticated email, name, unit, active/disabled state, and module permissions. This screen always manages real accounts, even while demonstration records are shown. No invitations or messages are sent. Application membership does not grant access through the Sites perimeter; the owner must separately authorize each employee in Site sharing. Site audience remains unchanged.

## Authentication

Local username/password accounts are supported. Passwords are stored only as salted PBKDF2 hashes; the eye toggle shows only the newly typed value, never a saved password. Legacy accounts also support the bundled ChatGPT identity helper. TRACE_OWNER_EMAIL is a hosted secret based on the verified Site owner's account. Missing configuration fails closed. First owner sign-in pins the stable Site-specific subject in app_identity. Provisioned members likewise bind the first matching authenticated subject to their email; later subject mismatch is denied. Client-supplied role, email and user ID are never authoritative.

Local .env and .env.example declare TRACE_OWNER_EMAIL without a default administrator. Production uses the hosted secret; do not commit its value. Future migrations to another hosting/identity provider must deliberately migrate these subject bindings.

## Authorization

### Manual business access

The manual account form displays the full home-section icon catalog with scoped operation choices and a non-admin visibility preview. System administration (users, LLM settings/usage, accounting connection and reset) remains administrator-only by owner decision. Shared employee entry points retain their own-record scope; an icon preview never bypasses domain record or action authorization.

`treasuryWorkflowRoles` separately grants treasury execution, financial review, accounting reconciliation and CEO payment authorization. Manual `financialRead` / `financialWrite` arrays accept only `costing`, `control`, and `transport`; write requires the matching read grant. Each domain is independent, and the legacy generic `finance` field grants none of them. Transport financial readers may inspect authorized mission expenses/evidence but cannot approve expenses. Existing job assignments retain the same effective access; switching to manual materializes their validated effective permissions and preserves scopes. Role-based requests ignore extra client grants. External accounts cannot combine these company permissions.

User creation/updates continue through the audited, revision-checked admin HTTP handler and matching MCP tools. Permissions are checked on every request, so removing a grant affects subsequent browser and assistant operations. No schema migration is needed because permissions remain in the existing account JSON snapshot.

All data/session/user/suggestion endpoints check identity and current enabled membership. Record reads return only allowed module kinds. Writes require the module write permission; event creation also checks permitted stages. A write grant requires read access to that module. Event/service/action writers must be able to read referenced devices and batches. Permissions are checked on the server on each request and mirrored in the interface.

- Inventory: batches read/write.
- Production: batches/devices/events read, devices/events write, consumption/assembly/packaging stages.
- QC: all modules read, batches/events/actions write, final-test stage.
- Sales/delivery: batches/devices/events read, events write, delivery stage.
- Service: all modules read, services/actions write.
- Management read-only: all modules read, no writes.
- Custom: explicit grants.

Only authenticated administrators manage users (configured owner or bootstrapped local administrator). No delegated user-administration permission is exposed in this increment. The owner's account cannot be disabled through the member API. Member emails cannot be edited; provision a new account and disable the old account for an email change.

Grants apply to whole modules, not individual fields, customers or records. For example, service read access includes stored service costs and complaint details. Event-stage restrictions apply to writes, while event read grants show all events. Export contains only the viewer's authorized dataset. Previously downloaded data cannot be recalled by revoking future access.

## Audit and integrity

New records, record updates, member creation and member changes are appended to access_audit with server-authenticated actor, target, time and snapshots. Audit and mutation use the same D1 batch transaction. Member changes use optimistic revisions; stale updates are rejected. Disabling a member is effective on subsequent requests, including open sessions. The new schema is an additive migration; earlier records and identifiers are not rewritten. Historical writes predating this feature are not attributed retroactively.

## Verification

Run `node tests/access-control.cjs`, `node tests/batch-number.cjs`, TypeScript check and the established build. Access tests execute the actual API/authorization modules with injected trusted identity and real in-memory SQLite, covering anonymous/unlisted rejection, owner pinning, member binding, module reads/writes, event-stage denial, forged role fields, CSRF, revocation, stale updates and auditing. Batch tests retain prior numbering coverage. Browser/SIWC interaction was not exercised in a browser in this increment; user sign-in is platform-owned. No public sharing or staff invitations were performed.

### بازرگانی
در تعریف یا ویرایش حساب، «واحد سازمانی ← بازرگانی» و سپس «داخلی» یا «خارجی» را انتخاب کنید. دسترسی‌ها مستقل تنظیم می‌شوند. در API و MCP مقدار `unit` برابر `بازرگانی — داخلی` یا `بازرگانی — خارجی` است و در فیلد موجود ذخیره می‌شود. نام واحد بدون زیرمجموعه پذیرفته نمی‌شود.

## مدیریت حساب‌ها — ۱۴۰۵/۰۷/۱۱
- دکمه‌های «ویرایش» و «حذف» در کاربران و دسترسی‌ها؛ ویرایش نام، نام کاربری محلی، واحد، وضعیت، مجوزها و رمز جدید. ایمیل ورود قدیمی ثابت است.
- تغییر نام کاربری یا رمز، نشست‌ها و توکن‌های حساب را باطل می‌کند؛ تغییر حساب خود مدیر، ورود دوباره می‌خواهد. مدیر اصلی و حساب جاری قابل حذف یا غیرفعال‌کردن نیستند.
- حذف با تأیید نام حساب انجام می‌شود و `status=deleted` را ثبت می‌کند؛ حساب از فهرست فعال مدیریت حذف می‌شود و امکان ورود یا فعال‌سازی مجدد با PATCH ندارد. نام کاربری و ایمیل رزرو می‌ماند. سوابق تولید، خدمات، گزارش‌ها، وظایف و انتساب تاریخی حفظ می‌شود؛ جایگزینی مسئول کارهای باز باید جداگانه انجام شود.
- تمام تغییرات با نسخه جاری و audit در یک تراکنش هستند. خطای نام کاربری تکراری، نسخه قدیمی یا شکست میانی هیچ تغییر جزئی به‌جا نمی‌گذارد؛ تکرار DELETE پس از موفقیت بی‌اثر است.
- MCP: `update_user`، `update_password_user` و `delete_user` همان handler و مجوز را دارند. دستیار برای ویرایش غیرمحرمانه و حذف، شخص و نسخه را از `list_users` می‌خواند و کارت تأیید می‌سازد؛ رمز جدید فقط در فرم امن وارد می‌شود.
- بدون مهاجرت دیتابیس. آزمون‌های `password-accounts.cjs`، `assistant.cjs` و `mcp-integration.cjs` مسیرهای مجوز، حفظ سابقه، ابطال ورود/توکن و تأیید دستیار را پوشش می‌دهند.


## Role-based account provisioning — ۱۴۰۵/۰۷/۱۹

The default form selects one or more named job responsibilities from `jobRoles` in `lib/permissions.ts`. These explicit policies map responsibilities to existing authenticated workflow capabilities; no LLM guesses or grants permissions from free text or an organizational unit. Necessary warehouse, service-domain and representative scope is collected separately. The form previews business actions; advanced manual grants remain available as an explicit alternative.

`permissions.roleAssignment` stores selected stable role IDs and necessary scope inside the existing member permissions JSON. `validatePermissions` derives a fresh union of allowed grants from that selection and ignores extra caller-supplied grants. Shared dependencies survive role removal; obsolete grants and scopes do not. External representative and observer roles cannot be mixed with other responsibilities. Role selection never creates an administrator.

UI, assistant and MCP create/update tools use the same validator and existing admin-only audited account handlers. `get_user_creation_guide` exposes the role catalog and policy version. Existing accounts without role assignments retain their exact manual grants on unrelated edits, and changing the unit never changes grants. Switching an old account to roles is an explicit replacement. Assigning a job role does not automatically reassign existing duties or position membership. Policy edits require review of these mappings and tests; they do not silently update stored account grants.

No schema migration: the permissions JSON remains part of preserved app_members records and existing reset backup/freeze rules. Validation: password-accounts (all role policies, scope, conflicts, forged grants, role removal, HTTP/MCP parity and optimistic revision), MCP integration, assistant, TypeScript, production build and interactive browser role-picker checks.

## Shared contact details — 2026-10-12

Account creation and editing accept optional `mobile` and `contactEmail`, separate from immutable legacy authentication email and local credentials. Empty fields are allowed; omission during an update preserves the prior value, while explicit empty strings clear it. Iranian mobile numbers accept Persian/Arabic digits and country prefixes and are stored with the leading zero. Contact data does not grant permissions or verify ownership of a phone/email.

A single `member_contact` flow entity keyed by stable `app_members.id` supplies both the account editor and personnel portal. No phone/email matching or copying between profiles occurs. Internal employees retain their existing one-to-one base personnel link; external accounts do not receive staff profiles. Contacts may be viewed and edited by the current account holder, HR for internal staff, or the administrator. Other roles do not receive coworkers' contacts through personnel responses or the contact endpoint. The portal offers “اطلاعات تماس من” and HR/admin editors beside an employee record.

The authenticated `/api/member-contact` handler and `get_member_contact` / `update_member_contact` MCP tools share validation, explicit confirmation, UUID retry protection, audit and optimistic revisions. Account edits additionally require the current `contactRevision` when contact fields are supplied, so an HR/self edit cannot be overwritten by an older account form. Permission and identity snapshots are guarded within the mutation transaction. Existing generic maintenance triggers protect contact changes. Both reset scopes preserve the contact entities with account identities; no schema migration is required.
