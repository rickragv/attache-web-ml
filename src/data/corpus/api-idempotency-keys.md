---
id: api-idempotency-keys
title: "Idempotency keys for safe retries"
category: api
collection: api-docs
tags: [idempotency, retries, reliability]
locale: en
updated: 2025-12-04
owner: platform-eng
audience: external
---

# Idempotency keys for safe retries

Network timeouts leave you unsure whether a mutation landed. Idempotency keys make `POST` requests safely retryable — mandatory practice for `POST /v1/orders`, `POST /v1/refunds`, and `POST /v1/payouts`.

## Usage

```
POST /v1/refunds
Idempotency-Key: 9f3c1b6e-order-8842-refund-1
```

- Any unique string up to 64 chars; UUIDv4 or `{order_id}-{action}-{attempt_group}` both work. Derive it from your business operation, not the HTTP attempt.
- Keys are scoped per account per endpoint and retained for **48 hours**.
- A replayed key returns the **original response**, original status code, and header `X-Meridian-Idempotent-Replay: true` — even if the first attempt returned a 4xx.

## Semantics you must handle

| Situation | Result |
|---|---|
| Same key, same body | Cached original response |
| Same key, different body | `409 ERR_IDEMPOTENCY_CONFLICT_409` |
| Same key, first request still executing | `425 ERR_IDEMPOTENCY_IN_FLIGHT_425` — retry after 2 s |
| Key older than 48 h | Treated as new request |

## Recommended retry loop

Retry timeouts and `5xx` with the **same key**: 3 attempts, backoff 2 s / 8 s / 30 s with jitter. Never retry a `400` — fix the request instead, and use a fresh key once the body changes.

## Notes

- `GET` and `DELETE` are inherently idempotent; the header is ignored there.
- Refund creation without an idempotency key is rejected for amounts ≥ ₹50,000 with `ERR_IDEMPOTENCY_REQUIRED_400` (enforced since API version `2025-11-01`).
