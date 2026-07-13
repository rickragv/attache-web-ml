---
id: kb-kyc-document-upload
title: "KYC दस्तावेज़ अपलोड गाइड"
category: billing
collection: support-kb
tags: [kyc, onboarding, documents, hindi]
locale: hi
updated: 2026-01-22
owner: payments-support
audience: external
---

# KYC दस्तावेज़ अपलोड गाइड

Meridian पर लाइव पेमेंट स्वीकार करने से पहले KYC पूरा करना अनिवार्य है। Dashboard → Account → KYC सेक्शन में जाकर दस्तावेज़ अपलोड करें। पूरी प्रक्रिया आम तौर पर **2–3 कार्यदिवस** में पूरी होती है।

## आवश्यक दस्तावेज़

| व्यवसाय प्रकार | दस्तावेज़ |
|---|---|
| Proprietorship | PAN कार्ड, Aadhaar, GST प्रमाणपत्र (यदि लागू), बैंक स्टेटमेंट/cancelled cheque |
| Private Limited | कंपनी PAN, CIN प्रमाणपत्र, बोर्ड resolution, directors का KYC |
| Partnership/LLP | Partnership deed, फर्म का PAN, अधिकृत partner का Aadhaar |

## अपलोड करते समय ध्यान रखें

- फ़ाइल फॉर्मेट: PDF, JPG या PNG — अधिकतम **5 MB** प्रति फ़ाइल।
- दस्तावेज़ की चारों कोनों सहित साफ़ फोटो हो; धुंधली फ़ाइलें `KYC_DOC_UNREADABLE` कारण से अस्वीकार होती हैं।
- बैंक खाते का नाम PAN के नाम से मेल खाना चाहिए, वरना verification `KYC_NAME_MISMATCH` पर अटक जाता है।
- Aadhaar अपलोड करते समय पहले 8 अंक mask करना स्वीकार्य है।

## स्थिति कैसे देखें

- Dashboard में स्थिति दिखती है: `pending` → `under_review` → `verified` या `needs_resubmission`।
- API से: `GET /v1/account/kyc_status` — verified होने पर `kyc.verified` webhook भी आता है।
- अस्वीकृति पर email में सटीक कारण और दोबारा अपलोड करने का लिंक मिलता है। resubmission की समीक्षा **1 कार्यदिवस** में होती है।

## सहायता

3 कार्यदिवस से अधिक `under_review` में अटके आवेदन के लिए kyc@meridianpay.in पर merchant ID (`acc_Ht5wQm9Lz`) के साथ लिखें। हमारी टीम 24 घंटे में जवाब देती है।
