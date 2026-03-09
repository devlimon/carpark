import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ParkingSession from '@/models/ParkingSession';
import Customer from '@/models/Customer';
import Carpark from '@/models/Carpark';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    carpark,
    activeSessions,
    todaySessions,
    monthSessions,
    overdueSessions,
    totalCustomers,
    onAccountCustomers,
    revenueByDay,
  ] = await Promise.all([
    Carpark.findById(carparkId).lean(),

    // Active sessions (in yard right now)
    ParkingSession.countDocuments({ carparkId, status: 'active' }),

    // Sessions returned today
    ParkingSession.find({
      carparkId,
      returnedAt: { $gte: todayStart, $lte: todayEnd },
      status: 'returned',
    })
      .select('totalPrice paymentStatus')
      .lean(),

    // Sessions returned this month
    ParkingSession.find({
      carparkId,
      returnedAt: { $gte: monthStart, $lte: monthEnd },
      status: 'returned',
    })
      .select('totalPrice paymentStatus')
      .lean(),

    // Overdue (active but return date passed)
    ParkingSession.countDocuments({
      carparkId,
      status: 'active',
      returnDate: { $lt: todayStart },
    }),

    // Total active customers
    Customer.countDocuments({ carparkId, active: true }),

    // On-account customers with balance
    Customer.find({ carparkId, accountType: 'on-account', active: true })
      .select('name balance')
      .lean(),

    // Revenue per day for last 30 days
    ParkingSession.aggregate([
      {
        $match: {
          carparkId: carparkId,
          status: 'returned',
          returnedAt: { $gte: subDays(now, 30), $lte: now },
          paymentStatus: { $nin: ['void', 'unpaid'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$returnedAt' } },
          revenue: { $sum: '$totalPrice' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const todayRevenue = todaySessions
    .filter((s) => s.paymentStatus !== 'void')
    .reduce((sum, s) => sum + (s.totalPrice || 0), 0);

  const monthRevenue = monthSessions
    .filter((s) => s.paymentStatus !== 'void')
    .reduce((sum, s) => sum + (s.totalPrice || 0), 0);

  const pendingOnAccount = onAccountCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);

  const occupancyRate =
    carpark && carpark.capacity > 0
      ? Math.round((activeSessions / carpark.capacity) * 100)
      : 0;

  // Fill in missing days for the chart
  const revenueMap = new Map(revenueByDay.map((r) => [r._id as string, r]));
  const chartData: { date: string; revenue: number; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(now, i), 'yyyy-MM-dd');
    const entry = revenueMap.get(d);
    chartData.push({ date: d, revenue: entry?.revenue ?? 0, count: entry?.count ?? 0 });
  }

  return NextResponse.json({
    activeSessions,
    overdueSessions,
    todayRevenue,
    monthRevenue,
    todayCount: todaySessions.length,
    monthCount: monthSessions.length,
    totalCustomers,
    pendingOnAccount,
    occupancyRate,
    capacity: carpark?.capacity ?? 0,
    chartData,
    onAccountCustomers: onAccountCustomers.map((c) => ({
      id: c._id,
      name: c.name,
      balance: c.balance,
    })),
  });
}
