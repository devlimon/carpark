import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export const runtime = 'nodejs';

const StaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'staff']).default('staff'),
  initials: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/staff
export async function GET(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();
  const staff = await User.find({ carparkId })
    .select('-passwordHash')
    .sort({ name: 1 })
    .lean();
  return NextResponse.json({ staff });
}

// POST /api/staff
export async function POST(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = StaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const exists = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (exists) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await User.create({
    carparkId,
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    role: parsed.data.role,
    initials: parsed.data.initials || parsed.data.name.split(' ')[0],
    active: parsed.data.active ?? true,
  });

  const { passwordHash: _p, ...safeUser } = user.toObject();
  void _p;
  return NextResponse.json({ staff: safeUser }, { status: 201 });
}
