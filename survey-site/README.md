# Hospital gas questionnaire host

The public Sites project serves a compiled copy of the shared questionnaire fields and forwards only bounded questionnaire requests to the fixed CRM bridge. It does not read the CRM database directly.

From this repository, run `node scripts/build-gas-survey.mjs <public-site-checkout>` to generate the public Site Worker. Keep the public hosting manifest and its build script in that checkout. Configure `NAFASYAR_ORIGIN`, the Sites service credential `NAFASYAR_SITES_SERVICE`, and `GAS_SURVEY_BRIDGE_SECRET` as server-side values on the public site. Set the same bridge secret and `GAS_SURVEY_PUBLIC_ORIGIN` on the private CRM. Keep both secrets in Sites runtime configuration.

The CRM keeps the access policy for its existing audience. The public host accepts anonymous visitors and exposes only the questionnaire surface. Links carry the capability in the URL fragment, and the CRM checks its digest, expiration, revocation and single-use state before accepting answers.
