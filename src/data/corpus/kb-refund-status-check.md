---
id: kb-refund-status-check
title: "रिफ़ंड स्थिति कैसे जांचें"
category: billing
collection: support-kb
tags: [refunds, status, tracking, hindi]
locale: hi
updated: 2026-06-03
owner: payments-support
audience: external
---

# रिफ़ंड स्थिति कैसे जांचें

ग्राहक का रिफ़ंड कहाँ तक पहुंचा, यह जांचने के तीन तरीके हैं — Dashboard, API, और webhook events।

## Dashboard से

1. Payments → Refunds खोलें।
2. refund ID (जैसे `rfnd_Kx82mNQpL4`), payment ID, या ग्राहक के phone number से खोजें।
3. स्थिति दिखेगी: `created` → `processed` → `settled`, या विफलता पर `failed`।

`processed` का अर्थ है कि Meridian ने बैंक को राशि भेज दी है — कार्ड रिफ़ंड में ARN और UPI रिफ़ंड में UTR (जैसे `HDFCN92026060312345678`) यहीं दिखता है। ग्राहक इसे अपने बैंक को बताकर ट्रेस करवा सकता है।

## API से

```
GET /v1/refunds/rfnd_Kx82mNQpL4
```

Response में `status`, `amount` (paise में — ₹1,499 = 149900), `speed` (`normal` या `instant`), और `acquirer_data.utr` मिलता है।

## अपेक्षित समय-सीमा

| तरीका | ग्राहक के खाते में |
|---|---|
| UPI | T+0 से T+1 |
| कार्ड | T+3 से T+5 कार्यदिवस |
| Netbanking | T+2 से T+4 |

## अगर रिफ़ंड `failed` दिखे

- सबसे आम कारण: ग्राहक का UPI handle या कार्ड बंद हो चुका है (`BENEFICIARY_ACCOUNT_CLOSED`)।
- ऐसे में `refund.failed` webhook आता है और राशि आपके balance में वापस जुड़ जाती है — ग्राहक से वैकल्पिक बैंक विवरण लेकर `POST /v1/refunds` से नया रिफ़ंड बनाएं।

## Escalation

`processed` होने के **7 कार्यदिवस** बाद भी राशि न पहुंचे तो UTR/ARN के साथ support ticket खोलें; banking desk 24 घंटे में जवाब देती है।
