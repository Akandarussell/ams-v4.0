import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, History, Clock } from 'lucide-react';
import { AppDatabaseState } from '../types';
import { formatDateDDMMYYYY } from '../lib/nescoTariff';

interface Props {
  data: AppDatabaseState;
}

export const AuditLogView: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = data.auditLogs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    const search = searchTerm.toLowerCase();
    return (
      log.details.toLowerCase().includes(search) ||
      log.performedBy.toLowerCase().includes(search) ||
      log.entity.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <History className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              System Audit Logs & Financial Integrity Trail
            </h1>
            <p className="text-xs text-slate-500">
              Immutable log of every financial transaction, tariff change, meter assessment, and advance adjustment
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Search audit details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="min-h-[44px] bg-white border border-slate-300 text-base sm:text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Actions</option>
              <option value="CREATE_BILL">CREATE_BILL</option>
              <option value="RECORD_PAYMENT">RECORD_PAYMENT</option>
              <option value="ADJUST_ADVANCE">ADJUST_ADVANCE</option>
              <option value="UPDATE_TARIFF">UPDATE_TARIFF</option>
            </select>
          </div>

          <span className="text-slate-500 font-medium">
            {filteredLogs.length} Audit Entries
          </span>
        </div>

        {/* Mobile Cards View (Smartphones) */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-sans">
              No audit records found matching your filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(log.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                  </span>
                </div>
                <p className="text-xs text-slate-900 font-medium leading-relaxed">
                  {log.details}
                </p>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    By: <strong className="text-slate-800 font-semibold">{log.performedBy}</strong>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {log.entity}: {log.entityId}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Timestamp (Asia/Dhaka)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-purple-700 font-sans">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-sans">
                    {log.entity}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {log.entityId}
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-900 max-w-md">
                    {log.details}
                  </td>
                  <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                    {log.performedBy}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-sans text-[11px]">
                    {new Date(log.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
