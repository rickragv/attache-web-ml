---
id: rb-kyc-queue-spike
title: "Runbook: KYC verification queue spike"
category: operations
collection: runbooks
tags: [kyc, onboarding, queue, ops]
locale: en
updated: 2026-04-15
owner: sre
audience: internal
---

# Runbook: KYC verification queue spike

**Trigger:** `kyc-queue-depth` alert — pending verifications above 4,000 (normal daily peak ~1,200) or median time-in-queue above 36 hours against the 48-hour merchant SLA. Fires to onboarding-oncall; loop in sre if automation is implicated.

## Identify the cause

1. **Inflow spike vs throughput drop:** Grafana *Onboarding → KYC Funnel*. Marketing campaigns and fiscal-year-start (April) reliably double signups; check `#growth-launches` before assuming breakage.
2. **Auto-verification degraded:** ~78% of cases normally clear automatically via the PAN (NSDL), Aadhaar (DigiLocker), and bank penny-drop APIs. Check the *Vendor Health* panel:
   - NSDL PAN API error rate > 5% → open ticket with vendor, flip `flags set kyc.pan_check.fallback_manual=true` so cases route to the manual pool instead of retry-looping.
   - Penny-drop provider timeout → switch provider: `flags set kyc.penny_drop.provider=cashray_backup` (dual-vendor since 2025-10).
3. **Manual review pool understaffed:** `mrdnctl kyc queue-stats --pool manual`. Each reviewer clears ~110 cases/day; ops-manager can borrow trained staff from the disputes pool via the cross-skill roster.

## Mitigation levers (in order)

- Re-run stuck automation: `mrdnctl kyc requeue --status auto_pending --older-than 6h` (idempotent).
- Enable priority lanes: merchants with projected GMV > ₹10L/month jump the queue (`kyc.priority_lane=true`).
- If SLA breach is unavoidable, comms sends template `KYC-DELAY-02`; never promise a specific date, only "within X business days".

## Exit criteria

Queue < 2,000, median wait < 24 h, auto-verification rate back above 70%. File a capacity review if this is the second spike in a quarter.
