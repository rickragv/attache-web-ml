---
id: rb-checkout-5xx
title: "Runbook: elevated 5xx on checkout"
category: operations
collection: runbooks
tags: [checkout, 5xx, latency, incident]
locale: en
updated: 2026-06-11
owner: sre
audience: internal
---

# Runbook: elevated 5xx on checkout

**Trigger:** `checkout-5xx-rate` alert — 5xx ratio on `api.meridianpay.in/v1/checkout/*` above 0.5% for 3 minutes, or above 2% for 1 minute (auto-SEV-2). Checkout errors are direct revenue loss for merchants; treat every page as urgent.

## Triage tree (first 10 minutes)

1. **Scope:** Grafana *Checkout → Error Breakdown*. Split by upstream: `checkout-api`, `risk-engine`, `token-vault`, bank connectors.
2. **Deploy correlation:** `mrdnctl deploys recent --service checkout-api --window 2h`. If a rollout is within the window, **roll back first, investigate second**: `mrdnctl deploys rollback --service checkout-api --to previous`. Rollback completes in ~4 minutes.
3. **Single bank connector failing** (`ERR_UPSTREAM_BANK_UNAVAILABLE_503` concentrated on one issuer): enable the degradation flag `flags set connector.hdfc_nb.circuit_open=true`. Checkout then hides that netbanking option instead of erroring — success rate impact beats hard failures.
4. **risk-engine timeouts:** it fails open by design below 300 ms budget; if p99 > 800 ms, scale it (`--replicas=24`) and confirm the feature store (Redis cluster `risk-fs-prod`) isn't evicting — memory > 85% means an unplanned key explosion, usually a new model feature.

## Known failure modes

- Token vault HSM session exhaustion after cert rotation → restart `token-vault` pods two at a time, never all at once.
- Postgres connection storm after failover → PgBouncer pool `checkout_rw` must stay ≤ 400; raise `server_idle_timeout` rather than pool size.

## Exit criteria

5xx < 0.1% for 15 minutes and success-rate dashboards back to the 7-day baseline ±2%. Post final status update and schedule postmortem within 48 h.
