# Nafasyar development rules

## Process discovery with the owner

- For every process described by the owner, check five elements: actor, action, conditions/preconditions, expected result, and exception/failure behavior.
- Reuse established decisions and conversation context. Ask only about missing or materially ambiguous elements, one question at a time, and accompany each question with a concrete recommended behavior and a brief reason. Let the owner accept or edit it; do not silently turn a proposal into an approved requirement.
- Once the needed elements are clear, summarize the agreed process, compare it with existing code, and implement within the authorized scope. Existing code does not by itself establish owner approval of a business process. Do not request fresh permission for already authorized implementation or routine reversible technical choices.

## Enterprise quality without blocking iterative design

- Follow `docs/ENTERPRISE-QUALITY.md`. Apply focused, risk-based checks to every feature; reserve broad load, soak and recovery checks for an owner-triggered end-of-day review. Do not rerun the entire suite for every small change.
- Never defer a known authorization leak, duplicate/incorrect financial or inventory posting, data-loss risk, or broken migration until the nightly review. Resolve it before releasing the affected change.
- New growing lists require bounded server-side queries and pagination; avoid loading all historical rows to filter or total them in application memory. Track pre-existing violations as debt rather than expanding an unrelated feature into a full rewrite.
- Keep financial/inventory writes atomic, concurrency-safe and idempotent across UI, HTTP and MCP. Scope every query/action to authorized records on the server.
- Maintain `docs/QUALITY-REVIEW-QUEUE.md` with the changed scope, completed checks and deferred concerns. On an explicit end-of-day review request, use the last verified baseline and exact changed commits/files; test with isolated synthetic data, fix confirmed defects, rerun affected checks and record evidence and remaining risks.
- End-of-day review is manually triggered, not a scheduled or guaranteed background job. Preserve existing publication holds; review authorization alone does not authorize production data changes or a database migration. Claim push, deployment and measured capacity only from corresponding evidence.
- Standing owner instruction: when the owner says «می‌خوام بخوابم» (or clearly equivalent wording) as a current sign-off in this CRM project, treat it as authorization to run the end-of-day quality review, fix confirmed defects in scope, verify and save a written report without another confirmation. Quoted, hypothetical or future descriptions do not trigger a review. On completion, report and stop work; do not shut down the computer, archive the chat or schedule future runs. Explain any runtime limitation that prevents continuing after the app/session is closed. Existing explicit push/deploy holds still apply.

- Every new business capability must also have a corresponding MCP tool in `lib/mcp/tools.ts`, reusing the authenticated domain handler. Maintain parity when changing existing features.
- Enforce the same roles, validation, confirmations, idempotency and auditing in UI, HTTP and MCP. Never expose provider tokens or session credentials. Per the explicit owner request, current local passwords may be revealed ONLY by the audited, reauthenticated admin browser endpoint; never expose password plaintext/ciphertext in general APIs, MCP, assistant history, exports or audit snapshots.
- Add a concise entry to `docs/CHANGELOG.md` for each release and verify meaningful permission/data-integrity cases.
- Push completed changes to GitHub `alimahmoodyar/nafasyartebcrm`, branch `sites/nafasyar-trace` for this TypeScript/Cloudflare app. `main` contains the separate .NET 8 application; do not overwrite it.
- Keep credentials outside the repository. A source push does not deploy the .NET application.

- When adding persistent business data, update `lib/reset-contract.ts` and the reset freeze triggers/migrations so preview, backup, delete ordering and preservation stay complete. Test FK-safe rollback; never run reset on production merely to test a release.

## Admin workflow testing and role access

- Owner clarification, 2026-11-12: all current application data is for pre-production testing. Execute the cross-profile business walkthrough against the existing shared application data and existing warehouses, specifically the central Parand warehouse. Do not create a separate training warehouse or redirect role-profile actions to isolated training tables for this walkthrough. Create needed records through their owning UI forms and preserve the authenticated administrator as actor. This supersedes earlier assumptions that this walkthrough must be isolated from existing application data. It does not authorize deleting/resetting any data; the owner will decide when to reset before actual use. Automated test fixtures may remain isolated.
- The system administrator may advance an end-to-end workflow from the owning module for process testing and operational oversight. Keep each action in its domain module; do not create a parallel admin-only workflow.
- Administrator actions must pass the same workflow state, validation, confirmation, idempotency and data-integrity checks as other users. Record the authenticated administrator as the actual actor; never impersonate a business role or fabricate an approval by another person.
- Configure ordinary users later with explicit, least-privilege access per role and operation. Navigation visibility is not authorization: enforce record and action permissions in the server handler, and keep HTTP, UI and MCP behavior aligned.
- Preserve segregation of duties for sensitive approvals. When the administrator personally performs an approval during a test, record it as the administrator's approval; do not treat it as proof that the intended role's permissions work.
- Before release, walk each workflow as administrator to validate transitions, then verify each role with its own account and confirm it sees and performs only its assigned work. Keep test evidence separate from real financial, inventory and supplier records.
