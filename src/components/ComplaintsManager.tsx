import React, { useState } from 'react';
import {
  AlertCircle,
  PlusCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  X,
  Filter,
  User,
  Wrench,
  Droplet,
  Zap,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  AppDatabaseState,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  UserProfile,
} from '../types';
import { formatDateDDMMYYYY } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  data: AppDatabaseState;
  currentUser: UserProfile;
  onSubmitComplaint: (category: ComplaintCategory, subject: string, description: string) => void;
  onUpdateComplaintStatus: (complaintId: string, status: ComplaintStatus) => void;
  onAddComplaintMessage: (complaintId: string, message: string) => void;
}

export const ComplaintsManager: React.FC<Props> = ({
  data,
  currentUser,
  onSubmitComplaint,
  onUpdateComplaintStatus,
  onAddComplaintMessage,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);

  // New Complaint Form
  const [category, setCategory] = useState<ComplaintCategory>('Water');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Reply message
  const [replyMessage, setReplyMessage] = useState('');

  // Filter complaints based on Role
  const filteredComplaints = data.complaints.filter((c) => {
    // Tenant can only see their own flat complaints
    if (currentUser.role === 'tenant') {
      if (c.flatId !== currentUser.flatId) return false;
    }
    // Block Owner can only see their block's complaints
    if (currentUser.role === 'owner') {
      if (c.blockName !== currentUser.assignedBlock) return false;
    }
    // Category & Status filters
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    onSubmitComplaint(category, subject.trim(), description.trim());
    setSubject('');
    setDescription('');
    setIsSubmitModalOpen(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComplaint || !replyMessage.trim()) return;
    onAddComplaintMessage(activeComplaint.id, replyMessage.trim());
    // update current active complaint modal
    setActiveComplaint((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `cm-${Date.now()}`,
            senderName: currentUser.fullName,
            senderRole: currentUser.role,
            message: replyMessage.trim(),
            timestamp: new Date().toISOString(),
          },
        ],
      };
    });
    setReplyMessage('');
  };

  const getCategoryIcon = (cat: ComplaintCategory) => {
    switch (cat) {
      case 'Water':
        return <Droplet className="w-4 h-4 text-blue-500" />;
      case 'Electricity':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Plumbing':
        return <Wrench className="w-4 h-4 text-cyan-600" />;
      case 'Security':
        return <Shield className="w-4 h-4 text-rose-500" />;
      case 'Cleaning':
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-500" />;
    }
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
            Maintenance & Complaints Ticketing
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {COMPLEX_CONFIG.address}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Emergency Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong>
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Submit New Complaint
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Categories</option>
              <option value="Water">Water</option>
              <option value="Electricity">Electricity</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Lift">Lift</option>
              <option value="Security">Security</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium">
          {filteredComplaints.length} Tickets Found
        </span>
      </div>

      {/* Complaints List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredComplaints.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500 text-sm">
            No complaints found for the selected criteria.
          </div>
        ) : (
          filteredComplaints.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-slate-100 rounded-lg">
                      {getCategoryIcon(c.category)}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      {c.category} &bull; Flat {c.flatId} ({c.blockName})
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      c.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'In Progress'
                        ? 'bg-amber-100 text-amber-800'
                        : c.status === 'Rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mt-1">{c.subject}</h3>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{c.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-500">
                  <span>Reported by <strong>{c.tenantName}</strong></span>
                  <p className="text-[10px] text-slate-400">{formatDateDDMMYYYY(c.submissionDate)}</p>
                </div>

                <div className="flex items-center gap-2">
                  {currentUser.role !== 'tenant' && (
                    <select
                      value={c.status}
                      onChange={(e) => onUpdateComplaintStatus(c.id, e.target.value as ComplaintStatus)}
                      className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-[11px] font-semibold"
                    >
                      <option value="Submitted">Submitted</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  )}

                  <button
                    onClick={() => setActiveComplaint(c)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Thread ({c.messages.length})
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* COMPLAINT DETAIL & THREAD MODAL */}
      {activeComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-700 uppercase">
                  Ticket #{activeComplaint.id.toUpperCase()} &bull; Flat {activeComplaint.flatId}
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">
                  {activeComplaint.subject}
                </h3>
              </div>
              <button
                onClick={() => setActiveComplaint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 border-b border-slate-100 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl my-3">
              <p className="font-semibold text-slate-900 mb-1">Issue Description:</p>
              <p>{activeComplaint.description}</p>
              <div className="mt-2 text-[11px] text-slate-400">
                Submitted by {activeComplaint.tenantName} on {formatDateDDMMYYYY(activeComplaint.submissionDate)}
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
              <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                Activity & Responses
              </h4>

              {activeComplaint.messages.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-2">
                  No replies yet. Technicians or managers will post updates here.
                </p>
              ) : (
                activeComplaint.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border ${
                      m.senderRole === 'manager'
                        ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between font-bold text-[11px] mb-1">
                      <span>{m.senderName} ({m.senderRole.toUpperCase()})</span>
                      <span className="text-slate-400 font-normal">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs">{m.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Reply Input */}
            <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type an update or instruction..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW COMPLAINT MODAL */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Submit Maintenance Ticket</h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Water">Water Supply / Tank</option>
                  <option value="Electricity">Electricity / Generator</option>
                  <option value="Plumbing">Plumbing / Leakage</option>
                  <option value="Lift">Lift / Elevator</option>
                  <option value="Security">Security / Intercom</option>
                  <option value="Cleaning">Cleaning & Waste Disposal</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master bathroom tap leaking"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Please describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
