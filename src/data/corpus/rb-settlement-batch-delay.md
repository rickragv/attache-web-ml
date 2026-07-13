---
id: rb-settlement-batch-delay
title: "Runbook: settlement batch delay"
category: operations
collection: runbooks
tags: [settlements, batch, banking, incident]
locale: en
updated: 2025-12-18
owner: sre
audience: internal
---

# Runbook: settlement batch delay

**Trigger:** Batch A (09:00 IST) or Batch B (15:00 IST) not in state `bank_acknowledged` within 45 minutes of cut-off. Alert: `settlement-batch-stalled` → pages payments-oncall.

## Diagnosis order

1. **Batch state:** `mrdnctl settlements status --batch setl_20260518_A7`. States: `computing → files_generated → uploaded_to_bank → bank_acknowledged → utr_received`.
2. **Stuck in `computing`:** almost always the recon DB. Check `pg-recon-primary` replication lag and the `fee_compute` job queue depth (Grafana: *Settlements → Compute*). Long-running fee recalcs can be killed and requeued safely — the job is idempotent.
3. **Stuck in `uploaded_to_bank`:** SFTP acknowledgement missing from the sponsor bank (ICICI H2H). Check `sftp-bridge` pod logs for `AUTH_EXPIRED` — the bank rotates our key quarterly and this has bitten us twice. Banking-ops holds the escalation matrix; call the bank's H2H desk after 30 minutes of silence.
4. **Partial file rejection:** bank NACKs individual rows (bad IFSC, frozen account). These rows requeue automatically to the next batch as `carried_forward`; no action needed unless >1% of rows.

## Merchant impact rules

- Delay > 2 hours: status page update ("Payouts for today are delayed; funds are safe").
- Delay past 17:00 IST for Batch A: trigger the pre-approved apology email template `SETL-DELAY-01` from Iterable.
- Never manually mark a batch `utr_received` — recon depends on the bank file.

Declare recovery on `utr_received` for all sub-batches. SEV-2 postmortem if credit slipped past the banking day.
