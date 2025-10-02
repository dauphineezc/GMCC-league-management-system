// Provider adapter interface + fake implementation

import type { CheckoutInput, CheckoutOutput } from "@/types/domain";

// Minimal provider abstraction; swap to Stripe later if needed.

export async function createCheckout({ userId, teamId, amountCents }: CheckoutInput): Promise<CheckoutOutput> {
  // Fake provider: create a pretend invoice id and return a hosted URL
  const invoice = `INV-${userId}-${teamId}-${Date.now()}`;
  const base = process.env.PAYMENT_HOSTED_URL || 'https://example-payments.com/checkout';
  const redirectUrl = `${base}?invoice=${encodeURIComponent(invoice)}&amount=${amountCents}`;
  return { redirectUrl, providerInvoiceId: invoice };
}
