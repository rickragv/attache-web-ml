---
id: api-webhook-signatures
title: "Webhooks and signature verification"
category: api
collection: api-docs
tags: [webhooks, hmac, signatures, events]
locale: en
updated: 2026-05-30
owner: platform-eng
audience: external
---

# Webhooks and signature verification

Meridian delivers events as HTTP POSTs to endpoints you register under Developers → Webhooks (up to 10 per account, each with its own event subscription list).

## Verifying signatures

Every delivery carries two headers:

```
X-Meridian-Signature: t=1750482932,v1=5f8a2c94e1b7d3...
X-Meridian-Event-Id: evt_8kTq2wNv6xLp
```

Compute `HMAC-SHA256(webhook_secret, "{t}.{raw_body}")` and constant-time-compare with `v1`. Reject if the computed value differs **or** `t` is older than 300 seconds (replay protection). The `whsec_...` secret is per-endpoint; rolling it keeps the old secret valid for 24 hours, during which both signatures appear as `v1` and `v0`.

Verify against the raw request bytes — parsing and re-serialising JSON will change key order and break the HMAC.

## Delivery and retries

- Respond `2xx` within **10 seconds**; anything else counts as failure.
- Retries: exponential backoff at 1 min, 5 min, 30 min, 2 h, 6 h, then hourly to 24 h (9 attempts total). After that, the event is marked `exhausted` and the endpoint is auto-disabled after 3 consecutive days of 100% failure.
- Events can arrive out of order and, rarely, more than once. Deduplicate on `X-Meridian-Event-Id` and trust the `created_at` inside the payload, not arrival order.

## Common events

`payment.captured`, `payment.failed`, `refund.processed`, `settlement.completed`, `dispute.created`, `mandate.paused`, `payment_link.expired`.

Missed events are recoverable for 30 days via `GET /v1/events?type=payment.captured&after=evt_...` — poll this as your reconciliation backstop, never as your primary integration.
