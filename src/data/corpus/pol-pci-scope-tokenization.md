---
id: pol-pci-scope-tokenization
title: "PCI-DSS scope and tokenization standard"
category: security
collection: policies
tags: [pci-dss, tokenization, cde, cards]
locale: en
updated: 2025-11-25
owner: security
audience: internal
---

# PCI-DSS scope and tokenization standard

**Version 2.4. Meridian is assessed annually against PCI-DSS 4.0 as a Level 1 service provider; last ROC issued 2025-09-30 by our QSA.**

## Cardholder Data Environment (CDE)

The CDE is deliberately minimal — three systems only:

1. `token-vault` — the only service that ever sees a PAN. Runs in a dedicated VPC (`vpc-cde-prod`) with HSM-backed encryption (AWS CloudHSM, FIPS 140-2 Level 3).
2. `checkout-fields` — the hosted iframe capturing card input in the customer browser; PANs travel directly to `token-vault`, never through merchant or general Meridian infrastructure.
3. Network switch connectors that forward network tokens to acquirers.

Everything else operates on tokens (`tok_card_9wKq3mTv...`) and is **out of scope**. Any design that routes a PAN through a non-CDE service is rejected at architecture review — no exceptions.

## Tokenization rules

- Card-on-file uses network tokens (Visa VTS / Mastercard MDES) per the RBI tokenization mandate; Meridian-issued vault tokens are an internal fallback for single-use flows only.
- Tokens are merchant-scoped: `tok_card_...` issued to one merchant cannot be charged by another. Cross-merchant charging attempts raise `ERR_TOKEN_SCOPE_403` and a security alert.
- Detokenization is available to exactly two service roles, both requiring dual-key HSM sessions and producing immutable audit events.

## People and process controls

- CDE access requires PCI training (annual), a background check, and time-boxed access via the PAM tool (max 4-hour sessions, recorded).
- Quarterly ASV scans, annual penetration test, and segmentation tests every six months. Findings above CVSS 7.0 must remediate within 30 days.
