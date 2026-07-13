---
id: pol-data-retention
title: "Data retention and PII handling policy"
category: security
collection: policies
tags: [retention, pii, dpdp, compliance]
locale: en
updated: 2026-03-09
owner: security
audience: internal
---

# Data retention and PII handling policy

**Version 3.2 — approved by the Data Governance Council, 2026-03-09. Applies to all production systems and employees.**

## Retention schedule

| Data class | Retention | Basis |
|---|---|---|
| Transaction records (amount, status, UTR) | 10 years | RBI Master Direction on PA/PG |
| Customer PII (name, phone, email) | Life of account + 5 years | DPDP Act 2023, contractual |
| Card data | Never stored — token references only | PCI-DSS 4.0, RBI tokenization mandate |
| KYC documents | Account life + 5 years, encrypted at rest | PMLA record-keeping rules |
| Application logs containing PII | 30 days hot, 365 days cold (masked) | Internal standard SEC-STD-014 |
| Sandbox data | 90 days, then hard-deleted | Internal |

## Handling rules

- PII in logs must be masked at source: phone → `98XXXXXX21`, PAN → `AAXXXXXX1R`, VPA → `an***@okhdfcbank`. The `pii-scrubber` sidecar is mandatory on every service emitting to Loki; exceptions require a security waiver (max 90 days).
- Datasets leaving production (analytics, ML training) go through the anonymisation pipeline `datalake-anon`; direct table copies to the warehouse are prohibited.
- Deletion requests under DPDP are actioned within 30 days via the `privacy-erasure` workflow, which tombstones PII while preserving RBI-mandated transaction skeletons. Erasure is verified by a quarterly sampling audit.

## Enforcement

Automated scanners run nightly against S3 buckets and warehouse schemas for unmasked PII patterns; findings above severity `medium` page the data-protection officer. Violations are tracked in Jira project `SECGOV` and factor into service production-readiness reviews.
