---
id: api-rate-limits
title: "Rate limits and 429 handling"
category: api
collection: api-docs
tags: [rate-limits, 429, backoff, quotas]
locale: en
updated: 2026-03-17
owner: platform-eng
audience: external
---

# Rate limits and 429 handling

Rate limits are enforced per API key using a token-bucket algorithm with burst headroom.

## Default limits (production)

| Scope | Sustained | Burst |
|---|---|---|
| Read (`GET`) | 100 req/s | 200 |
| Write (`POST`, `PATCH`) | 25 req/s | 50 |
| `POST /v1/payouts` | 10 req/s | 15 |
| Sandbox (all) | 10 req/s | 20 |

Every response includes:

```
X-RateLimit-Limit: 25
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1750483011
```

## When you exceed the limit

You receive `429` with code `ERR_RATE_LIMITED_429` and a `Retry-After` header (seconds, typically 1–5). Handling rules:

- Honour `Retry-After` exactly; do not retry earlier.
- Add full jitter on top: `sleep(retry_after + rand(0, 1000ms))`. Synchronized retries from multiple workers are the most common cause of sustained throttling.
- Reuse the same `Idempotency-Key` on the retry — a 429 means the request was **not** executed.
- Circuit-break after 5 consecutive 429s per worker and drain via a queue instead.

## Avoiding limits in the first place

- Prefer webhooks over polling `GET /v1/payments/{id}`; polling loops account for ~70% of throttled traffic we see.
- Bulk reads: use `GET /v1/payments?count=100&skip=...` (max `count` 100) instead of per-ID fetches.
- Reconciliation jobs should run against the Reports API (`POST /v1/reports`), which is queued and exempt from interactive limits.

## Raising limits

Sustained volume above 60% of your write limit for 7 days makes you eligible for an increase — request via Dashboard → Developers → Limits with your projected TPS; platform-eng reviews within 2 business days.
