'use client';

import React, { useState, useEffect, use } from 'react';

interface CustomerInfo {
  name: string;
  company: string;
  balance: number;
}

interface Session {
  _id: string;
  invoiceNo: number;
  dateIn: string;
  returnDate: string;
  totalPrice: number;
  rego: string;
  stay: number;
}

export default function PayPage({ params }: { params: Promise<{ customerSlug: string }> }) {
  const { customerSlug } = use(params);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank-transfer');
  const [reference, setReference] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pay/${customerSlug}`);
        if (!res.ok) { setNotFound(true); setLoading(false); return; }
        const data = await res.json();
        setCustomer(data.customer);
        setSessions(data.unpaidSessions ?? []);
        if (data.customer.balance > 0) {
          setAmount(data.customer.balance.toFixed(2));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [customerSlug]);

  async function handlePay() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Please enter a valid amount'); return; }
    setPaying(true);
    setError('');
    try {
      const res = await fetch(`/api/pay/${customerSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, method, reference }),
      });
      if (res.ok) {
        setPaid(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Payment failed');
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Account Not Found</h1>
          <p className="text-gray-500 mt-2">This payment link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white rounded-xl p-8 shadow-lg max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Recorded</h1>
          <p className="text-gray-600 mt-2">Thank you, {customer.name}!</p>
          <p className="text-gray-500 text-sm mt-1">Amount: ${parseFloat(amount).toFixed(2)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Car Storage — Account Payment</h1>
          {customer.company && (
            <p className="text-gray-600 mt-1 font-medium">{customer.company}</p>
          )}
          <p className="text-gray-500">{customer.name}</p>
        </div>

        {/* Balance */}
        <div className={`rounded-xl p-6 text-center ${customer.balance > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Outstanding Balance</p>
          <p className={`text-4xl font-bold mt-1 ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${customer.balance.toFixed(2)}
          </p>
          {customer.balance <= 0 && (
            <p className="text-green-600 text-sm mt-2 font-medium">Your account is up to date!</p>
          )}
        </div>

        {/* Unpaid sessions */}
        {sessions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Unpaid Sessions</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="text-left pb-2">Stay</th>
                  <th className="text-left pb-2">Rego</th>
                  <th className="text-right pb-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s) => (
                  <tr key={s._id}>
                    <td className="py-1.5">
                      {s.dateIn ? new Date(s.dateIn).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : '—'}
                      {' – '}
                      {s.returnDate ? new Date(s.returnDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="py-1.5 font-mono text-xs text-gray-600">{s.rego}</td>
                    <td className="py-1.5 text-right">${s.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment form */}
        {customer.balance > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Make a Payment</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-lg font-semibold text-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
              >
                <option value="bank-transfer">Bank Transfer</option>
                <option value="credit-card">Credit Card</option>
                <option value="eftpos">Eftpos</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference (optional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transaction #, cheque number, etc."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
            )}

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full bg-[#1e3a5f] hover:bg-[#162d4b] text-white rounded-lg py-3 text-base font-semibold
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {paying ? 'Recording Payment…' : `Pay $${parseFloat(amount || '0').toFixed(2)}`}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Your payment will be recorded and your account balance updated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
