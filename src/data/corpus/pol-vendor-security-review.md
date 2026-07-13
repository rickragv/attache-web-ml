---
id: pol-vendor-security-review
title: "Vendor security review policy"
category: security
collection: policies
tags: [vendors, third-party-risk, review, procurement]
locale: en
updated: 2025-09-12
owner: security
audience: internal
---

# Vendor security review policy

**Version 1.8. No vendor processes Meridian data or connects to our systems without a completed review. Procurement cannot issue a PO until the review ticket (`VSR-xxxx`) is approved.**

## Risk tiers

| Tier | Definition | Examples | Review depth |
|---|---|---|---|
| Critical | Touches card data, PII at scale, or money movement | KYC verification vendors, SMS providers, cloud (AWS) | Full assessment + contract security addendum + annual reassessment |
| High | Production system access or bulk internal data | Observability SaaS, CI/CD | Full assessment, reassess every 2 years |
| Moderate | Limited internal data, no production access | Design tools, HR software | Questionnaire + certifications check |
| Low | No Meridian data | Stationery, facilities | Registration only |

## What a full assessment covers

- Certifications: SOC 2 Type II (mandatory for Critical/High), ISO 27001, PCI AOC where applicable. Reports must be under 12 months old.
- Data flow diagram: what data, where stored (Indian data-residency required for payment and KYC data per RBI), retention, and deletion on termination.
- Technical controls: encryption at rest/in transit, SSO/SAML support (mandatory — password-only vendor logins are rejected), breach notification SLA of 24 hours or better in contract.
- Subprocessor list review; material subprocessor changes require 30-day advance notice.

## Ongoing obligations

- Critical vendors: quarterly service review including security incidents and SLA performance; annual tabletop with our top two (KYC, SMS).
- Continuous monitoring via the external attack-surface tool; a vendor breach in the news triggers an out-of-cycle reassessment within 5 business days.
- Offboarding checklist: access revoked, data deletion certificate collected within 30 days, DNS/API credentials rotated.

Exceptions require CISO sign-off, are time-boxed to 90 days, and are tracked in `SECGOV`.
