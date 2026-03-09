'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { Download, TrendingUp, Users, Car, Receipt } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

const REPORTS = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'occupancy', label: 'Occupancy', icon: Car },
  { key: 'customers', label: 'Customer Usage', icon: Users },
  { key: 'on-account', label: 'On Account', icon: Receipt },
];

type ReportData = {
  sessions?: {
    _id: string; invoiceNo: number; customerName: string; rego: string; stay: number; totalPrice: number; paymentStatus: string; returnedAt: string;
  }[];
  total?: number;
  byMethod?: Record<string, number>;
  days?: { date: string; count: number }[];
  customers?: {
    _id: string; name: string; type: string; phone: string; rego1: string; periodSessions: number; periodRevenue: number; balance: number;
  }[];
  details?: {
    customer: { _id: string; name: string; company: string; email: string; balance: number };
    monthlyTotal: number; monthlyPayments: number; sessions: unknown[];
  }[];
};

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('revenue');
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${activeReport}?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [activeReport, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function downloadCsv() {
    const res = await fetch(`/api/reports/${activeReport}?period=${period}&export=csv`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
          />
          <Button variant="secondary" size="sm" onClick={downloadCsv}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex gap-2 flex-wrap">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors
              ${activeReport === r.key
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <r.icon size={16} />
            {r.label}
          </button>
        ))}
      </div>

      {/* Report content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading report…</div>
        ) : !data ? (
          <div className="py-12 text-center text-gray-400">No data</div>
        ) : (
          <>
            {/* ========== REVENUE ========== */}
            {activeReport === 'revenue' && data.sessions && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                    <p className="text-3xl font-bold text-[#1e3a5f]">${(data.total ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    {Object.entries(data.byMethod ?? {}).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <p className="font-semibold">${v.toFixed(2)}</p>
                        <p className="text-gray-500 text-xs capitalize">{k}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: 'invoiceNo', header: 'Invoice#' },
                    { key: 'returnedAt', header: 'Date', render: (r) => r.returnedAt ? format(new Date(r.returnedAt), 'd MMM yy') : '—' },
                    { key: 'customerName', header: 'Customer' },
                    { key: 'rego', header: 'Rego' },
                    { key: 'stay', header: 'Days' },
                    { key: 'totalPrice', header: 'Amount', render: (r) => `$${r.totalPrice.toFixed(2)}` },
                    { key: 'paymentStatus', header: 'Payment' },
                  ]}
                  data={data.sessions}
                />
              </div>
            )}

            {/* ========== OCCUPANCY ========== */}
            {activeReport === 'occupancy' && data.days && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Daily car count in yard for {period}</p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.days}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8)} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => [v as number, 'Cars']} />
                    <Line type="monotone" dataKey="count" stroke="#1e3a5f" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                <DataTable
                  columns={[
                    { key: 'date', header: 'Date' },
                    { key: 'count', header: 'Cars In Yard' },
                  ]}
                  data={data.days}
                />
              </div>
            )}

            {/* ========== CUSTOMER USAGE ========== */}
            {activeReport === 'customers' && data.customers && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.customers.slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'Revenue']} />
                    <Bar dataKey="periodRevenue" fill="#1e3a5f" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Name' },
                    { key: 'type', header: 'Type' },
                    { key: 'rego1', header: 'Rego' },
                    { key: 'phone', header: 'Phone' },
                    { key: 'periodSessions', header: 'Sessions' },
                    { key: 'periodRevenue', header: 'Revenue', render: (r) => `$${r.periodRevenue.toFixed(2)}` },
                    { key: 'balance', header: 'Balance', render: (r) => r.balance > 0 ? <span className="text-red-600">${r.balance.toFixed(2)}</span> : '—' },
                  ]}
                  data={data.customers}
                />
              </div>
            )}

            {/* ========== ON ACCOUNT ========== */}
            {activeReport === 'on-account' && data.details && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.details.map((d) => ({ name: d.customer.company || d.customer.name, total: d.monthlyTotal, balance: d.customer.balance }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`]} />
                    <Bar dataKey="total" fill="#1e3a5f" name="Month Total" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="balance" fill="#ef4444" name="Balance" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <DataTable
                  columns={[
                    { key: 'customer', header: 'Customer', render: (r) => `${r.customer.company || r.customer.name}` },
                    { key: 'email', header: 'Email', render: (r) => r.customer.email },
                    { key: 'sessions', header: 'Sessions', render: (r) => (r.sessions as unknown[]).length },
                    { key: 'monthlyTotal', header: 'This Month', render: (r) => `$${r.monthlyTotal.toFixed(2)}` },
                    { key: 'monthlyPayments', header: 'Payments', render: (r) => `$${r.monthlyPayments.toFixed(2)}` },
                    { key: 'customer.balance', header: 'Balance', render: (r) => (
                      <span className={r.customer.balance > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                        ${r.customer.balance.toFixed(2)}
                      </span>
                    ) },
                  ]}
                  data={data.details}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
