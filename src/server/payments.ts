// Create/read per-user PaymentStatus in KV

import { kv, now } from '@/lib/kv';
import type { PaymentStatus } from '@/lib/types';
import { createCheckout } from '@/lib/payments/provider';

export async function ensurePaymentRecord(userId: string, teamId: string, amountCents: number, dueBy: string) {
  const key = `user:${userId}:payment:${teamId}`;
  const existing = await kv.get<PaymentStatus>(key);
  const base: PaymentStatus = existing ?? {
    userId, teamId, status: 'UNPAID', amountCents, createdAt: now(), updatedAt: now(), dueBy
  };
  if (!existing) await kv.set(key, base);
  return base;
}

export async function createCheckoutFor(userId: string, teamId: string, amountCents: number) {
  const out = await createCheckout({ userId, teamId, amountCents });
  const key = `user:${userId}:payment:${teamId}`;
  const payment = await kv.get<PaymentStatus>(key);
  if (payment) {
    await kv.set(key, { ...payment, status: 'PENDING', provider: 'other', providerInvoiceId: out.providerInvoiceId, updatedAt: now() });
  }
  return out.redirectUrl;
}

export async function markPaidByInvoice(userId: string, teamId: string, providerInvoiceId: string) {
  const key = `user:${userId}:payment:${teamId}`;
  const payment = await kv.get<PaymentStatus>(key);
  if (!payment || payment.providerInvoiceId !== providerInvoiceId) return;
  await kv.set(key, { ...payment, status: 'PAID', updatedAt: now() });
}
