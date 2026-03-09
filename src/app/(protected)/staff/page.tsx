'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-blue-100 text-blue-800',
  staff: 'bg-gray-100 text-gray-700',
};

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  function openEdit(s: Staff) {
    setEditStaff(s);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditStaff(null);
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this staff member?')) return;
    await fetch(`/api/staff/${id}`, { method: 'DELETE' });
    fetchStaff();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <Button onClick={() => { setEditStaff(null); setShowModal(true); }} size="sm">
          <Plus size={16} /> Add Staff
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              {['Name', 'Email', 'Role', 'Initials', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">Loading…</td></tr>
            ) : staffList.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">No staff found</td></tr>
            ) : (
              staffList.map((s) => (
                <tr key={s._id} className={`hover:bg-gray-50 ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-medium flex items-center gap-2">
                    <Shield size={14} className="text-gray-400" />
                    {s.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.email}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${ROLE_COLORS[s.role]}`}>
                      {ROLE_LABELS[s.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-600">{s.initials}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-[#1e3a5f] hover:text-[#162d4b]">
                        <Edit2 size={15} />
                      </button>
                      {s.active && (
                        <button
                          onClick={() => handleDeactivate(s._id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role permissions info */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-800 mb-2">Role Permissions</h3>
        <ul className="space-y-1 text-blue-700">
          <li><strong>Admin:</strong> Full access — manage staff, customers, billing, reports</li>
          <li><strong>Manager:</strong> Add/edit customers, run billing, view all reports</li>
          <li><strong>Staff:</strong> Create/update invoices and parking sessions only</li>
        </ul>
      </div>

      {showModal && (
        <StaffModal
          staff={editStaff}
          onClose={closeModal}
          onSaved={() => { closeModal(); fetchStaff(); }}
        />
      )}
    </div>
  );
}

/* ===================== STAFF MODAL ===================== */
function StaffModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    role: staff?.role || 'staff',
    initials: staff?.initials || '',
    password: '',
    active: staff?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.name || !form.email) { setError('Name and email required'); return; }
    if (!staff && form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    setError('');
    try {
      const method = staff ? 'PUT' : 'POST';
      const url = staff ? `/api/staff/${staff._id}` : '/api/staff';
      const body: Record<string, unknown> = { ...form };
      if (!body.password) delete body.password;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  return (
    <Modal open title={staff ? 'Edit Staff Member' : 'New Staff Member'} onClose={onClose} size="md">
      <div className="space-y-4">
        <Input label="Full Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <Input
          label={staff ? 'New Password (leave blank to keep)' : 'Password *'}
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder={staff ? 'Leave blank to keep current' : 'Min 8 characters'}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} options={ROLES} />
          <Input label="Initials" value={form.initials} onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))} placeholder="e.g. Flo" maxLength={10} />
        </div>
        {staff && (
          <div className="flex items-center gap-2">
            <input id="staff-active" type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded border-gray-300" />
            <label htmlFor="staff-active" className="text-sm text-gray-700">Active</label>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {staff ? 'Save Changes' : 'Create Staff'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
