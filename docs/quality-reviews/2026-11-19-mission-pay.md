# Mission pay implementation review — 2026-11-19

Scope: owner-approved internal mission policy, operational time evidence and existing monthly contract-v2 payroll. No bank transfer, external message, live business-data mutation, browser or personal-server inspection.

## Source and decisions

- Policy: `docs/process-design/STAFF-MISSION-PAY-POLICY.fa.md`; fixed version `company-mission-2026-11-19-v1`.
- Departure actual office + travel threshold is 960 minutes, never doubled hours. Ordinary base is replaced, not added to a full monthly day again. Destination actual ordinary work is paid normally; actual out-of-schedule work is 140%.
- Full destination day: one ordinary contractual daily base plus one base premium, other benefits once. Return leg before midnight on that destination day adds no travel amount. A return crossing midnight (including starting before office opens on the new day) splits to ordinary travel plus actual ordinary office work; no automatic eight-hour top-up, leave or absence. Attendance exemption and financial minutes are distinct.
- Normal daily/hourly conversion follows explicit existing payroll full-day minutes, never a hardcoded statutory denominator. Insurance/tax classification requires an independently published mission component, amount zero / premium basis 10000bp; no guessed tax law.
- Own authenticated server-time start_work/end_work events; foreground real GPS attempted independently at both. Shared arrival is first on-site work start; return_start is distinct from end_work so rest is not automatically travel. All open work must close before return. Manual event-free time evidence follows the same domain handler and manager review; device evidence cannot be overwritten.
- GPS denied/unavailable/late does not discard time; point observation/receipt times remain distinct. Stable UUID replay and lost-ack reconciliation avoid duplicate starts/ends. Role/domain/self-review, current revisions, reset freeze, source revision/set guards and audit remain in force across HTTP/UI/MCP.

## Reviewed invariants

- No guessed productive work from elapsed trip, coordinates, or report timestamp.
- No base three-times payment, travel overtime, double ordinary day, doubled welfare benefits or return-day forced leave/absence.
- Manager approval is the existing sales/service decision. Finance sees evidence inside the individual slip, no extra standalone mission approval stage.
- Published financial-final/paid/closed slips are not rewritten. Existing reasoned full-slip correction and independent reapproval remain; manually edited mission slips are explicitly marked manual_documented.
- Work events/payTimes remain bounded shared staff_mission JSON; calculation/day policy snapshots remain hr_payroll JSON. Existing generic flow freeze, atomic commits, backup/deletion and private mission evidence cover all new data; no table/FK/R2 manifest change or production reset.
- Multiple trips in one day, overlap with office/work/travel, missing old time evidence and missing classifications fail explicitly for automatic calculation. Legacy unknown missions still require documented explicit correction; zero is not silently accepted.

## Validation

Passed isolated suites: payroll-approved (14h and 16h departure, 1,750,000 example, full destination plus actual 140% OT, base-only premium, 3h and 11h return, no leave/absence/top-up, midnight/month boundary, just under 16h, invalid/overlapping evidence, automatic authenticated HR → payroll → independent approval → finance → treasury and immutable finality); staff-missions (548 assertions including both work-event GPS, own roles, server times, UUID replay, finish/open-work rejection, MCP, immutable manager approval); payroll-approved-ui; staff-missions-ui (both start/end GPS and denied/lost-ack cases); personnel; personnel-integrity; accounting; system-reset; mcp-integration (548 tools); assistant-workspace (548 schemas / 16767 visible combinations); form-presentation-ui. TypeScript check passed. Final native build and deployment/source equality are separately recorded in the release audit; this document is not itself evidence of publication.

## Limits / pending decisions

- Internal policy is not a legal-compliance certification. Existing individual finalization requires acknowledgment of warnings for statutory fixed/basic-wage allowance and any contractual return-day reduction. No legal minimum is silently invented or internal rule silently changed.
- Actual phone GPS permissions/hardware and a physical trip were not exercised here; synthetic foreground GPS/SQL/R2 fixtures verify the flow. No browser or user server was opened.
- Legacy completed trips lack reconstructible actual work/route boundaries. No rewrite/migration guesses them; documented slip corrections remain available.
- Bank workbook/API/hardware-key and home-sales workflow decisions remain pending. No bank settlement is executed by this change.
