import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ParkingSession from '@/models/ParkingSession';
import Customer from '@/models/Customer';
import Payment from '@/models/Payment';
import { buildCsv, fmtDate } from '@/lib/utils';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import PDFDocument from 'pdfkit';

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

  if (exportFormat === 'pdf') {
    const periodLabel = format(from, 'MMMM yyyy');
    const reportTitle = reportKey
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const NAVY = '#1e3a5f';

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const checkBreak = () => { if (doc.y > 740) doc.addPage(); };

      // Page header
      doc.fontSize(20).fillColor(NAVY).text(`${reportTitle} Report`, { align: 'center' });
      doc.fontSize(11).fillColor('#666')
        .text(`Period: ${periodLabel}`, { align: 'center' })
        .text(`Generated: ${format(new Date(), 'd MMM yyyy, HH:mm')}`, { align: 'center' });
      doc.moveDown(1.5);

      switch (reportKey) {
        case 'revenue': {
          const d = data as {
            sessions: { invoiceNo: number; returnedAt: string | null; customerName: string; rego: string; stay: number; totalPrice: number; paymentStatus: string }[];
            total: number;
            byMethod: Record<string, number>;
          };

          doc.font('Helvetica-Bold').fontSize(15).fillColor(NAVY)
            .text(`Total Revenue: $${(d.total ?? 0).toFixed(2)}`);
          doc.moveDown(0.4);

          if (d.byMethod && Object.keys(d.byMethod).length > 0) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#333').text('By Payment Method:');
            doc.font('Helvetica').fontSize(10).fillColor('#555');
            Object.entries(d.byMethod).forEach(([k, v]) => {
              doc.text(`  ${k.charAt(0).toUpperCase() + k.slice(1)}: $${(v as number).toFixed(2)}`);
            });
            doc.moveDown(0.6);
          }

          doc.font('Courier-Bold').fontSize(8).fillColor(NAVY)
            .text('Inv#   Date        Name                  Rego        Days  Amount      Payment');
          doc.font('Courier').fillColor('#aaa')
            .text('-----  ----------  --------------------  ----------  ----  ----------  -------');
          doc.fillColor('#333');

          for (const s of d.sessions ?? []) {
            checkBreak();
            const line = [
              String(s.invoiceNo ?? '').padEnd(7),
              (s.returnedAt ? format(new Date(s.returnedAt), 'd/MM/yy') : '—').padEnd(12),
              (s.customerName ?? '').slice(0, 20).padEnd(22),
              (s.rego ?? '').padEnd(12),
              String(s.stay ?? 0).padEnd(6),
              `$${(s.totalPrice ?? 0).toFixed(2)}`.padEnd(12),
              s.paymentStatus ?? '',
            ].join('');
            doc.font('Courier').text(line);
          }
          break;
        }

        case 'occupancy': {
          const d = data as { days: { date: string; count: number }[] };

          doc.font('Courier-Bold').fontSize(8).fillColor(NAVY)
            .text('Date          Cars In Yard');
          doc.font('Courier').fillColor('#aaa')
            .text('----------    ------------');
          doc.fillColor('#333');

          for (const day of d.days ?? []) {
            checkBreak();
            doc.font('Courier').text(`${day.date}    ${String(day.count).padStart(4)}`);
          }
          break;
        }

        case 'customers': {
          const d = data as {
            customers: { name: string; type: string; rego1: string; phone: string; periodSessions: number; periodRevenue: number; balance: number }[];
          };

          doc.font('Courier-Bold').fontSize(8).fillColor(NAVY)
            .text('Name                  Type          Rego      Sessions  Revenue      Balance');
          doc.font('Courier').fillColor('#aaa')
            .text('--------------------  ------------  --------  --------  -----------  -------');
          doc.fillColor('#333');

          for (const c of d.customers ?? []) {
            checkBreak();
            const line = [
              (c.name ?? '').slice(0, 20).padEnd(22),
              (c.type ?? '').padEnd(14),
              (c.rego1 ?? '').padEnd(10),
              String(c.periodSessions ?? 0).padEnd(10),
              `$${(c.periodRevenue ?? 0).toFixed(2)}`.padEnd(13),
              `$${(c.balance ?? 0).toFixed(2)}`,
            ].join('');
            doc.font('Courier').text(line);
          }
          break;
        }

        case 'on-account': {
          const d = data as {
            details: {
              customer: { name: string; company: string; email: string; balance: number };
              sessions: { dateIn: string; returnDate: string; rego: string; totalPrice: number }[];
              monthlyTotal: number;
              monthlyPayments: number;
            }[];
          };

          for (const detail of d.details ?? []) {
            if (doc.y > 650) doc.addPage();

            const displayName = detail.customer.company || detail.customer.name;
            doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(displayName);
            if (detail.customer.email) {
              doc.font('Helvetica').fontSize(9).fillColor('#666').text(detail.customer.email);
            }
            doc.moveDown(0.3);

            doc.font('Courier-Bold').fontSize(8).fillColor('#333')
              .text('Stay                        Rego        Amount');
            doc.font('Courier').fillColor('#aaa')
              .text('--------------------------  ----------  ------');
            doc.fillColor('#333');

            for (const s of detail.sessions ?? []) {
              checkBreak();
              const stay = `${s.dateIn ? format(new Date(s.dateIn), 'd/MM/yy') : '—'} – ${s.returnDate ? format(new Date(s.returnDate), 'd/MM/yy') : '—'}`;
              doc.font('Courier').text(`${stay.padEnd(28)}${(s.rego ?? '').padEnd(12)}$${(s.totalPrice ?? 0).toFixed(2)}`);
            }

            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(10).fillColor('#333')
              .text(
                `Monthly: $${(detail.monthlyTotal ?? 0).toFixed(2)}  |  Payments: $${(detail.monthlyPayments ?? 0).toFixed(2)}`,
                { align: 'right' }
              );
            const bal = detail.customer.balance ?? 0;
            doc.font('Helvetica-Bold').fontSize(12)
              .fillColor(bal > 0 ? '#c00000' : '#006400')
              .text(`Balance: $${bal.toFixed(2)}`, { align: 'right' });
            doc.moveDown(1.2);
          }
          break;
        }
      }

      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reportKey}-${format(from, 'yyyy-MM')}.pdf"`,
      },
    });
  }

  return NextResponse.json({ data, period: { from: from.toISOString(), to: to.toISOString() } });
}
