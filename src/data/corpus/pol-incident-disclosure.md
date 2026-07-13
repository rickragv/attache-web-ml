---
id: pol-incident-disclosure
title: "Incident disclosure and notification policy"
category: security
collection: policies
tags: [incidents, disclosure, cert-in, rbi, communication]
locale: en
updated: 2026-01-30
owner: security
audience: internal
---

# Incident disclosure and notification policy

**Version 2.1. Defines who we must tell, what, and by when, once a security or availability incident is confirmed. The incident commander (IC) owns execution; legal and comms co-sign all external text.**

## Regulatory clocks (start at confirmation, not detection)

| Recipient | Trigger | Deadline |
|---|---|---|
| CERT-In | Any reportable cyber incident (unauthorised access, data breach, defacement) | **6 hours** |
| RBI (DPSS + our sponsor bank) | Incidents affecting payment processing, fraud above ₹5 lakh, or data compromise | 24 hours preliminary, 7 days detailed |
| Affected merchants | Confirmed exposure of their data or transactions | 72 hours, or sooner if exploitation is ongoing |
| Data principals (end customers) | Personal data breach under DPDP Act | As directed by the Data Protection Board; draft within 72 hours |

The 6-hour CERT-In clock is the tightest constraint in Indian fintech — the IC must page legal-oncall **immediately** on confirming any qualifying event, even at 03:00.

## Internal ladder

- SEV-1/SEV-2 security incidents: CISO and CTO within 30 minutes; CEO within 2 hours; board audit committee within 24 hours for data breaches.
- A single source of truth lives in the incident doc; nobody communicates externally from memory or Slack fragments.

## Disclosure content rules

- State facts confirmed by evidence; never speculate on root cause in early notices.
- Include: systems affected, time window, data classes involved, containment status, merchant actions required (e.g. rotate API keys, verify webhook signatures).
- Status page updates use pre-approved templates; deviations require comms lead sign-off.

## After

Every disclosed incident gets a postmortem within 5 business days and a disclosure-timeline audit: did every clock get met? Misses become `SECGOV` findings with named owners.
