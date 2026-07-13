---
id: api-upi-autopay-mandates
title: "UPI ऑटोपे मैंडेट गाइड"
category: api
collection: api-docs
tags: [upi, autopay, mandates, subscriptions, hindi]
locale: hi
updated: 2026-07-02
owner: platform-eng
audience: external
---

# UPI ऑटोपे मैंडेट गाइड

UPI AutoPay से आप ग्राहक की एक बार की स्वीकृति पर recurring debit कर सकते हैं — subscriptions, EMI, और utility भुगतान के लिए। नीचे पूरा प्रवाह दिया गया है।

## मैंडेट बनाना

```
POST /v1/mandates
{
  "customer_id": "cust_R8kWq2mT",
  "method": "upi",
  "max_amount": 149900,
  "frequency": "monthly",
  "start_date": "2026-08-01",
  "end_date": "2027-07-31"
}
```

- `max_amount` paise में है (₹1,499 = 149900)। NPCI सीमा: ₹1,00,000 प्रति debit।
- ग्राहक को उनके UPI app में approval notification जाता है; स्वीकृति पर `mandate.activated` webhook आता है।
- ₹15,000 से अधिक के पहले debit पर additional factor authentication (AFA) अनिवार्य है।

## Debit निष्पादन

- हर debit से **24 घंटे पहले** pre-debit notification ग्राहक को भेजना NPCI नियम है — Meridian यह SMS स्वतः भेजता है (`mandate.notification_sent` event)।
- Debit करें: `POST /v1/mandates/{mdt_5xQw8nTk}/charge` — असफल debit `mandate.charge_failed` देता है; उसी billing cycle में अधिकतम 3 retry की अनुमति है।

## Pause, resume और cancel

| क्रिया | Endpoint | प्रभाव |
|---|---|---|
| Pause | `POST /v1/mandates/{id}/pause` | debit रुकते हैं; ग्राहक भी अपने UPI app से pause कर सकता है (`mandate.paused`) |
| Resume | `POST /v1/mandates/{id}/resume` | अगले cycle से debit फिर शुरू |
| Cancel | `DELETE /v1/mandates/{id}` | स्थायी; नया मैंडेट बनाना होगा |

ध्यान दें: ग्राहक द्वारा pause किया गया मैंडेट merchant API से resume **नहीं** हो सकता — `ERR_MANDATE_CUSTOMER_PAUSED_403` मिलेगा। ऐसे में ग्राहक को अपने UPI app से resume करने के लिए कहें।
