---
id: pol-access-control
title: "Access control and least privilege policy"
category: security
collection: policies
tags: [access-control, least-privilege, iam, pam]
locale: en
updated: 2026-05-06
owner: security
audience: internal
---

# Access control and least privilege policy

**Version 4.1 — owned by the security team; mandatory for all employees, contractors, and service identities.**

## Principles

- **Deny by default.** No standing access to production data. All access is role-based, requested through the IAM portal, and expires automatically.
- **Least privilege.** Roles grant the minimum permission set for a documented job function. "Read-all" roles were abolished in 2025-Q2; requests for them are auto-rejected.
- **Separation of duties.** The person who writes a payout adjustment cannot approve it; deploy authors cannot self-approve production changes touching money movement.

## Access tiers

| Tier | Examples | Grant | Max duration |
|---|---|---|---|
| T0 – public internal | dashboards, docs | SSO group | Standing |
| T1 – merchant metadata | support console (masked PII) | Manager approval | 90 days, renewable |
| T2 – financial data | settlement DB read, recon tools | Manager + data owner | 30 days |
| T3 – money movement / CDE | payout overrides, token-vault | Security approval + PAM session | 4 hours, recorded |

Break-glass access (T3 without pre-approval) exists for SEV-1 incidents only: it pages the CISO delegate, is recorded end-to-end, and is reviewed within 24 hours.

## Service identities

Services authenticate via SPIFFE workload identities; long-lived static credentials are prohibited. Secrets live in Vault with 24-hour lease TTLs. Any AWS access key older than 90 days is auto-disabled by the `key-reaper` job.

## Reviews and enforcement

Quarterly access recertification: managers attest every T1+ grant; unattested access is revoked on day 14. Offboarding revokes all access within 1 hour of HRIS termination events. Violations route to `SECGOV` and repeat offenses to HR.
