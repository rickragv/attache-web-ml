---
id: api-error-codes
title: "Error code reference"
category: api
collection: api-docs
tags: [errors, reference, http-codes]
locale: en
updated: 2026-06-25
owner: platform-eng
audience: external
---

# Error code reference

Errors return a consistent envelope:

```json
{
  "error": {
    "code": "ERR_ORDER_AMOUNT_MIN_400",
    "message": "Order amount must be at least INR 1.00 (100 paise).",
    "doc_url": "https://docs.meridianpay.in/errors#ERR_ORDER_AMOUNT_MIN_400",
    "request_id": "req_5tYw8nQk2m"
  }
}
```

Always log `request_id` — support triage starts from it.

## Common codes

| HTTP | Code | Meaning / action |
|---|---|---|
| 400 | `ERR_ORDER_AMOUNT_MIN_400` | Minimum order is ₹1.00; UPI mandates minimum ₹1, maximum ₹1,00,000 per debit |
| 400 | `ERR_SURCHARGE_NOT_ALLOWED_400` | Convenience fee on UPI/RuPay debit; remove `convenience_fee` |
| 401 | `ERR_AUTH_INVALID_KEY_401` | Bad or revoked key; check environment prefix |
| 402 | `ERR_SETTLEMENT_HOLD_402` | Payout held (negative balance or dispute); top up balance |
| 402 | `ERR_INTL_3DS_REQUIRED_402` | International card not 3DS-enrolled; customer must use another card |
| 404 | `ERR_RESOURCE_NOT_FOUND_404` | Wrong ID or wrong environment (test ID against live) |
| 409 | `ERR_IDEMPOTENCY_CONFLICT_409` | Same key, different body; generate a fresh key |
| 429 | `ERR_RATE_LIMITED_429` | Throttled; honour `Retry-After` |
| 500 | `ERR_INTERNAL_500` | Retry with same idempotency key, backoff 2 s/8 s/30 s |
| 503 | `ERR_UPSTREAM_BANK_UNAVAILABLE_503` | Issuer/NPCI downtime; check status.meridianpay.in |

## Gateway decline reasons

Payment failures are not HTTP errors: a declined payment returns `200` with `status: failed` and `failure_reason` such as `ISSUER_DECLINED_DO_NOT_HONOR`, `INSUFFICIENT_FUNDS`, or `UPI_COLLECT_EXPIRED`. Map these to customer-facing copy; never show raw codes to end users.
