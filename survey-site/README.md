# Hospital gas questionnaire host

The public Sites project serves a compiled copy of the shared questionnaire fields. It stores accepted responses in its own D1 database. It has no CRM database access or CRM login credential.

Run `node scripts/build-gas-survey.mjs <public-site-checkout>` to generate the public Worker and copy its initial migration. Keep the public hosting manifest with logical D1 binding `DB` and its package script in that checkout. Configure `NAFASYAR_ORIGIN` and `GAS_SURVEY_BRIDGE_SECRET` on the public site. Set the same signing secret and `GAS_SURVEY_PUBLIC_ORIGIN` on the private CRM. Do not rotate the signing secret while previously shared questionnaires are active or responses await import.

Public invitations are signed, expire, and can accept one response. The authorized CRM browser requests short-lived tickets for the public host, imports signed responses when the list opens or refreshes, and records revocations after the host confirms them. The CRM retains its existing access policy.

CRM reset backs up and deletes imported operational records using its existing flow-entity contract. The external host has a separate operational database. Its submissions and revocations are not part of the CRM reset.
