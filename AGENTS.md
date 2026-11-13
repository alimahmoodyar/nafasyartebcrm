# Nafasyar development rules

## Paired phone and desktop workflow (owner agreement 2026-11-13)

- Owner approved explicit, optional pairing of two devices signed into the same account using a short-lived QR. Do not broadcast scans, navigation or form contents to every session of that account. Each device retains its own authentication and current server-enforced role/record permissions.
- Intended experience: a phone scan opens the authorized work on both paired devices; shared form edits and final submission results stay synchronized. Preserve required domain confirmations and prevent duplicate commits, silent overwrites and loss of unsent edits during disconnects. Switching role, losing authorization, logout and unpairing must not leave access through the pairing.
- Implementation contract and explicit coverage limits are in `docs/PAIRED-WORKSPACE.md`. Browser-local scanner events alone are not evidence of cross-device synchronization. Preserve shared-work epochs, record/schema field keys, visible conflict/unsent-edit handling and single-flight submission; allow only explicitly registered view/search/selection intents with exact record identity; never replay business submissions or silently broaden this into arbitrary remote button execution or file/camera sharing. Deployment is established only by native publication and full source comparison evidence.

## Shared workflow label rule

- Owner agreement 2026-11-13: follow `docs/WORKFLOW-LABEL-POLICY.md` for every QR/barcode print path. Labels identify an immutable object; the shared server resolver selects permitted current work using the authenticated role, record scope and current state. Never encode authority or an automatic stock/payment approval.
- Before adding a label producer, document its roles/stages/actions, unknown/retired/ambiguous behavior and compatibility; register it in `tests/workflow-label-policy.cjs` and test the generated label against the shared resolver. General scanners reuse `/api/workflow-scan`; in-form physical item verification retains domain checks.
- Unknown supplier labels may open receiving/identification only for assigned active receiving warehouse staff, retaining the original code as an inert reference. Invalid, retired or unauthorized internal labels never become new receipts. Do not create parallel business data.

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

- Owner clarification, 2026-11-12: all current application data is for pre-production testing. Execute the cross-profile business walkthrough against the existing shared application data and existing warehouses, the existing central/reference warehouse (the owner clarified «انبار مرجع»; do not infer a city name). Do not create a separate training warehouse or redirect role-profile actions to isolated training tables for this walkthrough. Create needed records through their owning UI forms and preserve the authenticated administrator as actor. This supersedes earlier assumptions that this walkthrough must be isolated from existing application data. It does not authorize deleting/resetting any data; the owner will decide when to reset before actual use. Automated test fixtures may remain isolated.
- The system administrator may advance an end-to-end workflow from the owning module for process testing and operational oversight. Keep each action in its domain module; do not create a parallel admin-only workflow.
- Administrator actions must pass the same workflow state, validation, confirmation, idempotency and data-integrity checks as other users. Record the authenticated administrator as the actual actor; never impersonate a business role or fabricate an approval by another person.
- Configure ordinary users later with explicit, least-privilege access per role and operation. Navigation visibility is not authorization: enforce record and action permissions in the server handler, and keep HTTP, UI and MCP behavior aligned.
- Preserve segregation of duties for sensitive approvals. When the administrator personally performs an approval during a test, record it as the administrator's approval; do not treat it as proof that the intended role's permissions work.
- Before release, walk each workflow as administrator to validate transitions, then verify each role with its own account and confirm it sees and performs only its assigned work. Keep test evidence separate from real financial, inventory and supplier records.

## Driver independent device pickup (owner agreement 2026-11-12)

- Driver login and independent work do not require a preassigned mission. Keep assigned missions available, but allow one-device initial carrier pickup receipts separately, optionally referencing an authorized inbound device mission.
- Initial receipt is physical custody only: sender/carrier/waybill/condition, optional readable serial, immutable receipt identity and reprintable QR. Do not invent warranty, stock, a repair case, or successful physical printing.
- Device stays with its driver until authorized company service intake explicitly confirms physical receipt. Intake then links a compatible active case or completes the existing service case form; case creation and receipt linkage must be atomic and idempotent. Keep the agency coordinator out of this intake workflow.
- Printer and phone models are not chosen yet. Provide a printable label/PDF first; direct portable-printer integration is deferred until hardware is known. All data remains in the shared application dataset.

## Office device service (owner agreement 2026-11-13)

- Customer-response staff receive devices at the company office. Home technician means «سرویسکار خدمات پس از فروش خانگی»; keep its profile separate from customer response and agency coordinator.
- Permanent device QR identifies the serial across visits; each repair visit is a separate existing as_case. Reuse the same protocol in manufacturing back labels and legacy-service labels; no customer data inside QR. Scan only resolves authorized records, never consents, receives, consumes or delivers by itself.
- Derive office estimates from published consumer part prices and formula labor rates. Missing prices remain incomplete; no manual-price fallback. Keep historical estimates and invalidate consent/authorization on revision.
- Append actual performer and recorder separately for each office technical action. Self defaults to authenticated staff; manager/admin may record another active home technician only with a reason and CAS-protected membership. Never fabricate another person’s work/approval in role preview.

- Service stages show both Persian date and Tehran clock with seconds. Server history timestamps are registration instants; preserve performer/recorder and state transitions. Never invent a clock for day-only legacy data or call inter-stage elapsed/waiting time actual technician labor. Flag backdated declared days and exclude missing/backdated/negative records from precise duration averages, showing the valid sample count.

## Deferred role training reminder

- Owner request 2026-11-13: preserve docs/ROLE-TRAINING-PLAN.md. When work reaches role training, personnel modules, employee profile completion or user onboarding, proactively remind the owner of the role-sized text, workflow schematic, field/form help and actual short screen-recording proposal before deciding implementation scope. This is a project milestone reminder, not a scheduled notification or authorization to implement training now. Do not claim an external reminder has been scheduled.

## Company assets agreement (2026-11-13)

- Follow `docs/ASSET-WORKFLOW.md` for two-party custody, controlled transfers, external signed/mobile confirmation, technical service/usage, safe stops and CEO/delegated disposal. Reuse existing company assets, personnel, representatives and warehouses. Never equate a scan with final receipt or provider configuration with actual SMS delivery. Preserve role/audit identity, immutable history and shared-label policy.

## Operations first, comprehensive finance later (owner agreement 2026-11-13)

- Complete operational workflows to the agreed necessary scope first. Start comprehensive financial development when the owner explicitly opens that stage; then review purchase, warehouse, production, sales and service end to end and build finance on their actual events and shared records.
- During current work, retain stable source/event links, amounts and currencies, quantities and units, dates/times, evidence, stage/status, actual performers/recorders and change history. Preserve original values and references needed for later reconciliation; do not invent missing amounts or create parallel financial records.
- Record information once at its source and reuse it downstream. Automate calculations, matching, routing and decisions with approved deterministic rules; send discrepancies, exceptions and judgment/authorization decisions to the appropriate person. Every automatic action must retain its reason, source references and auditable result, with retry and concurrency protection.
- Keep UI, HTTP and MCP aligned on the same domain logic, scopes, confirmations and audit identity. Continue necessary money/stock integrity, access and duplicate-prevention controls during operational development; known defects in these controls are not deferred to the financial stage.
- At the comprehensive finance stage, verify the laws and requirements effective at that time before completing statutory documents, reports and exports. Reuse existing agreed financial rules; this roadmap does not authorize discarding working payment, debt or bank-reconciliation behavior.

## Automation review of existing workflows (owner clarification 2026-11-13)

- Standing design requirement from now on: proactively propose each new or revised workflow with automation-first reasoning—reuse source data, prefill known fields, automate decisions under approved rules, automatically route/retire follow-up work, and expose only exceptions or necessary physical/judgment/authorization confirmations to people. Explain concrete reductions in duplicate entry, clicks and waiting; when a business rule is missing, ask one focused question with a recommended rule. The deferred finalization audit is not a reason to postpone this design approach during current development.
- Owner sequencing decision: defer the comprehensive, system-wide automation/optimization pass until finalization; complete remaining necessary operational workflows now. When the owner starts finalization, go-live preparation or an end-to-end readiness review, proactively remind them of the task «بازبینی یکپارچهٔ سیستمی‌سازی و بهینه‌سازی کل سامانه» and its initial candidates in `docs/QUALITY-REVIEW-QUEUE.md`. This is a project-stage reminder, not a scheduled notification or authorization to run the entire pass now.
- Continue applying established automation rules and necessary correctness/access/stock/payment controls in each new feature. Deferral does not mean building avoidable duplicate entry now or postponing known integrity defects. At finalization, review all implemented modules together, their cross-role handoffs, UI/HTTP/MCP parity, exception ownership and before/after effort/delay evidence; resolve missing business rules with the owner before changing required approvals.
- Review already implemented workflows for avoidable manual entry, repeated checking, administrative confirmations and follow-up. The goal is less human work and rule-based system decisions using owner-approved rules, in addition to code performance. Distinguish automation already present, missing execution/orchestration, and proposals needing a new business rule.
- For each candidate record: current human step, available trusted inputs, approved decision rule (or the precise missing rule), resulting automatic action, exception/human owner, audit/retry guarantees and a practical effort/delay measure. Do not silently remove agreed physical receipt, technical judgment or required approvals. Comprehensive finance remains deferred under the roadmap above.

## Manual warehouse purchase request (owner decision 2026-11-13)

- Automatic production/project demand already has its own shortage logic. A manual warehouse purchase request may intentionally request additional stock for another reason; do not silently net its entered amount against stock or change automatic-demand behavior.
- Show current usable/free stock in the same unit and offer two explicit choices: send the full entered amount (selected by default), or subtract free stock and send the calculated remainder. Only the second explicit choice changes the purchase quantity. Reserved, quarantined or otherwise unavailable stock is not free stock. Show open/incoming purchases as context rather than silently deducting them under a new rule.
- Preserve original entered amount, chosen treatment, stock calculation basis and final sent amount in the request/audit so downstream procurement uses that final amount without deducting the same stock again. This records the agreed behavior; implementation/publication is not implied by the note itself.
