# Nafasyar public cargo handover

Public capability-only gateway. The CRM stays private. Only POST /api/handover is forwarded to the fixed private /api/transport/handover endpoint; cookies, user identity and incoming authorization headers never pass through. No D1/R2 bindings or parallel data. The private domain handler validates mission, token, expiry, current state and revision on every operation.

Runtime secret CARGO_BACKEND_SERVICE_TOKEN is the private Site's supported service-access bearer; never put it in source, browser code or links. Public links use a random 256-bit token in their URL fragment. Only its digest is stored in the shared mission. Reissuing revokes the old token. The gateway owns no general-purpose proxy, finance endpoint, listing API or MCP. Existing authorized MCP tools issue links using the same private handler.

Build: node scripts/build.mjs. Test: node --test tests/gateway.test.mjs. Main CRM tests/procurement-approved.cjs verifies the shared token, photo, receipt, audit and stock rules. No real SMS is sent by automated tests.

Private runtime CARGO_PUBLIC_ORIGIN points to this published origin. Configure it only after the public gateway works. Use native Sites access changes for this companion only; do not change CRM access. Source is mirrored in the CRM public-cargo subtree and the GitHub sites/nafasyar-cargo branch. Compare its complete Git tree independently before push and after confirmed deployment.
