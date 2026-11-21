# Employee home and self-service

Owner accepted the proposed two-entry employee home and four personnel groups, with the personal salary-ruling surface removed until separately requested.

## Scope and safety

- Real internal employee accounts use two main home cards: cartable and personnel. Existing explicitly permitted business applications remain in a work section with their existing routes; no new grants are inferred. Administrator, definition-profile previews, hospital and external representatives retain their established dashboards.
- Home reads existing tasks/inbox APIs only. Unknown/loading/error is not reported as zero. Account-bound snapshots and abort cleanup prevent old-account content from flashing after a context change. Actual task owners/reviewers are filtered through the existing cartableRows projection.
- Four personnel groups reuse the existing contact, identity/documents/family, contracts/responsibilities, published payslip, attendance, leave, missions, advance/loan, purchasing and custody components. The default landing does not automatically open a leave request. Requests use a type selector. Own contract links open own documents. Existing administrative/payroll workspaces remain separately gated.
- Personal rulings have no menu, tab or rendered listing; legacy personal ruling routes land on own payslips. No ruling record, salary amendment, independent approval, calculation policy or underlying API/MCP operation was removed.
- Cartable exposes messages, sent requests and actual personal reminders. Sent requests reuse existing personnel detail actions, linked-work inbox and process history; no duplicate write form or service is introduced. Role-preview/service-limited contexts cannot open these new personal destinations. Existing role tools and history remain available. The distinct reminder tick utility remains unchanged.

## Verification

- employee-self-service-ui: two main entries, permitted job apps only, no duplicate development/reminder tiles, read-only summary and account mismatch, four groups without rulings, native request selection and own-only personal tracking.
- personnel-ui: current grouped navigation plus existing submitted payloads, calendar reset/race, leave/finance readiness, own-only salary/contact visibility, administrative scopes, evidence retry and custody deep links.
- role-cartable-ui and task-program-access-ui: existing role queues, owner/reviewer state filtering, restricted mounts, exact domain navigation and preserved direct/linked-message listeners.
- page-detail-back-ui: updated obsolete InboxPanel export/ordinary-message fixture to the existing InboxWorkflowPanel request receiver; delayed responses remain closed and save/back behavior is preserved. reminder-notifier-ui passed.
- employee-self-service-browser: actual React components at true 1280, 430 and 320px; home cards, personnel groups, published own payslip with broader-response privacy check, existing advance form, cartable personal request tracking, reminder access and legacy ruling route. All navigation performs GET only; no real company data or messages were created. Screenshots and results are external to the repository.
- TypeScript and production build checked before publication. Existing large-chunk warning is not a new functional failure.

## Boundary

This does not implement the subsequently requested administrator role-allocation redesign; that work is currently investigation and a proposal. Preserve existing role definitions, scopes and access grants until separately authorized. GitHub and private Sites publication are distinct from company-domain deployment.
