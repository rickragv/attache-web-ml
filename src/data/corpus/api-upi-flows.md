---
id: api-upi-flows
title: "UPI intent vs collect flows"
category: api
collection: api-docs
tags: [upi, intent, collect, mobile]
locale: en
updated: 2025-09-21
owner: platform-eng
audience: external
---

# UPI intent vs collect flows

Meridian supports both UPI flows. Choose based on the customer's device context — success rates differ by nearly 20 points.

## Intent flow (recommended on mobile)

The customer taps a UPI app chip; your app opens a deep link like `upi://pay?pa=merchant@mrdnaxis&am=1499.00&tr=MRDN8842713...` and the customer approves in their own app.

```
POST /v1/payments
{ "order_id": "ord_Wq82mKt4Lp", "method": "upi", "upi": { "flow": "intent" } }
```

The response contains `intent_url` plus app-specific links (`gpay`, `phonepe`, `paytm`, `bhim`). Success rate averages **91%** because there is no VPA typing.

## Collect flow

You pass the customer's VPA; the PSP pushes an approval request to their app.

```
{ "method": "upi", "upi": { "flow": "collect", "vpa": "ananya.s@okhdfcbank" } }
```

- NPCI expiry: **5 minutes** (configurable down to 2 via `expiry_minutes`). Expired requests fail with `UPI_COLLECT_EXPIRED`.
- Validate the VPA first with `POST /v1/upi/validate_vpa` — it returns the account holder name and costs nothing; invalid handles are the top collect failure.
- Success rate averages ~72%; use collect mainly on desktop where intent is impossible, or show a QR (`upi.flow: "qr"`) instead.

## Status handling for both flows

Poll `GET /v1/payments/{id}` no more than once per 3 seconds, or rely on `payment.captured` / `payment.failed` webhooks. Keep the checkout page alive for the full 5-minute window — abandoning early strands approvals that then auto-refund at T+1.
