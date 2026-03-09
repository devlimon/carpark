'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';

interface Session {
  _id: string;
  invoiceNo: number;
  keyNo: number;
  noKey: boolean;
  customerName: string;
  customerPhone: string;
  rego: string;
  make: string;
  dateIn: string;
  returnDate: string;
  returnTime: string;
  stay: number;
  totalPrice: number;
  paymentStatus: string;
  paymentStatus2?: string;
  pickedUp: string;
  doNotMove: boolean;
  status: string;
  staffIn: string;
  staffOut: string;
  customerId?: string;
  customerType: string;
  creditPercent: number;
  dailyRate: number;
  invoiceNote: string;
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
  rego1: string;
  make: string;
  accountType: string;
  creditPercent: number;
  dailyRate: number;
  type: string;
}

const STATUS_COLORS: Record<string, string> = {
  eftpos: 'bg-green-100 text-green-800',
  'on-account': 'bg-purple-100 text-purple-800',
  'to-pay': 'bg-yellow-100 text-yellow-800',
  unpaid: 'bg-gray-100 text-gray-600',
  void: 'bg-red-100 text-red-700 line-through',
  paid: 'bg-blue-100 text-blue-800',
};

const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'eftpos', label: 'Eftpos' },
  { value: 'on-account', label: 'OnAcc' },
  { value: 'to-pay', label: 'To Pay' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

const PICKUP_OPTIONS = [
  { value: 'car-in-yard', label: 'Car In Yard' },
  { value: 'picked-up', label: 'Picked Up' },
];

export default function OperationsPage() {
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeSearch) {
        params.set('search', activeSearch);
      } else {
        params.set('returnDate', returnDate);
      }
      params.set('limit', '200');
      const res = await fetch(`/api/parking-sessions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } finally {
      setLoading(false);
    }
  }, [returnDate, activeSearch]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  function shiftDate(delta: number) {
    const d = parseISO(returnDate);
    setReturnDate(format(addDays(d, delta), 'yyyy-MM-dd'));
    setActiveSearch('');
  }

  function handleSearch() {
    setActiveSearch(searchQuery);
  }

  // Group by return time blocks
  const grouped: Record<string, Session[]> = {};
  sessions.forEach((s) => {
    const time = s.returnTime || '0000';
    if (!grouped[time]) grouped[time] = [];
    grouped[time].push(s);
  });

  const totalCars = sessions.filter((s) => s.status !== 'void').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Car Returns</h1>
        <Button onClick={() => setShowNewModal(true)} size="sm">
          <Plus size={16} /> New Invoice
        </Button>
      </div>

      {/* Date navigation */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
        <button onClick={() => shiftDate(-1)} className="p-1 rounded hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <input
          type="date"
          value={returnDate}
          onChange={(e) => { setReturnDate(e.target.value); setActiveSearch(''); }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
        />
        <button onClick={() => shiftDate(1)} className="p-1 rounded hover:bg-gray-100">
          <ChevronRight size={20} />
        </button>
        <span className="text-sm text-gray-600 font-medium">
          {format(parseISO(returnDate), 'EEEE, d MMMM yyyy')} — Return Date
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="Search name / rego…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-44 focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
          />
          <button onClick={handleSearch} className="p-1.5 bg-[#1e3a5f] text-white rounded hover:bg-[#162d4b]">
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="text-right text-sm text-gray-600 font-medium">
        Total Cars: <span className="text-gray-900 font-bold">{totalCars}</span>
      </div>

      {/* Sessions table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              {['P/Up', 'Name', 'Ph', 'Rego', 'Make', 'Inv#', 'Key#', 'Amount', 'Status', 'Ret Date', 'Ret Time', 'Notes', 'Staff'].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={13} className="py-10 text-center text-gray-400">Loading…</td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-10 text-center text-gray-400">No sessions found</td>
              </tr>
            ) : (
              Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([, group]) => {
                  const rows: React.ReactNode[] = [];
                  group.forEach((s) => {
                    rows.push(
                      <tr
                        key={s._id}
                        className={`hover:bg-blue-50 cursor-pointer ${s.status === 'void' ? 'opacity-50' : ''}`}
                        onClick={() => setEditSession(s)}
                      >
                        <td className="px-2 py-1.5">
                          <span className={`inline-block w-3 h-3 rounded-full ${s.pickedUp === 'picked-up' ? 'bg-green-400' : 'bg-red-400'}`} />
                        </td>
                        <td className="px-2 py-1.5 font-medium">{s.customerName}</td>
                        <td className="px-2 py-1.5 text-gray-500">{s.customerPhone}</td>
                        <td className="px-2 py-1.5 font-mono">{s.rego}</td>
                        <td className="px-2 py-1.5 text-gray-600">{s.make}</td>
                        <td className="px-2 py-1.5">{s.invoiceNo}</td>
                        <td className="px-2 py-1.5">{s.noKey ? 'No Key' : s.keyNo}</td>
                        <td className="px-2 py-1.5 font-semibold">${s.totalPrice.toFixed(2)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.paymentStatus] || 'bg-gray-100'}`}>
                            {s.paymentStatus}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{format(parseISO(s.returnDate), 'd/M/yy')}</td>
                        <td className="px-2 py-1.5">{s.returnTime}</td>
                        <td className="px-2 py-1.5 text-xs text-gray-500 max-w-[120px] truncate">{s.invoiceNote}</td>
                        <td className="px-2 py-1.5 text-gray-500">{s.staffOut || s.staffIn}</td>
                      </tr>
                    );
                  });
                  rows.push(
                    <tr key={`${group[0].returnTime}-subtotal`} className="bg-gray-50">
                      <td colSpan={13} className="px-2 py-1 text-right text-xs text-gray-500 font-medium">
                        {group.filter((s) => s.status !== 'void').length} Cars
                      </td>
                    </tr>
                  );
                  return rows;
                })
            )}
          </tbody>
        </table>
      </div>

      {/* New Invoice Modal */}
      {showNewModal && (
        <NewSessionModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); fetchSessions(); }}
          returnDateDefault={returnDate}
        />
      )}

      {/* Edit Session Modal */}
      {editSession && (
        <EditSessionModal
          session={editSession}
          onClose={() => setEditSession(null)}
          onSaved={() => { setEditSession(null); fetchSessions(); }}
        />
      )}
    </div>
  );
}

/* ===================== NEW SESSION MODAL ===================== */
function NewSessionModal({
  onClose,
  onSaved,
  returnDateDefault,
}: {
  onClose: () => void;
  onSaved: () => void;
  returnDateDefault: string;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    rego: '',
    make: '',
    keyNo: '',
    noKey: false,
    dateIn: today,
    timeIn: '',
    returnDate: returnDateDefault,
    returnTime: '',
    returnFlight: '',
    paymentStatus: 'eftpos',
    pickedUp: 'car-in-yard',
    staffIn: '',
    invoiceNote: '',
    customerId: '',
  });
  const [calculating, setCalculating] = useState(false);
  const [preview, setPreview] = useState<{ days: number; rate: number; amount: number } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  async function searchCustomers(q: string) {
    if (!q || q.length < 2) { setCustomerResults([]); return; }
    const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=5`);
    if (res.ok) {
      const data = await res.json();
      setCustomerResults(data.customers);
    }
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setForm((f) => ({
      ...f,
      customerName: c.name,
      customerPhone: c.phone,
      rego: c.rego1 || f.rego,
      make: c.make || f.make,
      paymentStatus: c.accountType === 'on-account' ? 'on-account' : f.paymentStatus,
      customerId: c._id,
    }));
    setCustomerResults([]);
    setCustomerSearch('');
  }

  function calcPreview() {
    if (!form.dateIn || !form.returnDate) return;
    const d1 = new Date(form.dateIn);
    const d2 = new Date(form.returnDate);
    const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
    const rate = selectedCustomer?.dailyRate && selectedCustomer.dailyRate > 0 ? selectedCustomer.dailyRate : 18;
    const credit = selectedCustomer?.creditPercent ?? 0;
    const gross = days * rate;
    const amount = Math.round((gross * (1 - credit / 100)) * 100) / 100;
    setPreview({ days, rate, amount });
  }

  async function handleSave() {
    setError('');
    if (!form.customerName) { setError('Customer name required'); return; }
    if (!form.dateIn || !form.returnDate) { setError('Dates required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/parking-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          keyNo: form.keyNo ? parseInt(form.keyNo) : 0,
          customerId: form.customerId || undefined,
          customerType: selectedCustomer?.type || 'casual',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.fieldErrors ? JSON.stringify(data.error.fieldErrors) : 'Failed to save'); return; }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="New Invoice" onClose={onClose} size="xl">
      <div className="space-y-4">
        {/* Customer search */}
        <div className="relative">
          <Input
            label="Search Customer"
            value={customerSearch}
            onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
            placeholder="Type name or rego…"
          />
          {customerResults.length > 0 && (
            <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded shadow mt-1">
              {customerResults.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => selectCustomer(c)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  {c.name} — {c.rego1} — {c.type}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Customer Name *" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
          <Input label="Phone" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} />
          <Input label="Rego" value={form.rego} onChange={(e) => setForm((f) => ({ ...f, rego: e.target.value.toUpperCase() }))} />
          <Input label="Make" value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} />
          <Input label="Key No" type="number" value={form.keyNo} onChange={(e) => setForm((f) => ({ ...f, keyNo: e.target.value }))} />
          <div className="flex items-center gap-2 pt-5">
            <input id="noKey" type="checkbox" checked={form.noKey} onChange={(e) => setForm((f) => ({ ...f, noKey: e.target.checked }))} className="rounded border-gray-300" />
            <label htmlFor="noKey" className="text-sm text-gray-700">No Key</label>
          </div>
          <Input label="Date In *" type="date" value={form.dateIn} onChange={(e) => { setForm((f) => ({ ...f, dateIn: e.target.value })); }} />
          <Input label="Time In" type="time" value={form.timeIn} onChange={(e) => setForm((f) => ({ ...f, timeIn: e.target.value }))} />
          <Input label="Return Date *" type="date" value={form.returnDate} onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))} />
          <Input label="Return Time" placeholder="e.g. 1430" value={form.returnTime} onChange={(e) => setForm((f) => ({ ...f, returnTime: e.target.value }))} />
          <Input label="Return Flight" value={form.returnFlight} onChange={(e) => setForm((f) => ({ ...f, returnFlight: e.target.value }))} />
          <Select
            label="Payment Status"
            value={form.paymentStatus}
            onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}
            options={PAYMENT_OPTIONS}
          />
          <Select
            label="Picked Up"
            value={form.pickedUp}
            onChange={(e) => setForm((f) => ({ ...f, pickedUp: e.target.value }))}
            options={PICKUP_OPTIONS}
          />
          <Input label="Staff" value={form.staffIn} onChange={(e) => setForm((f) => ({ ...f, staffIn: e.target.value }))} />
        </div>
        <Input label="Invoice Note" value={form.invoiceNote} onChange={(e) => setForm((f) => ({ ...f, invoiceNote: e.target.value }))} />

        <div className="flex items-center gap-3 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={calcPreview}>
            Calculate Price
          </Button>
          {preview && (
            <span className="text-sm font-semibold text-gray-700">
              {preview.days} days × ${preview.rate}/day = <span className="text-[#1e3a5f]">${preview.amount.toFixed(2)}</span>
            </span>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Invoice</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ===================== EDIT SESSION MODAL ===================== */
function EditSessionModal({
  session,
  onClose,
  onSaved,
}: {
  session: Session;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    paymentStatus: session.paymentStatus,
    pickedUp: session.pickedUp,
    status: session.status,
    returnDate: session.returnDate.slice(0, 10),
    returnTime: session.returnTime || '',
    keyNo: String(session.keyNo || ''),
    noKey: session.noKey,
    staffOut: session.staffOut || '',
    invoiceNote: session.invoiceNote || '',
    doNotMove: session.doNotMove,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [voiding, setVoiding] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/parking-sessions/${session._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          keyNo: form.keyNo ? parseInt(form.keyNo) : 0,
          status: form.status,
        }),
      });
      if (!res.ok) { setError('Failed to update'); return; }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkReturned() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/parking-sessions/${session._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'returned',
          pickedUp: 'picked-up',
          paymentStatus: form.paymentStatus,
          staffOut: form.staffOut,
          keyNo: form.keyNo ? parseInt(form.keyNo) : 0,
        }),
      });
      if (!res.ok) { setError('Failed to update'); return; }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid() {
    if (!confirm('Void this invoice? This cannot be undone.')) return;
    setVoiding(true);
    await fetch(`/api/parking-sessions/${session._id}`, { method: 'DELETE' });
    setVoiding(false);
    onSaved();
  }

  return (
    <Modal open title={`Invoice #${session.invoiceNo}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded p-3 text-sm grid grid-cols-2 gap-1">
          <span className="text-gray-500">Customer:</span><span className="font-medium">{session.customerName}</span>
          <span className="text-gray-500">Rego:</span><span className="font-mono">{session.rego} {session.make}</span>
          <span className="text-gray-500">Stay:</span><span>{session.stay} days</span>
          <span className="text-gray-500">Amount:</span><span className="font-semibold text-[#1e3a5f]">${session.totalPrice.toFixed(2)}</span>
          <span className="text-gray-500">Status:</span>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[session.status] || 'bg-gray-100'}`}>
            {session.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Payment Status"
            value={form.paymentStatus}
            onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}
            options={PAYMENT_OPTIONS}
          />
          <Select
            label="Picked Up"
            value={form.pickedUp}
            onChange={(e) => setForm((f) => ({ ...f, pickedUp: e.target.value }))}
            options={PICKUP_OPTIONS}
          />
          <Input label="Return Date" type="date" value={form.returnDate} onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))} />
          <Input label="Return Time" value={form.returnTime} onChange={(e) => setForm((f) => ({ ...f, returnTime: e.target.value }))} />
          <Input label="Key No" type="number" value={form.keyNo} onChange={(e) => setForm((f) => ({ ...f, keyNo: e.target.value }))} />
          <Input label="Staff Out" value={form.staffOut} onChange={(e) => setForm((f) => ({ ...f, staffOut: e.target.value }))} />
          <div className="flex items-center gap-2 pt-5">
            <input id="doNotMove" type="checkbox" checked={form.doNotMove} onChange={(e) => setForm((f) => ({ ...f, doNotMove: e.target.checked }))} className="rounded border-gray-300" />
            <label htmlFor="doNotMove" className="text-sm text-gray-700">Do Not Move Car</label>
          </div>
        </div>
        <Input label="Invoice Note" value={form.invoiceNote} onChange={(e) => setForm((f) => ({ ...f, invoiceNote: e.target.value }))} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-between gap-2 pt-2 flex-wrap">
          <Button variant="danger" size="sm" onClick={handleVoid} loading={voiding}>
            Void Invoice
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="success" onClick={handleMarkReturned} loading={saving}>
              Mark Returned
            </Button>
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
