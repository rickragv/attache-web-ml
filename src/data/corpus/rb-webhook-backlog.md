---
id: rb-webhook-backlog
title: "Runbook: webhook delivery backlog"
category: operations
collection: runbooks
tags: [webhooks, incident, kafka, backlog]
locale: en
updated: 2026-02-26
owner: sre
audience: internal
---

# Runbook: webhook delivery backlog

**Trigger:** PagerDuty alert `webhook-dispatch-lag-high` — fires when the `webhook-outbound` Kafka consumer group lag exceeds 50,000 messages for 5 minutes, or p95 delivery age exceeds 120 s (Grafana: *Webhooks → Dispatch Health*).

## Impact assessment (first 5 minutes)

1. Check lag trend: `kafka-consumer-groups --describe --group webhook-dispatch-prod`. Rising lag with flat throughput means dispatcher problem; rising throughput means traffic surge.
2. Identify concentration: dashboard panel *Failures by endpoint*. One merchant endpoint timing out at 10 s can consume 40% of worker capacity.
3. Post in `#inc-payments` and open an incident (SEV-3 if lag < 500k, SEV-2 above, or if any lag on the `dispatch-priority` topic carrying `payment.captured`).

## Mitigation

- **Slow merchant endpoint:** quarantine it — `mrdnctl webhooks quarantine --account acc_Ht5wQm9Lz --reason slow_endpoint`. Quarantined events park in the retry tier and do not block others.
- **Traffic surge:** scale dispatchers `kubectl -n webhooks scale deploy webhook-dispatcher --replicas=48` (default 16, ceiling 64 — above that we exhaust the egress NAT connection pool).
- **Poison messages** (crash loop in logs): skip with `mrdnctl webhooks dlq --topic webhook-outbound --offset <n>` and file a follow-up.

## Recovery and comms

Backlog drains newest-first for priority events, oldest-first otherwise. At >30 min of delay, ask comms to update status.meridianpay.in ("Delayed webhook delivery; payments unaffected"). Declare recovery when lag < 1,000 and p95 age < 10 s for 15 minutes. Postmortem required for SEV-2 within 5 business days.
