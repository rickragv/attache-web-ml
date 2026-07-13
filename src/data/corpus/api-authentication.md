---
id: api-authentication
title: "Authentication, API keys, and sandbox mode"
category: api
collection: api-docs
tags: [authentication, api-keys, sandbox, security]
locale: en
updated: 2026-04-28
owner: platform-eng
audience: external
---

# Authentication, API keys, and sandbox mode

All requests to `https://api.meridianpay.in` authenticate with HTTP Basic Auth: the key ID as username, secret as password.

```
curl https://api.meridianpay.in/v1/orders \
  -u mk_live_Hq7wN2xRt5vKm9Yz:msk_live_c3fT8...
```

## Key types

| Prefix | Environment | Notes |
|---|---|---|
| `mk_live_` / `msk_live_` | Production | Secret shown once at generation |
| `mk_test_` / `msk_test_` | Sandbox (`https://api.sandbox.meridianpay.in`) | No real money moves |

Sandbox mirrors production APIs and webhooks. Simulate outcomes with test instruments: card `4111 1111 1111 1111` always captures, `4012 0010 3714 1112` always declines with `ISSUER_DECLINED_DO_NOT_HONOR`, and VPA `success@mrdnsandbox` auto-approves UPI collect in 10 seconds.

## Rules and rotation

- Requests with a live key against sandbox (or vice versa) fail with `ERR_ENV_KEY_MISMATCH_401`.
- Missing or malformed credentials return `401` with code `ERR_AUTH_INVALID_KEY_401`; a valid key lacking a product scope returns `403 ERR_AUTH_SCOPE_403`.
- Keys support scoping (e.g. `payments:read`, `refunds:write`) since API version `2026-02-01`. Unscoped legacy keys are deprecated and stop working on 2026-12-31.
- Rotate via Dashboard → Developers → API Keys → Roll Key. The old secret stays valid for a configurable grace window (default 24 hours, max 7 days).

## Never do this

- Do not call the API from browsers or mobile apps; secrets belong server-side only. Use Checkout tokens (`ctok_...`, 15-minute TTL) client-side.
- Do not log the Basic Auth header; Meridian support will never ask for your secret key.
