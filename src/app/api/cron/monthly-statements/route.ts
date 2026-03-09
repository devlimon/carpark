/**
 * GET /api/cron/monthly-statements
 * Called by Vercel Cron on the 20th of each month at 07:00 NZT
 * Requires header: x-cron-secret = process.env.CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Customer from '@/models/Customer';
import ParkingSession from '@/models/ParkingSession';
import Payment from '@/models/Payment';
import MonthlyStatement from '@/models/MonthlyStatement';
import Carpark from '@/models/Carpark';
import { sendMonthlyStatementEmail } from '@/lib/email';
import { fmtDate, fmtPeriod } from '@/lib/utils';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  // Determine period: previous month (cron runs on 20th => we send for the month just ended)
  const now = new Date();
  const periodDate = subMonths(now, 1);
  const year = periodDate.getFullYear();
  const month = periodDate.getMonth() + 1;
  const period = format(periodDate, 'yyyy-MM');
  const from = startOfMonth(periodDate);
  const to = endOfMonth(periodDate);

  const carparks = await Carpark.find().lean();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-carpark.vercel.app';

  let totalSent = 0;
  let totalFailed = 0;

  for (const carpark of carparks) {
    const carparkId = carpark._id.toString();
    const carparkName = carpark.name;

    const customers = await Customer.find({
      carparkId: carpark._id,
      accountType: 'on-account',
      active: true,
      email: { $exists: true, $ne: '' },
    }).lean();

    for (const customer of customers) {
      try {
        const sessions = await ParkingSession.find({
          carparkId: carpark._id,
          customerId: customer._id,
          paymentStatus: 'on-account',
          status: { $ne: 'void' },
          returnedAt: { $gte: from, $lte: to },
        }).lean();

        if (sessions.length === 0) continue;

        const payments = await Payment.find({
          carparkId: carpark._id,
          customerId: customer._id,
          paidAt: { $gte: from, $lte: to },
        }).lean();

        const thisMonthTotal = sessions.reduce((s, x) => s + x.totalPrice, 0);
        const paymentsTotal = payments.reduce((s, x) => s + x.amount, 0);
        const previousBalance = (customer.balance || 0) - thisMonthTotal + paymentsTotal;
        const closingBalance = previousBalance + thisMonthTotal - paymentsTotal;
        const paymentLink = `${baseUrl}/pay/${customer.slug}`;

        await MonthlyStatement.findOneAndUpdate(
          { carparkId: carpark._id, customerId: customer._id, period },
          {
            $set: {
              sessionIds: sessions.map((s) => s._id),
              previousBalance,
              thisMonthTotal,
              payments: paymentsTotal,
              closingBalance,
              emailAddress: customer.email,
              status: 'pending',
            },
          },
          { upsert: true, new: true }
        );

        await sendMonthlyStatementEmail({
          to: customer.email,
          customerName: customer.name,
          period: fmtPeriod(year, month),
          carparkName,
          sessions: sessions.map((s) => ({
            stay: `${fmtDate(s.dateIn)} – ${fmtDate(s.returnDate)}`,
            name: s.customerName,
            rego: s.rego,
            cost: s.totalPrice,
          })),
          previousBalance,
          thisMonthTotal,
          payments: paymentsTotal,
          closingBalance,
          paymentLink,
        });

        await MonthlyStatement.findOneAndUpdate(
          { carparkId: carpark._id, customerId: customer._id, period },
          { $set: { status: 'sent', sentAt: new Date() } }
        );

        totalSent++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await MonthlyStatement.findOneAndUpdate(
          { carparkId: carpark._id, customerId: customer._id, period },
          { $set: { status: 'failed', errorMessage: errMsg } },
          { upsert: true }
        );
        totalFailed++;
        console.error(`Failed to send statement to ${customer.email}:`, err);
      }
    }
  }

  return NextResponse.json({ ok: true, period, totalSent, totalFailed });
}
