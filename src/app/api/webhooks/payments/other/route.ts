// Provider webhook stub

import { NextRequest, NextResponse } from 'next/server';
import { markPaidByInvoice } from '@/server/payments';

// Example webhook payload: { providerInvoiceId, status: "PAID", userId, teamId }
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    if (body.status === 'PAID') {
      await markPaidByInvoice(body.userId, body.teamId, body.providerInvoiceId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
