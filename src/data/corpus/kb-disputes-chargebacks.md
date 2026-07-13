---
id: kb-disputes-chargebacks
title: "Disputes and chargebacks: flow, evidence, and deadlines"
category: billing
collection: support-kb
tags: [disputes, chargebacks, evidence, deadlines]
locale: en
updated: 2026-06-20
owner: payments-support
audience: external
---

# Disputes and chargebacks

A dispute is raised when a cardholder or UPI user contests a charge with their bank. Meridian notifies you via the `dispute.created` webhook and email to your registered dispute contact.

## Lifecycle

```
dispute.created → evidence_required → under_review → won | lost
```

- **Evidence window:** 7 calendar days from `dispute.created` for cards, 5 days for UPI (NPCI UDIR). The exact deadline is in the `respond_by` field — missing it is an automatic loss.
- On `dispute.created`, the disputed amount plus a ₹500 + GST dispute fee is held from your next settlement (`ERR_SETTLEMENT_HOLD_402` appears on the affected batch). If you win, both are released in the following payout; the fee is retained on a loss.

## Submitting evidence

Upload via Dashboard → Disputes or `POST /v1/disputes/{dispute_id}/evidence` (multipart, max 10 MB total, PDF/JPG/PNG). Strong evidence includes:

- Delivery proof with AWB number and signed POD
- Customer communication showing service usage after the charge date
- Refund proof (refund ID + ARN) if you already refunded — this converts most cases to instant wins

## Rates that matter

Keep your dispute rate under **0.35%** of transaction count. Above 0.65% for two consecutive months triggers a network monitoring program with a ₹25,000 monthly penalty passed through from the card networks.

## Escalation

Second-presentment (pre-arbitration) decisions must be requested within 3 days of a loss via disputes@meridianpay.in with the dispute ID (`dsp_9hWq3kTf`).
