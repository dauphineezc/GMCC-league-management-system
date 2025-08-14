// Provider adapter interface + fake implementation

// Minimal provider abstraction; swap to Stripe later if needed.
export type CheckoutInput = { userId: string; teamId: string; amountCents: number };
export type CheckoutOutput = { redirectUrl: string; providerInvoiceId: string };

export async function createCheckout({ userId, teamId, amountCents }: CheckoutInput): Promise<CheckoutOutput> {
  // Fake provider: create a pretend invoice id and return a hosted URL
  const invoice = `INV-${userId}-${teamId}-${Date.now()}`;
  const base = process.env.PAYMENT_HOSTED_URL || 'https://example-payments.com/checkout';
  const redirectUrl = `${base}?invoice=${encodeURIComponent(invoice)}&amount=${amountCents}`;
  return { redirectUrl, providerInvoiceId: invoice };
}
