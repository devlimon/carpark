/**
 * Public payment page route — GET /pay/[customerSlug]
 * Shows customer's outstanding balance and payment details.
 * No auth required (public-facing URL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import Customer from '@/models/Customer';
import Payment from '@/models/Payment';
import ParkingSession from '@/models/ParkingSession';

export const runtime = 'nodejs';

type Params = { params: Promise<{ customerSlug: string }> };

// GET /api/pay/[customerSlug] — public balance info
export async function GET(req: NextRequest, { params }: Params) {
  const { customerSlug } = await params;
  await connectDB();

  const customer = await Customer.findOne({
    slug: customerSlug,
    accountType: 'on-account',
    active: true,
  })
    .select('name company balance email carparkId')
    .lean();

  if (!customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const unpaidSessions = await ParkingSession.find({
    customerId: customer._id,
    paymentStatus: 'on-account',
    status: { $ne: 'void' },
  })
    .sort({ returnDate: -1 })
    .limit(20)
    .select('invoiceNo dateIn returnDate totalPrice rego stay')
    .lean();

  return NextResponse.json({
    customer: {
      name: customer.name,
      company: customer.company,
      balance: customer.balance,
    },
    unpaidSessions,
  });
}

// POST /api/pay/[customerSlug] — record a payment against the account
const PaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['cash', 'eftpos', 'bank-transfer', 'credit-card', 'other']),
  reference: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { customerSlug } = await params;
  const body = await req.json();
  const parsed = PaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const customer = await Customer.findOne({ slug: customerSlug, active: true });
  if (!customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await Payment.create({
    carparkId: customer.carparkId,
    customerId: customer._id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference ?? '',
    paidAt: new Date(),
  });

  // Reduce customer balance
  await Customer.findByIdAndUpdate(customer._id, {
    $inc: { balance: -parsed.data.amount },
  });

  return NextResponse.json({ ok: true, newBalance: customer.balance - parsed.data.amount });
}
