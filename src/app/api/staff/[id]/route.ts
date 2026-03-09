import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'manager', 'staff']).optional(),
  initials: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/staff/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const role = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const user = await User.findOne({ _id: id, carparkId }).select('-passwordHash').lean();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ staff: user });
}

// PUT /api/staff/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const actorRole = req.headers.get('x-user-role');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (actorRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const updates: Record<string, unknown> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.email) updates.email = parsed.data.email.toLowerCase();
  if (parsed.data.role) updates.role = parsed.data.role;
  if (parsed.data.initials !== undefined) updates.initials = parsed.data.initials;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.password) {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await User.findOneAndUpdate(
    { _id: id, carparkId },
    { $set: updates },
    { new: true }
  )
    .select('-passwordHash')
    .lean();

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ staff: user });
}

// DELETE /api/staff/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  const actorRole = req.headers.get('x-user-role');
  const actorId = req.headers.get('x-user-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (actorRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (id === actorId) {
    return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
  }

  await connectDB();
  await User.findOneAndUpdate({ _id: id, carparkId }, { $set: { active: false } });
  return NextResponse.json({ ok: true });
}
