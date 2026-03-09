import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import ParkingSession from '@/models/ParkingSession';
import Customer from '@/models/Customer';
import Carpark from '@/models/Carpark';
import { getNextInvoiceNo } from '@/models/Counter';
import { calcDays, calcAmount } from '@/lib/utils';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export const runtime = 'nodejs';

const SessionSchema = z.object({
  customerId: z.string().optional(),
  customerType: z.string().default('casual'),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  rego: z.string().optional(),
  make: z.string().optional(),
  keyNo: z.number().optional(),
  noKey: z.boolean().optional(),
  dateIn: z.string(),
  timeIn: z.string().optional(),
  returnDate: z.string(),
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
  staffIn: z.string().optional(),
  notes: z.string().optional(),
  invoiceNote: z.string().optional(),
});

// GET /api/parking-sessions?returnDate=&status=&search=&page=&limit=
export async function GET(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const returnDate = searchParams.get('returnDate');
  const status = searchParams.get('status');
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));
  const customerId = searchParams.get('customerId');

  const filter: Record<string, unknown> = { carparkId };

  if (returnDate) {
    const d = parseISO(returnDate);
    filter.returnDate = { $gte: startOfDay(d), $lte: endOfDay(d) };
  }
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  if (search) {
    filter.$or = [
      { customerName: { $regex: search, $options: 'i' } },
      { rego: { $regex: search, $options: 'i' } },
    ];
  }

  const [sessions, total] = await Promise.all([
    ParkingSession.find(filter)
      .sort({ returnDate: 1, returnTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ParkingSession.countDocuments(filter),
  ]);

  return NextResponse.json({ sessions, total, page, limit });
}

// POST /api/parking-sessions
export async function POST(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  const staffName = req.headers.get('x-user-initials') || req.headers.get('x-user-name') || '';
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = SessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  await connectDB();
  const data = parsed.data;

  // Get carpark default rate if not specified
  const carpark = await Carpark.findById(carparkId).lean();
  const defaultRate = carpark?.dailyRate ?? 18;

  // Resolve customer details if customerId given
  let creditPct = data.creditPercent ?? 0;
  let rate = data.dailyRate ?? defaultRate;
  if (data.customerId) {
    const customer = await Customer.findById(data.customerId).lean();
    if (customer) {
      creditPct = data.creditPercent ?? customer.creditPercent ?? 0;
      rate = data.dailyRate ?? (customer.dailyRate > 0 ? customer.dailyRate : defaultRate);
    }
  }

  const dateIn = parseISO(data.dateIn);
  const returnDate = parseISO(data.returnDate);
  const days = calcDays(dateIn, returnDate);
  const gross = days * rate;
  const discount = (gross * creditPct) / 100;
  const net = Math.round((gross - discount) * 100) / 100;

  const invoiceNo = await getNextInvoiceNo(carparkId);

  const session = await ParkingSession.create({
    carparkId,
    invoiceNo,
    keyNo: data.keyNo ?? 0,
    noKey: data.noKey ?? false,
    customerId: data.customerId || null,
    customerType: data.customerType,
    customerName: data.customerName,
    customerPhone: data.customerPhone ?? '',
    rego: data.rego ?? '',
    make: data.make ?? '',
    dateIn,
    timeIn: data.timeIn ?? '',
    returnDate,
    returnTime: data.returnTime ?? '',
    returnFlight: data.returnFlight ?? '',
    stay: days,
    dailyRate: rate,
    creditPercent: creditPct,
    amount: gross,
    creditAmount: discount,
    totalPrice: net,
    paymentStatus: data.paymentStatus ?? 'unpaid',
    paidAmount: data.paidAmount ?? 0,
    payment2Status: data.payment2Status ?? '',
    payment2Amount: data.payment2Amount ?? 0,
    splitPayment: data.splitPayment ?? false,
    pickedUp: data.pickedUp ?? 'car-in-yard',
    doNotMove: data.doNotMove ?? false,
    staffIn: data.staffIn || staffName,
    notes: data.notes ?? '',
    invoiceNote: data.invoiceNote ?? '',
    status: 'active',
  });

  // If on-account customer, update their balance
  if (data.customerId && data.paymentStatus === 'on-account') {
    await Customer.findByIdAndUpdate(data.customerId, { $inc: { balance: net } });
  }

  return NextResponse.json({ session }, { status: 201 });
}
