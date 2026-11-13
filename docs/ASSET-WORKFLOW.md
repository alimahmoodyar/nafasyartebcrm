# Agreed asset workflow — 2026-11-13

Owner-approved first release: reuse company assets and the shared application dataset. Custodian is a revocable job role, not a personal account or separate ledger. Each asset retains its immutable identity, current responsible holder, location and dated events across reprints and changes of custodian.

## Custody

- Administrative assets move internally on sender request and recipient's exact QR scan plus explicit final confirmation. Sender remains responsible until receipt. Pending requests can be cancelled/rejected; duplicate scans and concurrent acceptance cannot move the asset twice.
- Molds, machines and external custody (contractor, sales/service representative) require custodian approval before receipt. Group policy can require stricter control. Warehouse destinations use existing active warehouse IDs and receiving staff permissions; no parallel warehouse or stock balance is created.
- Personal profile → entrusted assets is available to employees and scoped representatives. Exact asset scanning opens its permitted actions through the shared workflow scanner. Former holders cannot read later private custody evidence.
- External initial handover requires authenticated confirmation and a signed physical receipt. Physical custody is recorded when received; the signed-paper obligation remains open until the custodian attaches and identifies the actual signed receipt. Periodic mobile confirmation needs paper only when requested. Unknown/unscanned items are never implicitly received or confirmed.
- Custodian can create a seven-day, revocable link for up to 50 items of one holder/mobile. Tokens are hash-addressed; no OTP/session token is returned by ordinary list/MCP APIs. Mobile OTP is single use, five attempts, five-minute expiry, at least one minute between sends and ten sends per link. The verification session expires in 30 minutes. Confirmation rechecks each custody ID and commits receipt, assets and audit atomically.
- Return uses the same pending transfer/actual receiving flow. Receipt transfers physical responsibility to the company. Damage/missing-property investigations remain open; receiving damaged property is not healthy clearance.
- Legacy annual written letters and personnel exit clearance remain available; personnel disablement still requires return and asset clearance. Existing legacy letters stay bound to their custody cycle.

## Technical management

- Custodian assigns an active responsible technical person and links molds/machines to existing product or material IDs. Mold cavities are explicit; machine/cycle/hour counters are cumulative.
- Technical owner sets the checklist, executor and day/hour/cycle thresholds (whichever arrives first), and whether overdue service stops use. Custodian tracks outstanding work. Daily routine output derives cycles from actual total output/cavities and daily close derives hours from actual elapsed job time for explicitly selected equipment. Legacy final assembly can also record selected equipment. Reports without an equipment selection do not invent a usage allocation; other sources can use the audited manual counter form.
- Production counter updates participate in the original production transaction and retry UUID; unrelated, stopped, disposed or mandatorily overdue equipment is rejected. A technical correction can reduce a bad counter only with a recorded reason; totals never reset after service.
- Current holder/custodian/authorized warehouse staff can report faults and stop dangerous use. Technical owner controls return to work. Service records include actual performer, start/end, report, consumed-parts description and cost; technical review and successive service snapshots remain in immutable events. Recording parts/cost here is evidence, not a second inventory or financial posting.
- CEO or an explicitly delegated internal role decides sale/scrap. Scrap requires technical opinion. Lost/stolen assets remain under investigation and do not clear the holder. Recovery requires inspection. Approved disposal preserves the passport/QR and opens financial follow-up; finance records its actual reference separately.

## SMS.ir configuration and hosting boundary

Provider chosen by owner: **sms.ir**. Fixed HTTPS Verify API follows the official provider SDK: https://github.com/IPeCompany/SmsPanelV2.nodejs/blob/master/index.js (SendVerifyCode). No new dependency.

Configure only in secure hosting environment settings:

- `SMSIR_API_KEY` (secret; never paste in chat or commit)
- `SMSIR_VERIFY_TEMPLATE_ID` (approved quick-send template ID)
- `SMSIR_VERIFY_CODE_PARAM` (template parameter name, default `CODE`)

Expected template: a company asset-confirmation OTP message with the matching parameter. Provider HTTP success alone is insufficient; API `status=1` is required. Missing configuration fails closed and does not move custody. No live SMS was sent by development tests.

The existing Site audience is preserved. An expiring asset link does not bypass Sites access controls; a contractor outside the permitted Site audience must be granted appropriate visitor access before using it. This release does not make the whole ERP public. Hardware printing/camera and actual provider delivery require a separate physical/provider check and must not be reported as tested by the synthetic suites.

## Persistence and verification

New state is operational `asset_*` JSON in existing `flow_entities`; existing D1 batch rollback, reset backup/deletion and maintenance-freeze triggers apply. Evidence uses the existing private asset-file store; no new schema, migration or parallel data. Lists and events have bounded server-side pagination. Existing member/warehouse directory and legacy asset snapshot writes still use their prior directory/snapshot loaders; no large-data SLA is claimed.

All actions have UI/HTTP/MCP paths with the same server guards. Public OTP actions are intentionally not an MCP impersonation capability. Label family `NAFASYAR-ASSET/1:<immutable UUID>` contains no person, permission or mutable action. Malformed/missing/unauthorized internal asset labels never fall through to supplier receiving.
