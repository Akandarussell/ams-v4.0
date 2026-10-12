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
  X,
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
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
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
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-[44px] w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-slate-500 shrink-0">Filter Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="min-h-[44px] w-full sm:w-auto bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="manager">Manager (Super Admin)</option>
              <option value="owner">Block Owners</option>
              <option value="tenant">Tenants</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium shrink-0 self-end sm:self-center">
          {filteredUsers.length} Registered Accounts
        </span>
      </div>

      {/* Mobile User Cards (< md) */}
      <div className="md:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            No user accounts found matching your filter criteria.
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{user.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'manager'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : user.role === 'owner'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {user.role === 'manager' ? 'Super Admin' : user.role === 'owner' ? 'Block Owner' : 'Tenant'}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {user.role === 'owner'
                    ? user.assignedBlock
                    : user.role === 'tenant'
                    ? `Flat ${user.flatId || 'Unassigned'}`
                    : 'All Blocks'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-[11px] text-slate-800 truncate max-w-[200px]">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <a href={`tel:${user.phone}`} className="font-semibold text-blue-600 hover:underline">
                    {user.phone}
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleReset(user.id, user.fullName)}
                  className="min-h-[44px] flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Reset
                </button>
                {user.role !== 'manager' && (
                  <button
                    onClick={() => onToggleUserStatus(user.id)}
                    className={`min-h-[44px] flex-1 flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      user.isActive
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Users Table (Desktop & Tablets >= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="table-scroll-container">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
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
                        className="min-h-[36px] flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        title="Reset Account Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Reset
                      </button>
                      {user.role !== 'manager' && (
                        <button
                          onClick={() => onToggleUserStatus(user.id)}
                          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
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
          <div className="bg-white rounded-2xl shadow-xl max-w-md lg:max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Create Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a new block owner or resident account with encrypted credentials.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs mt-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rashed Chowdhury"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mobile Number</label>
                <input
                  type="text"
                  placeholder="017XX-XXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {data.units.filter((u) => u.unitType === 'residential').map((u) => (
                      <option key={u.flatId} value={u.flatId}>
                        Flat {u.flatId} ({u.blockName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center justify-center"
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
