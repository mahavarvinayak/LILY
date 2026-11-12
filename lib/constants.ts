export const ALLOWED_OPERATOR_EMAILS = [
  "vinayakmahavar45@gmail.com",
  "vinayakmahavar95@gmail.com",
  "mahavarvinayak@gmail.com",
] as const;

/**
 * Single source of truth for plan pricing and delivery quotas. The landing
 * page, the request-access brief and the operator cockpit must not drift apart
 * again (they previously quoted 5/15/30 on one screen and 15/30 in admin).
 */
export const SUBSCRIPTION_TIERS = {
  Starter: { price: 14000, quota: 5 },
  Growth: { price: 29000, quota: 15 },
  Scale: { price: 45000, quota: 30 },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

export const SUBSCRIPTION_TIER_NAMES = Object.keys(SUBSCRIPTION_TIERS) as SubscriptionTier[];

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === "string" && value in SUBSCRIPTION_TIERS;
}

