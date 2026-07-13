---
id: rb-db-failover-drill
title: "Runbook: database failover drill"
category: operations
collection: runbooks
tags: [postgres, failover, dr, drill]
locale: en
updated: 2025-10-30
owner: sre
audience: internal
---

# Runbook: quarterly database failover drill

**Purpose:** validate that `pg-payments-primary` (Mumbai, ap-south-1a) fails over to the synchronous standby (ap-south-1b) within our RTO of 90 seconds and RPO of zero. Drills run the second Wednesday of each quarter, 03:00–04:00 IST (lowest traffic: ~40 TPS vs 2,200 peak).

## Pre-drill checklist (T-24h)

- Announce in `#eng-payments` and `#inc-payments`; confirm no conflicting change freezes or bank maintenance windows.
- Verify standby replication: `SELECT * FROM pg_stat_replication;` — `sync_state = sync`, lag 0 bytes.
- Confirm PgBouncer configs on `checkout-api`, `settlement-worker`, `webhook-dispatcher` point at the HAProxy VIP, not node IPs (this regressed in the 2025-Q3 drill and cost 11 minutes).
- Snapshot dashboards: *Payments → DB Golden Signals*.

## Execution

1. Drill lead runs `patronictl switchover pg-payments --candidate pg-payments-1b --scheduled now`.
2. Observer records: promotion time, first successful write, error-budget burn. Target: writes resume < 45 s, p99 API latency back to baseline < 90 s.
3. Watch for connection storms — PgBouncer `checkout_rw` pool must not exceed 400 active. If saturated, `RELOAD` with `server_idle_timeout=30`.
4. Payments in flight during the blip land in `pending` and are swept by recon; verify sweep counter increments, not errors.

## Abort criteria

Abort (switch back) if writes are unavailable for > 90 s or 5xx exceeds 2% on checkout. Aborting is a *successful* drill outcome — file findings, don't retry same-night.

## After

Post drill report in `#eng-payments` within 24 h: timings, anomalies, action items with owners. Update this runbook if any command drifted.
