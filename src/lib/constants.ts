export const DEPARTMENTS = ["customer_care", "billing", "engineering"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const INTENTS = [
  "HOW_TO",
  "ERROR",
  "BILLING_QUESTION",
  "BUG_REPORT",
  "OTHER",
  "REFUND",
  "CANCELLATION",
  "PERSONAL_DATA",
  "LEGAL",
  "SECURITY",
  "ACCOUNT_SPECIFIC",
  "HUMAN_REQUEST",
] as const;

// The AI never answers these. The policy gate sends them to a human.
export const RISKY_INTENTS: readonly string[] = [
  "REFUND",
  "CANCELLATION",
  "PERSONAL_DATA",
  "LEGAL",
  "SECURITY",
  "ACCOUNT_SPECIFIC",
  "HUMAN_REQUEST",
];
