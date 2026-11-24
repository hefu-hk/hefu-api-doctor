# Contributing

Use a short feature branch and keep changes focused. Run `npm test`, `npm run build` and `npm run test:e2e` before submitting a pull request.

Tests must mock all external API calls and must never incur model charges. Do not add analytics, credential persistence or automatic live tests without a documented privacy and security review.

New report fields require an explicit privacy review. Never add request bodies, response bodies, credentials, endpoint URLs, supplier identifiers or upstream costs to reports.

Public documentation and UI copy should be concise, bilingual where the existing interface is bilingual, and accurate about features that are not yet implemented.
