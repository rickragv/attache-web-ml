---
id: kb-invoice-gst
title: "Invoices, GST, and convenience fee taxation"
category: billing
collection: support-kb
tags: [invoices, gst, convenience-fees, tax]
locale: en
updated: 2026-02-11
owner: payments-support
audience: external
---

# Invoices, GST, and convenience fee taxation

Meridian issues a consolidated tax invoice for platform fees on the 3rd of every month, covering the previous calendar month. Download from Dashboard → Billing → Tax Invoices or via `GET /v1/invoices?month=2026-01`.

## What the invoice contains

- Platform fees (MDR) itemised by payment method — e.g. domestic cards at 1.90%, UPI P2M flat ₹3 above ₹2,000
- 18% GST on all fees, split CGST 9% + SGST 9% (Karnataka-registered merchants) or IGST 18% (all other states)
- Dispute fees, Instant Refund fees, and Early Settlement charges as separate line items
- Our GSTIN `29AAJCM4521R1Z6` and SAC code `997158`

Update your GSTIN under Settings → Business before month-end; invoices are not reissued retroactively, and a missing GSTIN forfeits your input tax credit for that month.

## Convenience fees you charge customers

If you pass fees to customers using `convenience_fee` in `POST /v1/orders`, note:

- The fee is **your revenue**; Meridian settles it to you and you are liable for GST on it under your own GSTIN.
- RBI prohibits convenience fees on UPI and RuPay debit for merchants; orders with `convenience_fee > 0` on those methods are rejected with `ERR_SURCHARGE_NOT_ALLOWED_400`.
- Card and netbanking surcharges must be disclosed pre-payment; the hosted checkout shows the breakup automatically.

## TDS reconciliation

Merchants deducting 194H TDS on our fees should upload Form 16A quarterly via Billing → TDS Certificates; credit is applied to the next invoice within 5 business days.
