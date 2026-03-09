import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import Customer from '@/models/Customer';

export const runtime = 'nodejs';

const UpdateSchema = z.object({
  type: z.enum(['casual', 'short-term', 'long-term', 'annual']).optional(),
  accountType: z.enum(['cash', 'eftpos', 'on-account']).optional(),
  name: z.string().min(1).optional(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.preprocess(v => v || undefined, z.string().email().optional()),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  rego1: z.string().nullish(),
  rego2: z.string().nullish(),
  make: z.string().nullish(),
  ltNumber: z.string().nullish(),
  dailyRate: z.number().optional(),
  creditPercent: z.number().min(0).max(100).optional(),
  expiryDate: z.string().nullish(),
  maxVehicles: z.number().optional(),
  notes: z.string().nullish(),
  active: z.boolean().optional(),
  balance: z.number().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const customer = await Customer.findOne({ _id: id, carparkId }).lean();
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ customer });
}

// PUT /api/customers/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expiryDate) {
    updates.expiryDate = new Date(parsed.data.expiryDate);
  }

  const customer = await Customer.findOneAndUpdate(
    { _id: id, carparkId },
    { $set: updates },
    { new: true }
  ).lean();

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ customer });
}

// DELETE /api/customers/[id] (soft delete)
export async function DELETE(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  await Customer.findOneAndUpdate({ _id: id, carparkId }, { $set: { active: false } });
  return NextResponse.json({ ok: true });
}
