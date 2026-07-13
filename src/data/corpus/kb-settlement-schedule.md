---
id: kb-settlement-schedule
title: "Settlement schedule, cut-offs, and UTR tracking"
category: billing
collection: support-kb
tags: [settlements, payouts, utr, cutoffs]
locale: en
updated: 2025-11-08
owner: payments-support
audience: external
---

# Settlement schedule and cut-offs

Meridian settles captured payments to your registered bank account on a **T+1 working day** cycle by default (T+2 for accounts under 90 days old).

## Daily cut-offs

| Capture window (IST) | Settlement batch | Bank credit by |
|---|---|---|
| 00:00 – 23:59 previous day | Batch A, 09:00 IST | 17:00 same day |
| Same-day (Early Settlement add-on) | Batch B, 15:00 IST | 21:00 same day |

Saturdays, Sundays, and RBI bank holidays are skipped; Friday volume settles Monday. The full holiday calendar is at `GET /v1/settlements/holidays?year=2026`.

## What is deducted from a batch

- Platform fee (e.g. 1.90% + GST on domestic cards, ₹3 flat on UPI P2M above ₹2,000)
- Refunds processed since the previous batch
- Dispute holds and network penalties, if any

A batch with gross ₹4,82,310, fees ₹6,144, and refunds ₹12,499 credits ₹4,63,667.

## Tracking a settlement

- Each batch has a settlement ID (`setl_20260518_A7`) and, once the bank confirms, a UTR such as `ICICN72026051898765432`. Both appear in `settlement.completed` webhooks and `GET /v1/settlements/{id}`.
- Recon file (CSV) is available by 10:30 IST at Dashboard → Settlements → Reports, with one row per payment/refund/adjustment.

## Delays

If a batch shows `initiated` for more than 6 hours past cut-off, check status.meridianpay.in first. For a UTR that your bank cannot trace after 24 hours, raise a ticket with the UTR and account last-4; the banking desk SLA is 1 business day.
