'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { format, parseISO } from 'date-fns';

interface Customer {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  type: string;
  accountType: string;
  phone: string;
  email: string;
  company: string;
  rego1: string;
  rego2: string;
  make: string;
  ltNumber: string;
  dailyRate: number;
  creditPercent: number;
  expiryDate: string | null;
  maxVehicles: number;
  balance: number;
  notes: string;
  active: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  casual: 'Casual',
  'short-term': 'Short Term',
  'long-term': 'Long Term',
  annual: 'Annual',
};

const TYPE_COLORS: Record<string, string> = {
  casual: 'bg-blue-100 text-blue-800',
  'short-term': 'bg-green-100 text-green-800',
  'long-term': 'bg-yellow-100 text-yellow-800',
  annual: 'bg-purple-100 text-purple-800',
};

const CUSTOMER_TYPES = [
  { value: 'casual', label: 'Casual' },
  { value: 'short-term', label: 'Short Term' },
  { value: 'long-term', label: 'Long Term' },
  { value: 'annual', label: 'Annual' },
];

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'eftpos', label: 'Eftpos' },
  { value: 'on-account', label: 'On Account' },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (typeFilter) params.set('type', typeFilter);
      if (activeSearch) params.set('search', activeSearch);
      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, activeSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditCustomer(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Customers ({total})</h1>
        <Button onClick={() => { setEditCustomer(null); setShowModal(true); }} size="sm">
          <Plus size={16} /> Add Customer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
        <div className="flex gap-2">
          {[{ value: '', label: 'All' }, ...CUSTOMER_TYPES].map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                typeFilter === t.value
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="Search name / rego / phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveSearch(search)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-52 focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
          />
          <button
            onClick={() => setActiveSearch(search)}
            className="p-1.5 bg-[#1e3a5f] text-white rounded hover:bg-[#162d4b]"
          >
            <Search size={16} />
          </button>
          {activeSearch && (
            <button
              onClick={() => { setSearch(''); setActiveSearch(''); }}
              className="text-xs text-gray-500 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              {['LT#', 'Name', 'Type', 'Account', 'Phone', 'Rego 1', 'Rego 2', 'Make', 'Rate', 'Credit %', 'Balance', 'Expiry', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={13} className="py-10 text-center text-gray-400">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={13} className="py-10 text-center text-gray-400">No customers found</td></tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c._id}
                  className={`hover:bg-gray-50 ${!c.active ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-2 text-gray-500">{c.ltNumber}</td>
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[c.type]}`}>
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {c.accountType === 'on-account' ? (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-orange-100 text-orange-700">
                        On Account
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">{c.accountType}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{c.phone}</td>
                  <td className="px-3 py-2 font-mono">{c.rego1}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{c.rego2}</td>
                  <td className="px-3 py-2 text-gray-600">{c.make}</td>
                  <td className="px-3 py-2">{c.dailyRate > 0 ? `$${c.dailyRate}` : 'Default'}</td>
                  <td className="px-3 py-2">{c.creditPercent > 0 ? `${c.creditPercent}%` : '—'}</td>
                  <td className="px-3 py-2">
                    {c.balance > 0 ? (
                      <span className="text-red-600 font-semibold">${c.balance.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {c.expiryDate ? format(parseISO(c.expiryDate), 'd MMM yy') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(c)} className="text-[#1e3a5f] hover:text-[#162d4b]">
                      <Edit2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CustomerModal
          customer={editCustomer}
          onClose={closeModal}
          onSaved={() => { closeModal(); fetchCustomers(); }}
        />
      )}
    </div>
  );
}

/* ===================== CUSTOMER MODAL ===================== */
function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    type: customer?.type || 'long-term',
    accountType: customer?.accountType || 'eftpos',
    name: customer?.name || '',
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    company: customer?.company || '',
    rego1: customer?.rego1 || '',
    rego2: customer?.rego2 || '',
    make: customer?.make || '',
    ltNumber: customer?.ltNumber || '',
    dailyRate: customer?.dailyRate ?? 0,
    creditPercent: customer?.creditPercent ?? 0,
    expiryDate: customer?.expiryDate ? customer.expiryDate.slice(0, 10) : '',
    maxVehicles: customer?.maxVehicles ?? 1,
    notes: customer?.notes || '',
    active: customer?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.name) { setError('Name required'); return; }
    setSaving(true);
    setError('');
    try {
      const method = customer ? 'PUT' : 'POST';
      const url = customer ? `/api/customers/${customer._id}` : '/api/customers';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          dailyRate: Number(form.dailyRate),
          creditPercent: Number(form.creditPercent),
          maxVehicles: Number(form.maxVehicles),
          expiryDate: form.expiryDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const F = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <Modal open title={customer ? 'Edit Customer' : 'New Customer'} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type *" value={form.type} onChange={F('type')} options={CUSTOMER_TYPES} />
          <Select label="Account Type" value={form.accountType} onChange={F('accountType')} options={ACCOUNT_TYPES} />
          <div className="col-span-2">
            <Input label="Full Name *" value={form.name} onChange={F('name')} />
          </div>
          <Input label="First Name" value={form.firstName} onChange={F('firstName')} />
          <Input label="Last Name" value={form.lastName} onChange={F('lastName')} />
          <Input label="Email" type="email" value={form.email} onChange={F('email')} />
          <Input label="Phone" type="tel" value={form.phone} onChange={F('phone')} />
          <div className="col-span-2">
            <Input label="Company" value={form.company} onChange={F('company')} />
          </div>
          <Input label="Rego 1" value={form.rego1} onChange={(e) => setForm((f) => ({ ...f, rego1: e.target.value.toUpperCase() }))} />
          <Input label="Rego 2" value={form.rego2} onChange={(e) => setForm((f) => ({ ...f, rego2: e.target.value.toUpperCase() }))} />
          <Input label="Make" value={form.make} onChange={F('make')} />
          <Input label="LT Number" value={form.ltNumber} onChange={F('ltNumber')} placeholder="e.g. LT1" />
          <Input label="Daily Rate (0=default)" type="number" value={form.dailyRate} onChange={F('dailyRate')} />
          <Input label="Credit %" type="number" min={0} max={100} value={form.creditPercent} onChange={F('creditPercent')} />
          <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={F('expiryDate')} />
          <Input label="Max Vehicles" type="number" min={1} value={form.maxVehicles} onChange={F('maxVehicles')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
          />
        </div>
        {customer && (
          <div className="flex items-center gap-2">
            <input
              id="cust-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="cust-active" className="text-sm text-gray-700">Active</label>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {customer ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
