import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Lock, ChevronLeft, ChevronRight, Check, X, Sparkles } from 'lucide-react';
import { formatDateDDSlashMMSlashYYYY } from '../lib/nescoTariff';

interface Props {
  value: string; // ISO format 'YYYY-MM-DD' or flexible date string
  onChange: (isoDate: string) => void;
  isEnabled: boolean; // True if status is Paid or Partially Paid
  label?: string;
  id?: string;
  className?: string;
  lockedReason?: string;
  required?: boolean;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Robust date parser supporting YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or timestamp.
 * Never produces corrupted years or months.
 */
function parseDateFlexible(val?: string): { year: number; month: number; day: number; iso: string } | null {
  if (!val || val === 'N/A' || val === 'null' || val === 'undefined') return null;
  const str = String(val).trim();
  if (!str) return null;

  // 1. Direct regex for ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2100) {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return { year: y, month: m, day: d, iso: `${y}-${mm}-${dd}` };
    }
  }

  // 2. Direct regex for DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2100) {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return { year: y, month: m, day: d, iso: `${y}-${mm}-${dd}` };
    }
  }

  // 3. Fallback for generic Date objects or ISO strings with time
  try {
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return { year: y, month: m, day: d, iso: `${y}-${mm}-${dd}` };
    }
  } catch {
    // fallback
  }

  return null;
}

/**
 * Reusable Date Input strictly enforcing DD/MM/YYYY display format.
 * Features:
 * 1. Synchronized native browser date picker trigger (mobile & desktop).
 * 2. Interactive custom calendar popup that works in all browsers and iframes.
 * 3. Quick rent collection presets: Today, 1st, 5th, 10th of month.
 * 4. Automatic locks in the 'dd/mm/yyyy' position when status is not Paid or Partially Paid.
 */
export const DateInputDDMMYYYY: React.FC<Props> = ({
  value,
  onChange,
  isEnabled,
  label,
  id,
  className = '',
  lockedReason = 'Locked: Select Paid or Partially Paid to set date',
  required = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nativePickerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const parsed = parseDateFlexible(value);

  // Month and Year currently visible in the calendar popover
  const [viewYear, setViewYear] = useState<number>(() => parsed?.year || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsed?.month || new Date().getMonth() + 1);

  // Text representation in DD/MM/YYYY format for display and typing
  const [textValue, setTextValue] = useState<string>(() => (value ? formatDateDDSlashMMSlashYYYY(value) : ''));

  // Sync textValue and view positions when value changes from outside
  useEffect(() => {
    if (value) {
      const p = parseDateFlexible(value);
      if (p) {
        setTextValue(formatDateDDSlashMMSlashYYYY(p.iso));
        setViewYear(p.year);
        setViewMonth(p.month);
      } else {
        setTextValue(formatDateDDSlashMMSlashYYYY(value));
      }
    } else {
      setTextValue('');
    }
  }, [value]);

  // Close calendar popover on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // If disabled, ensure calendar popover is closed
  useEffect(() => {
    if (!isEnabled) {
      setIsOpen(false);
    }
  }, [isEnabled]);

  // Month navigation
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Day selection handler
  const handleSelectDay = (day: number) => {
    const mm = String(viewMonth).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const isoDate = `${viewYear}-${mm}-${dd}`;
    onChange(isoDate);
    setTextValue(`${dd}/${mm}/${viewYear}`);
    setIsOpen(false);
  };

  // Preset shortcut (e.g. 1st, 5th, 10th of current view month)
  const handleSelectPresetDay = (e: React.MouseEvent, targetDay: number) => {
    e.stopPropagation();
    const mm = String(viewMonth).padStart(2, '0');
    const dd = String(targetDay).padStart(2, '0');
    const isoDate = `${viewYear}-${mm}-${dd}`;
    onChange(isoDate);
    setTextValue(`${dd}/${mm}/${viewYear}`);
    setIsOpen(false);
  };

  // Today shortcut
  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const isoDate = `${y}-${mm}-${dd}`;
    setViewYear(y);
    setViewMonth(m);
    onChange(isoDate);
    setTextValue(`${dd}/${mm}/${y}`);
    setIsOpen(false);
  };

  // Clear date
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setTextValue('');
    setIsOpen(false);
  };

  // Native input change handler
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw) {
      const p = parseDateFlexible(raw);
      if (p) {
        onChange(p.iso);
        setTextValue(formatDateDDSlashMMSlashYYYY(p.iso));
        setViewYear(p.year);
        setViewMonth(p.month);
        setIsOpen(false);
      }
    }
  };

  // Open picker via button
  const handleTogglePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEnabled) return;
    
    // Try native picker if supported on touch devices
    if ('ontouchstart' in window && nativePickerRef.current?.showPicker) {
      try {
        nativePickerRef.current.showPicker();
        return;
      } catch {
        // Fall back to popover
      }
    }

    setIsOpen((prev) => !prev);
  };

  // Manual typing handler with live DD/MM/YYYY formatting
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEnabled) return;
    let raw = e.target.value;

    // Filter out non-digit and non-delimiter characters
    raw = raw.replace(/[^\d./-]/g, '');

    // Auto-insert slash after 2 and 5 digits if user is just typing numbers
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length > 0 && !raw.includes('/') && !raw.includes('-')) {
      if (digitsOnly.length <= 2) {
        raw = digitsOnly;
      } else if (digitsOnly.length <= 4) {
        raw = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
      } else {
        raw = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
      }
    }

    setTextValue(raw);

    if (!raw.trim()) {
      onChange('');
      return;
    }

    // Check if full date is complete
    const match = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (match) {
      const dNum = parseInt(match[1], 10);
      const mNum = parseInt(match[2], 10);
      const yNum = parseInt(match[3], 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31 && yNum >= 1970 && yNum <= 2100) {
        const dd = String(dNum).padStart(2, '0');
        const mm = String(mNum).padStart(2, '0');
        onChange(`${yNum}-${mm}-${dd}`);
        setViewYear(yNum);
        setViewMonth(mNum);
      }
    }
  };

  const handleInputBlur = () => {
    if (!isEnabled) return;
    const match = textValue.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
      const dNum = parseInt(match[1], 10);
      const mNum = parseInt(match[2], 10);
      let yNum = parseInt(match[3], 10);
      if (yNum < 100) yNum += 2000;
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31 && yNum >= 1970 && yNum <= 2100) {
        const dd = String(dNum).padStart(2, '0');
        const mm = String(mNum).padStart(2, '0');
        onChange(`${yNum}-${mm}-${dd}`);
        setTextValue(`${dd}/${mm}/${yNum}`);
        return;
      }
    }
    // If not matching a full date, restore from valid value prop or empty
    if (value) {
      setTextValue(formatDateDDSlashMMSlashYYYY(value));
    } else {
      setTextValue('');
    }
  };

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();

  // Today check
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();

  // Year options for dropdown (viewYear - 5 to viewYear + 5)
  const currentBaseYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentBaseYear - 3; y <= currentBaseYear + 6; y++) {
    yearOptions.push(y);
  }

  const nativeIsoValue = parsed ? parsed.iso : '';

  return (
    <div ref={containerRef} className={`relative space-y-1 ${className}`}>
      {/* Hidden native date input for browser native picker */}
      <input
        ref={nativePickerRef}
        type="date"
        value={nativeIsoValue}
        onChange={handleNativeChange}
        disabled={!isEnabled}
        className="sr-only pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />

      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1">
            {label}
            {required && isEnabled && <span className="text-rose-500">*</span>}
          </span>
          {!isEnabled ? (
            <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 select-none">
              <Lock className="w-2.5 h-2.5" /> {lockedReason.includes('Adjusted') ? 'Locked (Adjusted)' : 'Locked (dd/mm/yyyy)'}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleTogglePicker}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
            >
              <span>dd/mm/yyyy</span>
              <Calendar className="w-3 h-3" />
            </button>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Visible Input: Allows typing or clicking to open calendar only when isEnabled is true */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={!isEnabled}
          readOnly={!isEnabled}
          tabIndex={!isEnabled ? -1 : 0}
          value={
            isEnabled
              ? textValue
              : lockedReason.includes('Adjusted') && value
              ? formatDateDDSlashMMSlashYYYY(value)
              : 'dd/mm/yyyy'
          }
          placeholder="dd/mm/yyyy"
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={() => {
            if (isEnabled) {
              setIsOpen(true);
            }
          }}
          className={`w-full pl-3 pr-10 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
            isEnabled
              ? 'bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer shadow-xs'
              : 'bg-slate-100 border border-slate-200 text-slate-400 select-none cursor-not-allowed font-mono tracking-wider'
          }`}
        />

        {/* Action Icon: Static lock icon when disabled (no calendar button at all); Calendar picker trigger button when enabled */}
        {isEnabled ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleTogglePicker}
            className="absolute right-1.5 p-1.5 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer transition-colors"
            title="Click to pick date from calendar"
          >
            <Calendar className="w-4 h-4 text-blue-600" />
          </button>
        ) : (
          <div
            className="absolute right-2 p-1 text-slate-400 pointer-events-none select-none"
            title={lockedReason}
          >
            <Lock className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Locked message under the field */}
      {!isEnabled && (
        <p className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
          <Lock className="w-2.5 h-2.5 shrink-0" />
          <span>{lockedReason}</span>
        </p>
      )}

      {/* Interactive Custom Calendar Popover: Anchored right-0 so it never overflows off modal screen */}
      {isEnabled && isOpen && (
        <div
          className="absolute z-50 mt-1 right-0 top-full bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-72 text-slate-800 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '280px' }}
        >
          {/* Calendar Header with Month/Year Navigation */}
          <div className="flex items-center justify-between gap-1 mb-2 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {MONTH_NAMES_SHORT.map((mName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Presets for rent payment dates */}
          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-slate-100 text-[10px]">
            <span className="text-slate-400 font-medium">Quick:</span>
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={(e) => handleSelectPresetDay(e, 1)}
              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold transition-colors cursor-pointer"
              title="1st of this month"
            >
              1st
            </button>
            <button
              type="button"
              onClick={(e) => handleSelectPresetDay(e, 5)}
              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold transition-colors cursor-pointer"
              title="5th of this month"
            >
              5th
            </button>
            <button
              type="button"
              onClick={(e) => handleSelectPresetDay(e, 10)}
              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold transition-colors cursor-pointer"
              title="10th of this month"
            >
              10th
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((w, idx) => (
              <span
                key={w}
                className={`text-[10px] font-bold py-0.5 ${
                  idx === 5 || idx === 6 ? 'text-rose-500' : 'text-slate-400'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {/* Empty padding cells for first day of week offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="w-8 h-8" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                parsed?.year === viewYear &&
                parsed?.month === viewMonth &&
                parsed?.day === dayNum;
              const isToday =
                todayY === viewYear && todayM === viewMonth && todayD === dayNum;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`w-8 h-8 flex items-center justify-center text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : isToday
                      ? 'border border-blue-500 text-blue-600 font-bold hover:bg-blue-50'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts: Native Picker, Clear, Close */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => {
                if (nativePickerRef.current?.showPicker) {
                  try {
                    nativePickerRef.current.showPicker();
                  } catch {
                    // Fall back
                  }
                }
              }}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
              title="Open browser native calendar"
            >
              <Sparkles className="w-3 h-3 text-blue-500" />
              <span>Native</span>
            </button>

            <div className="flex items-center gap-1.5">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer text-[11px]"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors cursor-pointer text-[11px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
