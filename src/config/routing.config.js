/**
 * Query triage routes. Each route becomes an embedding prototype (mean of
 * exemplar vectors). Classification = nearest prototype by cosine.
 *
 * `gate: true` routes stop the query before it reaches the expensive
 * pipeline — the production pattern this demonstrates is credit/cost
 * protection at the client edge.
 *
 * Fully editable at runtime in the Routing view; this file is the seed.
 */
export const routingConfig = {
  /** Below this similarity to every prototype the query is 'unclear'. */
  minConfidence: 0.28,

  routes: [
    {
      id: 'billing',
      label: 'Billing & settlements',
      description: 'Refunds, disputes, settlements, invoices, fees',
      gate: false,
      exemplars: [
        'my refund has not arrived after seven days',
        'why was the customer debited but the payment failed',
        'when will yesterday’s settlement reach our bank account',
        'how do I contest a chargeback raised on order 18443',
        'GST details on the monthly invoice are wrong',
        'रिफ़ंड की स्थिति कैसे देखें',
        'ग्राहक का पैसा कट गया लेकिन payment failed दिख रहा है',
      ],
    },
    {
      id: 'api',
      label: 'API & integration',
      description: 'Keys, webhooks, errors, rate limits, testing',
      gate: false,
      exemplars: [
        'webhook signature verification keeps failing in production',
        'what does error ERR_IDEMPOTENCY_CONFLICT mean',
        'how do I rotate API keys without downtime',
        'getting 429 too many requests from the payments endpoint',
        'how to simulate UPI payment failure in sandbox',
        'UPI AutoPay mandate कैसे सेट करें API से',
      ],
    },
    {
      id: 'operations',
      label: 'Operations & incidents',
      description: 'Runbooks, delays, degradations, on-call',
      gate: false,
      exemplars: [
        'webhook deliveries are delayed by forty minutes',
        'settlement batch did not run this morning',
        'checkout is throwing intermittent 5xx errors',
        'KYC verification queue is growing what is the runbook',
      ],
    },
    {
      id: 'security',
      label: 'Security & compliance',
      description: 'PII, PCI, access, retention, disclosure',
      gate: false,
      exemplars: [
        'how long do we retain cardholder data',
        'who can approve production database access',
        'what is our incident disclosure timeline to the regulator',
        'is PAN data tokenised at rest',
      ],
    },
    {
      id: 'product',
      label: 'Product & releases',
      description: 'Release notes, roadmap, feature availability',
      gate: false,
      exemplars: [
        'when did payment links get WhatsApp sharing',
        'is the new checkout SDK generally available',
        'what changed in the June release',
      ],
    },
    {
      id: 'offtopic',
      label: 'Off-topic',
      description: 'Greetings, chit-chat, spam — gated before the pipeline',
      gate: true,
      exemplars: [
        'hello how are you today',
        'tell me a joke',
        'what is the weather in Mumbai',
        'good morning team',
        'asdf qwerty test test',
      ],
    },
  ],
}
