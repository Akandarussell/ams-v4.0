import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Building,
  Check,
  CheckCheck,
  Search,
  Shield,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { AppDatabaseState, ChatMessage, UserProfile } from '../types';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { isSameTenantPerson, isMessageAssociatedWithFlat } from '../lib/storage';

interface Props {
  data: AppDatabaseState;
  currentUser: UserProfile;
  onSendMessage: (recipientId: string, recipientName: string, message: string) => void;
  onClearTenantMessages?: (flatId: string) => void;
}

export const ChatSystem: React.FC<Props> = ({
  data,
  currentUser,
  onSendMessage,
  onClearTenantMessages,
}) => {
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Eligible contact list based on user role
  const getContacts = () => {
    if (currentUser.role === 'manager') {
      // Manager can chat with all tenants and owners
      return [
        ...data.profiles.filter((p) => p.id !== currentUser.id),
        ...data.tenants.map((t) => ({
          id: t.id,
          fullName: `${t.fullName} (Flat ${t.flatId})`,
          email: t.email || '',
          phone: t.phone,
          role: 'tenant' as const,
          flatId: t.flatId,
          isActive: true,
          createdAt: t.entryDate,
          entryDate: t.entryDate,
          rawTenantName: t.fullName,
        })),
      ];
    } else if (currentUser.role === 'owner') {
      // Owner can chat with manager and tenants in their block
      const manager = data.profiles.find((p) => p.role === 'manager');
      const blockTenants = data.tenants
        .filter((t) => t.blockName === currentUser.assignedBlock)
        .map((t) => ({
          id: t.id,
          fullName: `${t.fullName} (Flat ${t.flatId})`,
          email: t.email || '',
          phone: t.phone,
          role: 'tenant' as const,
          flatId: t.flatId,
          isActive: true,
          createdAt: t.entryDate,
          entryDate: t.entryDate,
          rawTenantName: t.fullName,
        }));
      return manager ? [manager, ...blockTenants] : blockTenants;
    } else {
      // Tenant can chat with manager and their block owner
      const manager = data.profiles.find((p) => p.role === 'manager');
      const cleanFlat = (currentUser.flatId || '').toLowerCase().trim();
      const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === cleanFlat);
      const upperFlat = cleanFlat.toUpperCase();
      const blockName =
        unit?.blockName ||
        (upperFlat.startsWith('B') ? 'Block B' : upperFlat.startsWith('C') ? 'Block C' : 'Block A');
      const owner = data.profiles.find((p) => p.assignedBlock === blockName);
      const list: UserProfile[] = [];
      if (manager) list.push(manager);
      if (owner) list.push(owner);
      return list;
    }
  };

  const allContacts = getContacts();
  const contacts = allContacts.filter((c) =>
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [activeRecipientId, setActiveRecipientId] = useState<string>(() => {
    if (currentUser.role === 'tenant') {
      return 'user-manager-russell';
    }
    return allContacts[0]?.id || 'user-manager-russell';
  });

  const activeContact = allContacts.find((c) => c.id === activeRecipientId) || contacts[0] || allContacts[0];

  // Keep activeRecipientId in sync whenever activeContact changes or contacts list updates
  useEffect(() => {
    if (activeContact && activeContact.id !== activeRecipientId) {
      setActiveRecipientId(activeContact.id);
    }
  }, [activeContact?.id]);

  // Resolve active tenant for the active contact if it is a tenant
  const activeTenant = activeContact?.role === 'tenant'
    ? data.tenants.find(
        (t) =>
          (activeContact.flatId && t.flatId.toLowerCase() === activeContact.flatId.toLowerCase()) ||
          t.id === activeContact.id
      )
    : undefined;

  // Messages between current user and active contact
  const conversationMessages = (data.chatMessages || []).filter((m) => {
    if (!activeContact) return false;

    const currentFlat = currentUser.flatId?.trim().toUpperCase();
    const activeContactFlat = activeContact.flatId?.trim().toUpperCase();
    const msgFlat = m.flatId?.trim().toUpperCase();

    let isMatch = false;

    if (currentUser.role === 'tenant') {
      // 1. Current user is Tenant chatting with an Authority (Manager or Owner)
      const isWithActiveAuthority =
        m.recipientId === activeContact.id ||
        m.senderId === activeContact.id ||
        (activeContact.role === 'manager' && (
          m.recipientId === 'user-manager-russell' ||
          m.senderId === 'user-manager-russell' ||
          m.recipientRole === 'manager' ||
          m.senderRole === 'manager'
        )) ||
        (activeContact.role === 'owner' && (
          m.recipientId === activeContact.id ||
          m.senderId === activeContact.id ||
          m.recipientRole === 'owner' ||
          m.senderRole === 'owner'
        ));

      const isMyMessage =
        m.senderId === currentUser.id ||
        m.recipientId === currentUser.id ||
        (msgFlat && currentFlat && msgFlat === currentFlat) ||
        (currentFlat ? isMessageAssociatedWithFlat(m, currentFlat) : false);

      isMatch = Boolean(isWithActiveAuthority && isMyMessage);

      // Ensure Tenant only sees current messages (purging previous occupant mock names)
      if (isMatch && m.senderRole === 'tenant') {
        if (!isSameTenantPerson(m.senderName, currentUser.fullName)) {
          return false;
        }
      }
    } else if (activeContact.role === 'tenant') {
      // 2. Current user is Authority (Manager/Owner) chatting with a Tenant
      const isForActiveFlat =
        (msgFlat && activeContactFlat && msgFlat === activeContactFlat) ||
        (activeContactFlat ? isMessageAssociatedWithFlat(m, activeContactFlat) : false) ||
        m.recipientId === activeContact.id ||
        m.senderId === activeContact.id;

      const isBetweenMeAndFlat =
        m.senderId === currentUser.id ||
        m.recipientId === currentUser.id ||
        (currentUser.role === 'manager' && (
          m.recipientId === 'user-manager-russell' ||
          m.senderId === 'user-manager-russell' ||
          (!m.recipientId?.includes('owner') && !m.senderId?.includes('owner'))
        )) ||
        (currentUser.role === 'owner' && (
          m.senderId === currentUser.id ||
          m.recipientId === currentUser.id
        ));

      isMatch = Boolean(isForActiveFlat && isBetweenMeAndFlat);

      // Filter out former mock tenants if flat had occupant change
      if (isMatch && activeTenant) {
        if (m.senderRole === 'tenant' && !isSameTenantPerson(m.senderName, activeTenant.fullName)) {
          return false;
        }
        const lowerSender = (m.senderName || '').toLowerCase();
        const lowerMsg = (m.message || '').toLowerCase();
        if (
          (lowerSender.includes('tanvir') || lowerMsg.includes('tanvir')) &&
          !activeTenant.fullName.toLowerCase().includes('tanvir')
        ) {
          return false;
        }
        if (
          (lowerSender.includes('farhana') || lowerMsg.includes('farhana')) &&
          !activeTenant.fullName.toLowerCase().includes('farhana')
        ) {
          return false;
        }
      }
    } else {
      // 3. Both are Authorities (Manager <-> Owner)
      isMatch =
        (m.senderId === currentUser.id && m.recipientId === activeContact.id) ||
        (m.senderId === activeContact.id && m.recipientId === currentUser.id) ||
        Boolean(
          m.conversationId && (
            m.conversationId === `conv-${activeContact.id}` ||
            m.conversationId === `conv-${currentUser.id}` ||
            (activeContact.id.includes('owner') && m.conversationId.includes(activeContact.id.replace('user-', ''))) ||
            (currentUser.id.includes('owner') && m.conversationId.includes(currentUser.id.replace('user-', '')))
          )
        );
    }

    return isMatch;
  });

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeContact) return;
    onSendMessage(activeContact.id, activeContact.fullName, messageText.trim());
    setMessageText('');
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden h-[calc(100vh-11.5rem)] min-h-[540px] lg:h-[720px] xl:h-[760px] flex flex-col md:flex-row">
      {/* Contact List Sidebar */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col md:h-full bg-slate-50/60 shrink-0">
        <div className="p-3 sm:p-4 border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm">Direct Messages</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                Real-time chat with complex management &amp; tenants
              </p>
            </div>
            <span className="md:hidden px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/80 text-[10px] font-bold">
              {contacts.length} Contacts
            </span>
          </div>
          <div className="mt-2 sm:mt-2.5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-2xl text-base sm:text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex flex-row md:flex-col md:flex-1 overflow-x-auto md:overflow-y-auto md:divide-y md:divide-slate-100 gap-2 md:gap-0 p-2 md:p-0 no-scrollbar">
          {contacts.map((contact) => {
            const isSelected = contact.id === activeRecipientId;
            return (
              <button
                key={contact.id}
                onClick={() => setActiveRecipientId(contact.id)}
                className={`shrink-0 md:shrink w-auto md:w-full max-w-[220px] md:max-w-none text-left px-3 py-2 md:p-3.5 rounded-2xl md:rounded-none flex items-center gap-2.5 md:gap-3 border md:border-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-50/90 border-teal-500 md:border-l-4 md:border-teal-600 shadow-2xs md:shadow-none'
                    : 'bg-white md:bg-transparent border-slate-200/80 hover:bg-slate-100/70'
                }`}
              >
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-br from-teal-600 to-indigo-600 text-white shadow-xs'
                    : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'
                }`}>
                  {contact.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold text-xs truncate ${isSelected ? 'text-teal-950' : 'text-slate-900'}`}>
                      {contact.fullName}
                    </p>
                  </div>
                  <p className="text-[10px] md:text-[11px] text-slate-500 capitalize truncate">
                    {contact.role === 'manager' ? 'Super Admin / Manager' : contact.role === 'owner' ? 'Block Owner' : 'Flat Resident'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="hidden md:block p-3.5 border-t border-slate-200/80 bg-slate-50/80 text-[10px] text-slate-500">
          <p className="font-bold text-slate-800 leading-tight">{COMPLEX_CONFIG.name}</p>
          <p className="truncate text-slate-500 mt-0.5">{COMPLEX_CONFIG.address}</p>
          <p className="text-teal-700 font-semibold mt-1">Hotline: {COMPLEX_CONFIG.contacts}</p>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        {/* Chat Header */}
        {activeContact ? (
          <div className="p-3 sm:p-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {activeContact.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm truncate">
                  {activeContact.fullName}
                </h3>
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                  <span className="truncate">Active Now &bull; {COMPLEX_CONFIG.name}</span>
                  {activeTenant?.entryDate && (
                    <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                      (Tenancy: {activeTenant.entryDate})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onClearTenantMessages && activeContact.flatId && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Clear all conversation messages for Flat ${activeContact.flatId}?`)) {
                      onClearTenantMessages(activeContact.flatId!);
                    }
                  }}
                  title="Purge previous tenant conversation history"
                  className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer text-[11px] flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Clear Chat</span>
                </button>
              )}
              <span className="px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200/70 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {activeContact.role}
              </span>
            </div>
          </div>
        ) : null}

        {/* Message Thread */}
        <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-50/40 to-white">
          {conversationMessages.length === 0 ? (
            <div className="text-center py-12 sm:py-16 text-slate-400 text-xs">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 border border-teal-100">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-700">No messages yet in this conversation.</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto px-4">
                {activeContact?.role === 'tenant'
                  ? `Clean slate for current resident ${activeContact.fullName}. All previous tenant messages have been removed.`
                  : 'Send a message below to start chatting.'}
              </p>
            </div>
          ) : (
            conversationMessages.map((m) => {
              const isMine =
                m.senderId === currentUser.id ||
                (currentUser.role === 'tenant' &&
                  m.senderRole === 'tenant' &&
                  ((m.flatId && currentUser.flatId && m.flatId.toLowerCase() === currentUser.flatId.toLowerCase()) ||
                    isSameTenantPerson(m.senderName, currentUser.fullName)));
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                      isMine
                        ? 'bg-gradient-to-br from-teal-600 to-indigo-600 text-white rounded-br-xs shadow-sm'
                        : 'bg-white border border-slate-200/90 text-slate-900 rounded-bl-xs shadow-2xs'
                    }`}
                  >
                    {!isMine && (
                      <p className="text-[10px] font-bold text-teal-700 mb-0.5">
                        {m.senderName}
                      </p>
                    )}
                    <p className="leading-relaxed break-words">{m.message}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMine ? 'text-teal-100' : 'text-slate-400'}`}>
                      <span>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMine && <CheckCheck className="w-3 h-3 text-teal-100" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-2.5 sm:p-3 border-t border-slate-200/80 bg-white flex items-center gap-2 shrink-0">
          <input
            type="text"
            placeholder="Type your message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1 min-h-[44px] px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-base sm:text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white focus:outline-hidden"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 sm:px-5 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-md shadow-teal-600/20 active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
