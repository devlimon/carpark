import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import ParkingSession from '@/models/ParkingSession';
import Customer from '@/models/Customer';
import Carpark from '@/models/Carpark';
import { calcDays, calcAmount } from '@/lib/utils';
import { parseISO } from 'date-fns';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const UpdateSchema = z.object({
  keyNo: z.number().optional(),
  noKey: z.boolean().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  rego: z.string().optional(),
  make: z.string().optional(),
  dateIn: z.string().optional(),
  timeIn: z.string().optional(),
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),
  returnFlight: z.string().optional(),
  dailyRate: z.number().optional(),
  creditPercent: z.number().optional(),
  paymentStatus: z.enum(['unpaid', 'eftpos', 'on-account', 'to-pay', 'paid', 'void']).optional(),
  paidAmount: z.number().optional(),
  payment2Status: z.string().optional(),
  payment2Amount: z.number().optional(),
  splitPayment: z.boolean().optional(),
  pickedUp: z.enum(['car-in-yard', 'picked-up']).optional(),
  doNotMove: z.boolean().optional(),
  staffOut: z.string().optional(),
  status: z.enum(['active', 'returned', 'overdue', 'void']).optional(),
  notes: z.string().optional(),
  invoiceNote: z.string().optional(),
  receiptEmailed: z.boolean().optional(),
});

// GET /api/parking-sessions/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const session = await ParkingSession.findOne({ _id: id, carparkId }).lean();
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ session });
}

// PUT /api/parking-sessions/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const staffName = req.headers.get('x-user-initials') || req.headers.get('x-user-name') || '';
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const existingSession = await ParkingSession.findOne({ _id: id, carparkId });
  if (!existingSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = parsed.data;
  const updates: Record<string, unknown> = { ...data };

  // Recalculate amount if dates or rate changed
  if (data.dateIn || data.returnDate || data.dailyRate !== undefined || data.creditPercent !== undefined) {
    const dateIn = data.dateIn ? parseISO(data.dateIn) : existingSession.dateIn;
    const returnDate = data.returnDate ? parseISO(data.returnDate) : existingSession.returnDate;
    const rate = data.dailyRate ?? existingSession.dailyRate;
    const creditPct = data.creditPercent ?? existingSession.creditPercent;
    const days = calcDays(dateIn, returnDate);
    const gross = days * rate;
    const discount = (gross * creditPct) / 100;
    const net = Math.round((gross - discount) * 100) / 100;
    updates.stay = days;
    updates.amount = gross;
    updates.creditAmount = discount;
    updates.totalPrice = net;
    if (data.dateIn) updates.dateIn = dateIn;
    if (data.returnDate) updates.returnDate = returnDate;
  }

  // Handle status transition to 'returned'
  if (data.status === 'returned' && existingSession.status !== 'returned') {
    updates.returnedAt = new Date();
    if (!data.staffOut && staffName) updates.staffOut = staffName;
  }

  // Handle on-account balance changes
  const oldPaymentStatus = existingSession.paymentStatus;
  const newPaymentStatus = data.paymentStatus;
  if (newPaymentStatus && newPaymentStatus !== oldPaymentStatus && existingSession.customerId) {
    const newTotal = (updates.totalPrice as number) || existingSession.totalPrice;
    if (oldPaymentStatus === 'on-account' && newPaymentStatus !== 'on-account') {
      // Remove from balance
      await Customer.findByIdAndUpdate(existingSession.customerId, {
        $inc: { balance: -existingSession.totalPrice },
      });
    } else if (newPaymentStatus === 'on-account' && oldPaymentStatus !== 'on-account') {
      // Add to balance
      await Customer.findByIdAndUpdate(existingSession.customerId, {
        $inc: { balance: newTotal },
      });
    }
  }

  const session = await ParkingSession.findOneAndUpdate(
    { _id: id, carparkId },
    { $set: updates },
    { new: true }
  ).lean();

  return NextResponse.json({ session });
}

// DELETE /api/parking-sessions/[id] (void)
export async function DELETE(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const session = await ParkingSession.findOneAndUpdate(
    { _id: id, carparkId },
    { $set: { status: 'void', paymentStatus: 'void' } },
    { new: true }
  );

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove from on-account balance if applicable
  if (session.customerId && session.paymentStatus === 'on-account') {
    await Customer.findByIdAndUpdate(session.customerId, {
      $inc: { balance: -session.totalPrice },
    });
  }

  return NextResponse.json({ ok: true });
}
