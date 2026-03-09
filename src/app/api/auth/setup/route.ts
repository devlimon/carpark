/**
 * One-time setup endpoint — creates the first carpark + admin user.
 * Only works when no users exist in the database.
 * Hit POST /api/auth/setup with { name, email, password, carparkName }
 */
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Carpark from '@/models/Carpark';

export const runtime = 'nodejs';

const SetupSchema = z.object({
  carparkName: z.string().min(1),
  adminName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  capacity: z.number().optional(),
  dailyRate: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const count = await User.countDocuments();
    if (count > 0) {
      return NextResponse.json({ error: 'Setup already completed' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = SetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { carparkName, adminName, email, password, capacity = 50, dailyRate = 18 } = parsed.data;

    const carpark = await Carpark.create({
      name: carparkName,
      capacity,
      dailyRate,
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      carparkId: carpark._id,
      name: adminName,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
      initials: adminName.split(' ')[0],
    });

    return NextResponse.json({
      ok: true,
      message: 'Setup complete. Please login.',
      carparkId: (carpark._id as unknown as { toString(): string }).toString(),
      userId: (user._id as unknown as { toString(): string }).toString(),
    });
  } catch (err) {
    console.error('Setup error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
