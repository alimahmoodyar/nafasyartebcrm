# Personnel onboarding and opening inventory — 2026-11-21

Owner-approved implementation; baseline 7eec81e9175315cd8f0638147622c530cd57a05d. Concurrent GitHub changes are integrated before push; exact refs, full path/blob/type comparisons and actual deployment result are stored in the external release report, not inferred here.

## Implemented

- Atomic HR base approval plus personal-only account/contact/audit, national-ID username and mobile initial password hash, universal must-change enforcement for local sessions and MCP principals. No password returned and no job grants. Existing-account preservation, username collision handoff and rollback.
- Private employee declaration/photos, independent numbered units, explicit condition, quantity/add-row and no-assets assertion. Custodian review/return, source passport matching and holder/serial/pending/disposal/version guards. Atomic official opening inventory, file binding, events, registration group and numbered print copies; no invented historical handover.
- Separate HR minimal tracking, personal self-service, custodian review/inbox and profile obligations. Same HTTP/MCP handlers, confirmed file upload and private chunk download.
- Photo object keys include the content digest; competing uploads with the same UUID cannot overwrite committed bytes. Loser cleanup preserves the winning blob, verified with a real interleaved upload fixture.
- Receipt camera editing-state cleanup now uses the latest callback only on unmount; parent rerenders no longer incorrectly release another row while a photo is being confirmed.

## Validation

Isolated real SQLite migrations and in-memory private bucket: onboarding-assets; personnel-employment; personnel-account-link; password-accounts; assets; asset-registration; asset-workflow; system-reset. Camera/crop state tests, form presentation audit and TypeScript check. Browser fixture at 1252/500 CSS px exercises three independent rows, second-row binary photo, no default condition, employee/custodian controls, review checkbox and numbered print group with no horizontal overflow or unreachable action. Visual screenshot reviewed. Tests do not touch real accounts/data or send real notices outside fixtures.

Specific negative cases include HR/staff/custodian isolation, first-password block/session revocation, foreign photos/forged holder, missing/duplicate photos, review reason, no-assets conflict, exact revisions/idempotency, injected approval/account failure rollback, same existing passport rather than duplicate, and file integrity/access via HTTP/MCP. Existing personnel test now expects automatic account creation rather than creating a second account after approval.

## Limits

No real hardware camera/printer, rented-server or live business walkthrough was performed. No claim of measured organizational load or physical rollout readiness. Existing BUCKET/operational reset/freeze cover declarations, photos and duties; accounts retain the established preservation policy. The separate factory-reset request remains unexecuted. Publication is complete only when exact succeeded Sites version/source and GitHub/ready/live complete source trees are verified externally.
