import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Key,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Building,
} from 'lucide-react';
import { AppDatabaseState, UserProfile, UserRole } from '../types';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  data: AppDatabaseState;
  onAddUser: (user: Omit<UserProfile, 'id' | 'createdAt'>) => void;
  onToggleUserStatus: (userId: string) => void;
  onResetPassword: (userId: string) => void;
}

export const UserManagement: React.FC<Props> = ({
  data,
  onAddUser,
  onToggleUserStatus,
  onResetPassword,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('tenant');
  const [assignedBlock, setAssignedBlock] = useState<'Block A' | 'Block B' | 'Block C'>('Block A');
  const [flatId, setFlatId] = useState('A1');

  const filteredUsers = data.profiles.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    const search = searchTerm.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.phone.includes(search)
    );
  });

  const handleReset = (userId: string, name: string) => {
    onResetPassword(userId);
    setResetMessage(`Password successfully reset for ${name}. Temporary credentials generated.`);
    setTimeout(() => setResetMessage(''), 4000);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    onAddUser({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || '01700-000000',
      role,
      assignedBlock: role === 'owner' ? assignedBlock : undefined,
      flatId: role === 'tenant' ? flatId : undefined,
      isActive: true,
    });
    setFullName('');
    setEmail('');
    setPhone('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            {COMPLEX_CONFIG.name}
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            User Accounts & Role Permissions (RBAC)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {COMPLEX_CONFIG.address}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Manager (Super Admin), Block Owners, and Resident accounts &bull; Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong>
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Create Account
        </button>
      </div>

      {resetMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          {resetMessage}
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Filter Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Roles</option>
              <option value="manager">Manager (Super Admin)</option>
              <option value="owner">Block Owners</option>
              <option value="tenant">Tenants</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium">
          {filteredUsers.length} Registered Accounts
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Block / Flat</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {user.fullName}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    {user.email}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {user.phone}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'manager'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : user.role === 'owner'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {user.role === 'manager' ? 'Super Admin' : user.role === 'owner' ? 'Block Owner' : 'Tenant'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {user.role === 'owner'
                      ? user.assignedBlock
                      : user.role === 'tenant'
                      ? `Flat ${user.flatId || 'Unassigned'}`
                      : 'All Complex Blocks'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleReset(user.id, user.fullName)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
                        title="Reset Account Password"
                      >
                        <Key className="w-3 h-3" />
                        Reset
                      </button>
                      {user.role !== 'manager' && (
                        <button
                          onClick={() => onToggleUserStatus(user.id)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            user.isActive
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-1">Create Account</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new block owner or resident account with encrypted credentials.
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rashed Chowdhury"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. resident@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mobile Number</label>
                <input
                  type="text"
                  placeholder="017XX-XXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900"
                >
                  <option value="tenant">Tenant (Flat Resident)</option>
                  <option value="owner">Block Owner</option>
                  <option value="manager">Manager (Super Admin)</option>
                </select>
              </div>

              {role === 'owner' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assign Block *</label>
                  <select
                    value={assignedBlock}
                    onChange={(e) => setAssignedBlock(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900"
                  >
                    <option value="Block A">Block A</option>
                    <option value="Block B">Block B</option>
                    <option value="Block C">Block C</option>
                  </select>
                </div>
              )}

              {role === 'tenant' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assign Flat *</label>
                  <select
                    value={flatId}
                    onChange={(e) => setFlatId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900"
                  >
                    {data.units.filter((u) => u.unitType === 'residential').map((u) => (
                      <option key={u.flatId} value={u.flatId}>
                        Flat {u.flatId} ({u.blockName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
