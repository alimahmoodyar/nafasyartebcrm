# Unified employee home — release 6

Approved single-role direct home and multi-role personal home are implemented in the real employee account shell. The saved process model and HTML prototype are under docs/process-design/UNIFIED-EMPLOYEE-HOME.fa.md and docs/design-prototypes/employee-role-homes.html.

The session endpoint projects catalog navigation from current assigned profile IDs and effective permissions. It creates no grants or preview identity. EmployeeHome enters existing section/target destinations. Shared services and cartable summaries occur once on the common home. Selection survives returning from forms, is account-bound and invalidates when role bindings disappear. Legacy tools remain available. Administrator and external-agent dashboards retain their existing entry policy. No workflow rules, assignments, source data or database migrations changed.

## Validation

- TypeScript noEmit passes.
- employee-self-service-ui checks no-role, legacy-only, single/multi roles, exact existing HR target, shared entries, controlled selection, account change, stale-role removal and read-only navigation.
- member-role-assignments exercises all operational internal profile projections, real local password sessions, dual HR/custody roles, one personal+two organizational tasks in the real account's existing /api/tasks, foreign task exclusion, scope/revision/removal checks, preserved credentials/contracts/messages/history and all existing role assignment protections. SQLite fixtures only.
- employee-self-service-browser exercises actual React home, personnel and cartable at 1280, 430 and 320px; no horizontal overflow, single role direct entry, multi-role selection/return, original HR form entry, grant removal, private requests/payroll and GET-only navigation. Desktop and mobile screenshots inspected. Fixture uses the unchanged built global stylesheet plus the newly compiled component styles.
- inbox checks participant-only privacy, positions, reassignment, approval, attachment, idempotency and separate test profile identity/audit rules.

Build, exact GitHub/native source parity, publication and live verification are recorded in the external release evidence after completion. Local browser uses isolated fixture accounts; no production employee role or personnel data was edited for QA. Earlier release-5 remote-build publication failed on an unsupported dependency source, so a successful release-6 deployment must be confirmed before reporting publication.
