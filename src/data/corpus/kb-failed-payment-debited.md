---
id: kb-failed-payment-debited
title: "Payment failed but customer was debited"
category: billing
collection: support-kb
tags: [failures, upi, auto-refund, reconciliation]
locale: en
updated: 2026-03-02
owner: payments-support
audience: external
---

# Payment failed but customer was debited

This is the most common support scenario on UPI and netbanking: the customer's bank debits the account, but the confirmation never reaches Meridian before the 5-minute UPI timeout. The payment lands in status `failed` while money has left the customer's account.

## What happens automatically

1. Meridian marks the payment `failed` and emits `payment.failed` with `failure_reason: "GATEWAY_TIMEOUT_UPI"`.
2. The debited amount enters the bank's auto-reversal queue. NPCI mandates reversal within **T+1**, though most banks complete it in 1–3 hours.
3. If our recon file (received nightly at 02:30 IST) later shows the bank actually captured the payment, we flip the status to `captured` and emit `payment.captured_late`. Reconcile against this event — do not assume `failed` is terminal for 24 hours.

## What to tell your customer

- Money is safe; the bank reverses it automatically within 1 business day. Share the RRN (e.g. `615802431987`) from the payment detail page so they can quote it to their bank.
- If the reversal hasn't arrived in **5 business days**, the customer should raise it with their bank first — Meridian never holds these funds.

## Merchant checklist

- Poll `GET /v1/payments/{payment_id}` before retrying an order; duplicate captures create refund overhead.
- Payment links auto-expire after failure only if `reactivate_on_failure` is false.
- For rates of `failed`-then-`captured_late` above 0.5% of volume, escalate to your account manager; this usually indicates a specific issuer having PSP switch issues.
