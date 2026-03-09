'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { Download, FileText, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Customer {
  _id: string;
  name: string;
  email: string;
  company: string;
  balance: number;
}

interface StatementResult {
  customerId: string;
  name: string;
  status: string;
  error?: string;
}

interface OnAccountDetail {
  customer: Customer;
  sessions: { invoiceNo: number; dateIn: string; returnDate: string; totalPrice: number; rego: string }[];
  payments: { amount: number; method: string; paidAt: string }[];
  monthlyTotal: number;
  monthlyPayments: number;
}

export default function BillingPage() {
  const [period, setPeriod] = useState(format(subMonths(new Date(), 0), 'yyyy-MM'));
  const [details, setDetails] = useState<OnAccountDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [results, setResults] = useState<StatementResult[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/on-account?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data.data.details ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function runStatements() {
    setRunning(true);
    setResults(null);
    try {
      const res = await fetch('/api/billing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, dryRun }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);
        setShowResults(true);
        if (!dryRun) fetchReport();
      } else {
        alert(data.error || 'Failed to run statements');
      }
    } finally {
      setRunning(false);
    }
  }

  async function downloadCsv() {
    const res = await fetch(`/api/reports/on-account?period=${period}&export=csv`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `on-account-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    const res = await fetch(`/api/reports/on-account?period=${period}&export=pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `on-account-${period}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalOutstanding = details.reduce((s, d) => s + d.customer.balance, 0);
  const totalThisMonth = details.reduce((s, d) => s + d.monthlyTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Statements</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
          />
          <Button variant="secondary" size="sm" onClick={downloadCsv}>
            <Download size={15} /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadPdf}>
            <FileText size={15} /> PDF
          </Button>
          <div className="flex items-center gap-2">
            <input
              id="dryRun"
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="dryRun" className="text-sm text-gray-700">Dry Run</label>
          </div>
          <Button onClick={runStatements} loading={running}>
            <Send size={15} /> Send Statements
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">On-Account Customers</p>
          <p className="text-2xl font-bold mt-1">{details.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">This Month Total</p>
          <p className="text-2xl font-bold mt-1">${totalThisMonth.toFixed(2)}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Total Outstanding</p>
          <p className="text-2xl font-bold mt-1 text-red-600">${totalOutstanding.toFixed(2)}</p>
        </div>
      </div>

      {/* On-account detail by company */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-gray-400 py-8 text-center">Loading…</div>
        ) : details.length === 0 ? (
          <div className="text-gray-400 py-8 text-center bg-white rounded-lg border border-gray-200">
            No on-account customers found for this period
          </div>
        ) : (
          details.map((d) => (
            <div key={d.customer._id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  setExpandedCustomer(
                    expandedCustomer === d.customer._id ? null : d.customer._id
                  )
                }
              >
                <div>
                  <span className="font-semibold text-[#1e3a5f]">
                    {d.customer.company || d.customer.name}
                  </span>
                  {d.customer.company && (
                    <span className="text-gray-500 text-sm ml-2">({d.customer.name})</span>
                  )}
                  <span className="text-xs text-gray-400 ml-2">{d.customer.email}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {d.sessions.length} session{d.sessions.length !== 1 ? 's' : ''} = $
                    {d.monthlyTotal.toFixed(2)}
                  </span>
                  <span
                    className={`font-bold ${(d.customer.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    Balance: ${(d.customer.balance ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {expandedCustomer === d.customer._id && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-2 space-y-3">
                  {/* Sessions */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Sessions
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs">
                          <th className="text-left pb-1">Stay</th>
                          <th className="text-left pb-1">Rego</th>
                          <th className="text-right pb-1">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.sessions.map((s) => (
                          <tr key={s.invoiceNo}>
                            <td className="py-0.5">
                              {s.dateIn ? format(new Date(s.dateIn), 'd MMM yy') : '—'} –{' '}
                              {s.returnDate ? format(new Date(s.returnDate), 'd MMM yy') : '—'}
                            </td>
                            <td className="py-0.5 font-mono text-xs text-gray-600">{s.rego}</td>
                            <td className="py-0.5 text-right">${s.totalPrice.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 font-semibold">
                          <td colSpan={2} className="pt-1">Total</td>
                          <td className="text-right pt-1">${d.monthlyTotal.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Payments */}
                  {d.payments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        Payments Received
                      </h4>
                      {d.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {format(new Date(p.paidAt), 'd MMM yy')} via {p.method}
                          </span>
                          <span className="font-medium text-green-600">
                            -${p.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Results modal */}
      {showResults && results && (
        <Modal open title="Statement Results" onClose={() => setShowResults(false)} size="md">
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.customerId} className="flex items-center gap-2 text-sm">
                {r.status === 'sent' ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : r.status === 'failed' ? (
                  <XCircle size={16} className="text-red-500" />
                ) : (
                  <Clock size={16} className="text-gray-400" />
                )}
                <span className="flex-1">{r.name}</span>
                <span className={`text-xs font-medium ${r.status === 'failed' ? 'text-red-500' : 'text-gray-500'}`}>
                  {r.status}
                  {r.error ? ` — ${r.error}` : ''}
                </span>
              </div>
            ))}
            <div className="pt-4 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowResults(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
