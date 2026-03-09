/**
 * POST /api/billing/run
 * Trigger manual sending of monthly statements.
 * Also called automatically by the cron job on the 20th.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import Customer from '@/models/Customer';
import ParkingSession from '@/models/ParkingSession';
import Payment from '@/models/Payment';
import MonthlyStatement from '@/models/MonthlyStatement';
import { sendMonthlyStatementEmail } from '@/lib/email';
import { fmtDate, fmtPeriod } from '@/lib/utils';
import { startOfMonth, endOfMonth } from 'date-fns';

export const runtime = 'nodejs';

const RunSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/), // "2026-03"
  dryRun: z.boolean().optional(),
  customerId: z.string().optional(), // send for single customer
});

export async function POST(req: NextRequest) {
  // Allow authenticated staff or cron
  const carparkId = req.headers.get('x-carpark-id');
  if (!carparkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = req.headers.get('x-user-role');
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { period, dryRun = false, customerId } = parsed.data;
  const [year, month] = period.split('-').map(Number);
  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(from);

  await connectDB();

  const customerFilter: Record<string, unknown> = {
    carparkId,
    accountType: 'on-account',
    active: true,
    email: { $exists: true, $ne: '' },
  };
  if (customerId) customerFilter._id = customerId;

  const customers = await Customer.find(customerFilter).lean();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const carparkName = process.env.CARPARK_NAME || 'Car Storage';

  const results: { customerId: string; name: string; status: string; error?: string }[] = [];

  for (const customer of customers) {
    try {
      // Get all on-account sessions this period
      const sessions = await ParkingSession.find({
        carparkId,
        customerId: customer._id,
        paymentStatus: 'on-account',
        status: { $ne: 'void' },
        returnedAt: { $gte: from, $lte: to },
      }).lean();

      if (sessions.length === 0) {
        results.push({ customerId: customer._id.toString(), name: customer.name, status: 'skipped-no-sessions' });
        continue;
      }

      // Payments this period
      const payments = await Payment.find({
        carparkId,
        customerId: customer._id,
        paidAt: { $gte: from, $lte: to },
      }).lean();

      const thisMonthTotal = sessions.reduce((s, x) => s + x.totalPrice, 0);
      const paymentsTotal = payments.reduce((s, x) => s + x.amount, 0);
      // Previous balance = current balance - this month charges + this month payments
      const previousBalance = (customer.balance || 0) - thisMonthTotal + paymentsTotal;
      const closingBalance = previousBalance + thisMonthTotal - paymentsTotal;

      const periodLabel = fmtPeriod(year, month);
      const paymentLink = `${baseUrl}/pay/${customer.slug}`;

      if (!dryRun) {
        // Upsert statement record
        await MonthlyStatement.findOneAndUpdate(
          { carparkId, customerId: customer._id, period },
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
          period: periodLabel,
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
          { carparkId, customerId: customer._id, period },
          { $set: { status: 'sent', sentAt: new Date() } }
        );
      }

      results.push({ customerId: customer._id.toString(), name: customer.name, status: dryRun ? 'dry-run' : 'sent' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      results.push({ customerId: customer._id.toString(), name: customer.name, status: 'failed', error: errMsg });

      await MonthlyStatement.findOneAndUpdate(
        { carparkId, customerId: customer._id, period },
        { $set: { status: 'failed', errorMessage: errMsg } },
        { upsert: true }
      );
    }
  }

  return NextResponse.json({ ok: true, period, results });
}
