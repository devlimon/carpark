import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ParkingSession from '@/models/ParkingSession';
import Customer from '@/models/Customer';
import Payment from '@/models/Payment';
import { buildCsv, fmtDate } from '@/lib/utils';
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from 'date-fns';

export const runtime = 'nodejs';

type Params = { params: Promise<{ reportKey: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { reportKey } = await params;
  const { searchParams } = new URL(req.url);
  const exportFormat = searchParams.get('export'); // 'csv' | null
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const period = searchParams.get('period'); // "2026-03"

  let from: Date, to: Date;
  if (period) {
    const [year, month] = period.split('-').map(Number);
    from = startOfMonth(new Date(year, month - 1, 1));
    to = endOfMonth(from);
  } else if (fromStr && toStr) {
    from = parseISO(fromStr);
    to = parseISO(toStr);
  } else {
    // Default: current month
    from = startOfMonth(new Date());
    to = endOfMonth(new Date());
  }

  let data: unknown;
  let csvHeaders: string[] = [];
  let csvRows: (string | number | null | undefined)[][] = [];

  switch (reportKey) {
    case 'revenue': {
      const sessions = await ParkingSession.find({
        carparkId,
        returnedAt: { $gte: from, $lte: to },
        status: 'returned',
        paymentStatus: { $nin: ['void', 'unpaid'] },
      })
        .sort({ returnedAt: 1 })
        .lean();

      const total = sessions.reduce((s, x) => s + x.totalPrice, 0);
      const byMethod = sessions.reduce(
        (acc, s) => {
          const k = s.paymentStatus || 'unknown';
          acc[k] = (acc[k] || 0) + s.totalPrice;
          return acc;
        },
        {} as Record<string, number>
      );

      data = { sessions, total, byMethod };
      csvHeaders = ['Invoice#', 'Date', 'Customer', 'Rego', 'Days', 'Rate', 'Amount', 'Payment'];
      csvRows = sessions.map((s) => [
        s.invoiceNo,
        fmtDate(s.returnedAt || s.returnDate),
        s.customerName,
        s.rego,
        s.stay,
        s.dailyRate,
        s.totalPrice,
        s.paymentStatus,
      ]);
      break;
    }

    case 'occupancy': {
      // Daily occupancy for the period
      const sessions = await ParkingSession.find({
        carparkId,
        status: { $in: ['active', 'returned'] },
        dateIn: { $lte: to },
        returnDate: { $gte: from },
      }).lean();

      // Build day-by-day occupancy counts
      const days: { date: string; count: number }[] = [];
      const cursor = new Date(from);
      while (cursor <= to) {
        const dateStr = format(cursor, 'yyyy-MM-dd');
        const count = sessions.filter((s) => {
          return s.dateIn <= cursor && s.returnDate >= cursor;
        }).length;
        days.push({ date: dateStr, count });
        cursor.setDate(cursor.getDate() + 1);
      }

      data = { days };
      csvHeaders = ['Date', 'Cars In Yard'];
      csvRows = days.map((d) => [d.date, d.count]);
      break;
    }

    case 'customers': {
      const customers = await Customer.find({ carparkId, active: true })
        .sort({ name: 1 })
        .lean();
      const sessionCounts = await ParkingSession.aggregate([
        {
          $match: {
            carparkId,
            customerId: { $exists: true, $ne: null },
            status: { $ne: 'void' },
            returnedAt: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: '$customerId', count: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } },
      ]);
      const countMap = new Map(sessionCounts.map((x) => [x._id.toString(), x]));
      const rows = customers.map((c) => {
        const stats = countMap.get(c._id.toString());
        return { ...c, periodSessions: stats?.count ?? 0, periodRevenue: stats?.revenue ?? 0 };
      });

      data = { customers: rows };
      csvHeaders = ['Name', 'Type', 'Account', 'Phone', 'Rego', 'Sessions', 'Revenue', 'Balance'];
      csvRows = rows.map((c) => [
        c.name,
        c.type,
        c.accountType,
        c.phone,
        c.rego1,
        c.periodSessions,
        c.periodRevenue,
        c.balance,
      ]);
      break;
    }

    case 'on-account': {
      const customers = await Customer.find({
        carparkId,
        accountType: 'on-account',
        active: true,
      }).lean();

      const details = await Promise.all(
        customers.map(async (c) => {
          const sessions = await ParkingSession.find({
            carparkId,
            customerId: c._id,
            paymentStatus: 'on-account',
            status: { $ne: 'void' },
            returnedAt: { $gte: from, $lte: to },
          }).lean();
          const payments = await Payment.find({
            carparkId,
            customerId: c._id,
            paidAt: { $gte: from, $lte: to },
          }).lean();
          return {
            customer: c,
            sessions,
            payments,
            monthlyTotal: sessions.reduce((s, x) => s + x.totalPrice, 0),
            monthlyPayments: payments.reduce((s, x) => s + x.amount, 0),
          };
        })
      );

      data = { details };
      csvHeaders = ['Customer', 'Company', 'Sessions', 'Monthly Total', 'Payments', 'Balance'];
      csvRows = details.map((d) => [
        d.customer.name,
        d.customer.company,
        d.sessions.length,
        d.monthlyTotal,
        d.monthlyPayments,
        d.customer.balance,
      ]);
      break;
    }

    default:
      return NextResponse.json({ error: 'Unknown report key' }, { status: 404 });
  }

  if (exportFormat === 'csv') {
    const csv = buildCsv(csvHeaders, csvRows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${reportKey}-${format(from, 'yyyy-MM')}.csv"`,
      },
    });
  }

  return NextResponse.json({ data, period: { from: from.toISOString(), to: to.toISOString() } });
}
