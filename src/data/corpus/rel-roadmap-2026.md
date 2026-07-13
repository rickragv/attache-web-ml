---
id: rel-roadmap-2026
title: "Product roadmap themes — 2026"
category: product
collection: release-notes
tags: [roadmap, strategy, themes]
locale: en
updated: 2026-07-05
owner: product
audience: external
---

# Product roadmap themes — 2026

Published 2026-07-05. Directional, not a commitment; dates indicate targeted quarters and may shift. Feedback: roadmap@meridianpay.in or your account manager.

## Theme 1: Success rate as a product (H2 2026)

- **Smart routing GA (Q3):** automatic issuer-aware routing across multiple acquirer connections, targeting +2–4pp card success uplift observed in the pilot across 46 merchants.
- **Retry orchestration (Q4):** opt-in automatic retry of `ISSUER_DECLINED` transactions on an alternate rail within the same checkout session.
- Risk Insights dashboard exits beta in Q3 with issuer benchmarking against anonymised network-wide baselines.

## Theme 2: Money movement beyond pay-in (Q3–Q4)

- **Payouts v2:** IMPS/NEFT/UPI payouts with beneficiary verification, approval workflows, and maker-checker controls; private beta now, GA targeted Q4.
- **Split settlements for marketplaces:** route order proceeds to multiple sellers with per-split fees and independent refund handling. Design partners onboarding in Q3.

## Theme 3: Compliance without friction (ongoing)

- Video-KYC option for proprietorships, cutting document-heavy onboarding to under 30 minutes (Q3).
- Automated FIRA delivery via webhook (`fira.generated`) rather than monthly manual download (Q3).
- DPDP consent-manager integration for merchants collecting customer PII through Checkout (Q4).

## Theme 4: Developer experience

- Versioned OpenAPI 3.1 spec and generated SDKs for Node, Python, Java, and Go (Q3; Node and Python first).
- Sandbox scenario engine: scriptable failure injection (issuer down, webhook delay, dispute lifecycle) replacing today's fixed magic values (Q4).

Items announced in past release notes remain on track unless listed under deprecations there.
