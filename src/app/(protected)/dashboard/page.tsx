'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { CarFront, Users, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  activeSessions: number;
  overdueSessions: number;
  todayRevenue: number;
  monthRevenue: number;
  todayCount: number;
  monthCount: number;
  totalCustomers: number;
  pendingOnAccount: number;
  occupancyRate: number;
  capacity: number;
  chartData: { date: string; revenue: number; count: number }[];
  onAccountCustomers: { id: string; name: string; balance: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard…</div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button onClick={fetchData} className="text-sm text-[#1e3a5f] hover:underline">
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Cars In Yard"
          value={d.activeSessions}
          sub={`of ${d.capacity} (${d.occupancyRate}%)`}
          icon={<CarFront size={24} />}
          color={d.occupancyRate > 80 ? 'bg-orange-50' : 'bg-white'}
        />
        <StatCard
          label="Today's Revenue"
          value={`$${d.todayRevenue.toFixed(2)}`}
          sub={`${d.todayCount} cars returned`}
          icon={<DollarSign size={24} />}
        />
        <StatCard
          label="Month Revenue"
          value={`$${d.monthRevenue.toFixed(2)}`}
          sub={`${d.monthCount} returns`}
          icon={<TrendingUp size={24} />}
        />
        <StatCard
          label="On Account Balance"
          value={`$${d.pendingOnAccount.toFixed(2)}`}
          sub={`${d.totalCustomers} customers`}
          icon={<Users size={24} />}
          color={d.pendingOnAccount > 0 ? 'bg-yellow-50' : 'bg-white'}
        />
      </div>

      {/* Alert: overdue */}
      {d.overdueSessions > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">
            {d.overdueSessions} overdue car{d.overdueSessions > 1 ? 's' : ''} — return date has
            passed.{' '}
            <Link href="/operations?status=overdue" className="underline">
              View →
            </Link>
          </span>
        </div>
      )}

      {/* Revenue 30-day chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue — Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={d.chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v.slice(5)}
              tick={{ fontSize: 11 }}
              interval={4}
            />
            <YAxis tick={{ fontSize: 11 }} width={50} />
            <Tooltip
              formatter={(v: unknown) => [`$${(v as number).toFixed(2)}`, 'Revenue']}
              labelFormatter={(l: unknown) => `Date: ${l}`}
            />
            <Bar dataKey="revenue" fill="#1e3a5f" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Occupancy gauge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Occupancy</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, d.occupancyRate)}%`,
                    background: d.occupancyRate > 80 ? '#ef4444' : '#1e3a5f',
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {d.activeSessions} / {d.capacity} spaces
              </p>
            </div>
            <span className="text-2xl font-bold text-gray-900">{d.occupancyRate}%</span>
          </div>
        </div>

        {/* On-account outstanding */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">On Account Outstanding</h2>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {d.onAccountCustomers.filter((c) => c.balance > 0).length === 0 ? (
              <p className="text-sm text-gray-400">All accounts clear</p>
            ) : (
              d.onAccountCustomers
                .filter((c) => c.balance > 0)
                .map((c) => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{c.name}</span>
                    <span className="font-semibold text-red-600">${c.balance.toFixed(2)}</span>
                  </div>
                ))
            )}
          </div>
          <Link
            href="/billing"
            className="text-xs text-[#1e3a5f] hover:underline mt-2 inline-block"
          >
            Manage billing →
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/operations?action=new"
            className="bg-[#1e3a5f] text-white text-sm px-4 py-2 rounded hover:bg-[#162d4b] transition-colors"
          >
            + New Invoice
          </Link>
          <Link
            href="/operations"
            className="bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded hover:bg-gray-200 transition-colors border border-gray-300"
          >
            View Returns
          </Link>
          <Link
            href="/customers?action=new"
            className="bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded hover:bg-gray-200 transition-colors border border-gray-300"
          >
            + Add Customer
          </Link>
          <Link
            href="/billing"
            className="bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded hover:bg-gray-200 transition-colors border border-gray-300"
          >
            Billing / Statements
          </Link>
        </div>
      </div>
    </div>
  );
}
