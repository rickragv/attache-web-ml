---
id: api-payment-lifecycle
title: "Payment status lifecycle"
category: api
collection: api-docs
tags: [payments, lifecycle, states, capture]
locale: en
updated: 2026-01-09
owner: platform-eng
audience: external
---

# Payment status lifecycle

Every payment object moves through a strict state machine. Build your order fulfilment on these states, never on redirect callbacks alone.

```
created → pending → authorized → captured → settled
                 ↘ failed
captured → refund_initiated → refunded (full) / partially_refunded
```

## State meanings

| Status | Meaning | Terminal? |
|---|---|---|
| `created` | Payment object exists; customer not yet acted | No |
| `pending` | Customer redirected / UPI collect sent; bank response awaited | No |
| `authorized` | Card auth hold placed; funds reserved, not moved | No |
| `captured` | Money confirmed to Meridian — safe to fulfil | Effectively yes |
| `failed` | Bank declined or timed out | Mostly (see below) |
| `settled` | Included in a payout batch with UTR | Yes |

## Rules that bite in production

- **`failed` can flip to `captured`** within 24 hours when late bank confirmations arrive in recon (event `payment.captured_late`). Hold inventory decisions accordingly for UPI/netbanking.
- Card auths auto-capture by default. With `capture: "manual"`, capture via `POST /v1/payments/{id}/capture` within **5 days** or the auth voids and status becomes `auth_expired`.
- Partial capture is allowed once, for less than or equal to the authorized amount; the remainder releases immediately.
- `pending` payments older than 30 minutes with no bank reference are swept to `failed` by our janitor job at :15 past each hour.

## Recommended integration

Treat `payment.captured` webhooks as the source of truth, verify amount and currency against your order (₹ amounts arrive in paise: ₹1,499 = `149900`), and reconcile daily via `GET /v1/settlements/{id}/payments`.
