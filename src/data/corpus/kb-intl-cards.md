---
id: kb-intl-cards
title: "International cards: acceptance, pricing, and failures"
category: billing
collection: support-kb
tags: [international, cards, currency, mdr]
locale: en
updated: 2026-04-07
owner: payments-support
audience: external
---

# International cards: acceptance, pricing, and failures

International card acceptance is disabled by default. Enable it under Settings → Payment Methods → International, which triggers an additional KYC review (2–3 business days) covering your export/import profile and website compliance checklist.

## Pricing

| Component | Rate |
|---|---|
| International MDR | 3.20% + GST |
| Currency markup (non-INR presentment) | 1.5% |
| Chargeback fee (international) | ₹1,200 + GST |

Settlement is always in INR at the network rate on capture date. A $120.00 Visa charge at ₹86.40/USD settles ₹10,368 gross before fees.

## What your customers see

- Cards from 140+ countries on Visa, Mastercard, and Amex; Amex requires a separate onboarding addendum.
- 3-D Secure is enforced for all international transactions. Non-3DS-enrolled cards fail with `ERR_INTL_3DS_REQUIRED_402`.
- Dynamic Currency Conversion (DCC) is available on request for USD, EUR, GBP, AED, and SGD presentment.

## Why international success rates are lower

Expect 65–75% success versus ~85% domestic. Top decline reasons in `payment.failed` payloads:

- `ISSUER_DECLINED_DO_NOT_HONOR` — issuer risk rules; nothing to fix on your side
- `ERR_INTL_BLOCKED_BY_RBI_LRS` — customer's bank blocks merchant category under LRS
- `AVS_MISMATCH` — enable `billing_address_collection: true` in Checkout v3.2+ to reduce these by ~18%

## Compliance notes

Purpose codes (e.g. `P0802` software services) are auto-filed with our AD bank for FIRA generation. Download FIRAs monthly under Settlements → International; missing FIRAs older than 6 months require a ₹500 retrieval request.
