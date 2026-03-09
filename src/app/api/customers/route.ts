import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import Customer from '@/models/Customer';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';

const CustomerSchema = z.object({
  type: z.enum(['casual', 'short-term', 'long-term', 'annual']),
  accountType: z.enum(['cash', 'eftpos', 'on-account']).default('cash'),
  name: z.string().min(1),
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
});

// GET /api/customers?type=&search=&page=&limit=
export async function GET(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  const filter: Record<string, unknown> = { carparkId, active: true };
  if (type) filter.type = type;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { rego1: { $regex: search, $options: 'i' } },
      { rego2: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);

  return NextResponse.json({ customers, total, page, limit });
}

// POST /api/customers
export async function POST(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();

  const data = parsed.data;
  const slug = slugify(data.name) + '-' + Date.now().toString(36);

  const customer = await Customer.create({
    ...data,
    carparkId,
    slug,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
  });

  return NextResponse.json({ customer }, { status: 201 });
}
