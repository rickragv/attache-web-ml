---
id: kb-refund-timelines
title: "Refund timelines and settlement impact"
category: billing
collection: support-kb
tags: [refunds, settlements, timelines]
locale: en
updated: 2026-05-14
owner: payments-support
audience: external
---

# Refund timelines and settlement impact

Refunds initiated via `POST /v1/refunds` are queued instantly but credit timelines depend on the payment method and the issuing bank.

## Standard timelines

| Method | Meridian processing | Customer credit |
|---|---|---|
| UPI | Instant – 30 min | T+0 to T+1 |
| Domestic cards | 1 business day | T+3 to T+5 |
| Netbanking | 1 business day | T+2 to T+4 |
| Wallets | Instant | T+0 |

Instant Refunds (beta) settle UPI and select card refunds in under 60 seconds for an added fee of ₹4 + GST per refund. Enable via Dashboard → Settings → Refunds.

## How refunds affect settlements

- Refunds are debited from your **next settlement batch**, not your bank account. A ₹2,499 refund against today's activity reduces tomorrow's T+1 payout by ₹2,499.
- If the day's refund total exceeds captured volume, the shortfall carries forward and the settlement shows status `HELD_PARTIAL` with error `ERR_SETTLEMENT_HOLD_402`. Top up via Dashboard → Balance to release it.
- Refunds against already-settled payments older than 90 days require balance top-up before processing.

## Tracking

- Webhooks: `refund.created` → `refund.processed` → `refund.settled`. A `refund.failed` event includes the bank's reason code.
- Every processed refund carries an ARN (cards) or UTR (UPI/netbanking), e.g. UTR `AXISN52026051412345678`, visible under Payments → Refunds.

## Escalation

If a refund shows `processed` for more than 7 business days without customer credit, raise a ticket with the refund ID (`rfnd_Kx82mNQpL4`) and the ARN/UTR; our banking desk responds within 24 hours.
