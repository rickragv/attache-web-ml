---
id: kb-payment-link-expiry
title: "Payment link expiry, reactivation, and reminders"
category: billing
collection: support-kb
tags: [payment-links, expiry, reminders]
locale: en
updated: 2025-10-19
owner: payments-support
audience: external
---

# Payment link expiry and reactivation

Payment links created via `POST /v1/payment_links` or the Dashboard default to a **30-day expiry**. You can set anything from 15 minutes to 180 days using `expire_by` (Unix epoch, IST-interpreted for the dashboard display).

## Expiry behaviour

- An expired link returns HTTP 410 on the hosted page with the message "This payment link has expired" and emits `payment_link.expired`.
- A payment already in flight when the link expires is honoured: UPI collect requests get the full NPCI 5-minute window even past `expire_by`.
- Links tied to an order inherit the order's `auto_expire` setting; the shorter of the two wins.

## Reactivating

Expired, unpaid links can be reactivated once within 90 days:

```
POST /v1/payment_links/{plink_MZ4tq8Rv2c}/reactivate
{ "expire_by": 1751372200 }
```

Paid, partially paid, or cancelled links cannot be reactivated — create a new link instead. Reactivation preserves the original short URL (`https://mrdn.pay/x/7Hq2wK`).

## Reminders

- Automatic reminders (SMS + email) fire at 24 hours and 3 hours before expiry if `reminder_enable: true`. Each SMS is billed at ₹0.18.
- Reminder sends appear as `payment_link.reminder_sent` events; delivery failures are not retried.

## Common questions

- **Customer paid seconds after expiry?** The payment auto-refunds within T+1 and you receive `payment.auto_refunded`.
- **Bulk expiry updates?** Use the Batch API (`POST /v1/batches` with `type: payment_link_update`), limit 10,000 rows per file.
