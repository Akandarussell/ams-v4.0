import React, { useId } from 'react';
import { ExternalLink } from 'lucide-react';

interface LogiKaalFooterBadgeProps {
  variant?: 'light' | 'dark';
}

/**
 * Displays the official "Developed by LogiKaal Technologies" attribution badge
 * with the LK vector monogram, wordmark logo, and clickable logikaal.com link.
 */
export const LogiKaalFooterBadge: React.FC<LogiKaalFooterBadgeProps> = ({
  variant = 'light',
}) => {
  const rawId = useId();
  const gradId = `lkLogoGrad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isDark = variant === 'dark';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
      <span
        className={`text-[11px] font-semibold tracking-wide uppercase ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        Developed by
      </span>

      <a
        href="https://logikaal.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Developed by LogiKaal Technologies - visit logikaal.com"
        className={`group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border transition-all duration-200 ${
          isDark
            ? 'bg-slate-900/80 border-white/10 hover:border-[#06B6D4]/60 hover:bg-slate-900'
            : 'bg-slate-50/90 border-slate-200/90 hover:border-[#8B5CF6]/50 hover:bg-white shadow-2xs hover:shadow-sm'
        }`}
      >
        {/* Official LK Monogram Emblem */}
        <div className="relative flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-[#0F172A] border border-[#8B5CF6]/40 group-hover:border-[#06B6D4]/70 transition-all duration-300 shrink-0 overflow-hidden shadow-xs">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/25 via-transparent to-[#06B6D4]/25" />
          <svg
            viewBox="0 0 32 32"
            aria-hidden="true"
            className="relative z-10 w-5 h-5 object-contain fill-none stroke-[2.4] shrink-0"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path d="M8 7v18h9" stroke={`url(#${gradId})`} />
            <path d="M16 13l8-6" stroke="#22D3EE" />
            <path d="M18 15l6 10" stroke={`url(#${gradId})`} />
          </svg>
        </div>

        {/* Official LogiKaal Technologies Wordmark Logo */}
        <div className="inline-flex flex-col shrink-0 select-none text-left">
          <span
            className={`text-base font-black tracking-tight leading-none whitespace-nowrap ${
              isDark ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}
          >
            Logi
            <span
              className={`bg-gradient-to-r bg-clip-text text-transparent font-black ${
                isDark
                  ? 'from-[#A78BFA] via-[#8B5CF6] to-[#06B6D4]'
                  : 'from-[#8B5CF6] via-[#7C3AED] to-[#06B6D4]'
              }`}
            >
              Kaal
            </span>
          </span>
          <span
            aria-label="Technologies"
            className={`w-0 min-w-full flex justify-between font-sans text-[7.5px] uppercase font-bold leading-none mt-1 transition-colors ${
              isDark
                ? 'text-slate-400 group-hover:text-[#22D3EE]'
                : 'text-slate-500 group-hover:text-[#7C3AED]'
            }`}
          >
            {'TECHNOLOGIES'.split('').map((ch, idx) => (
              <span key={idx}>{ch}</span>
            ))}
          </span>
        </div>

        {/* Divider & Clickable Site Address */}
        <span
          className={`h-5 w-px mx-0.5 ${
            isDark ? 'bg-white/15' : 'bg-slate-200'
          }`}
        />

        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
            isDark
              ? 'bg-white/5 text-[#22D3EE] group-hover:bg-[#06B6D4]/15'
              : 'bg-white text-teal-700 border border-slate-200/80 group-hover:border-teal-300 group-hover:text-teal-800'
          }`}
        >
          <span>logikaal.com</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </span>
      </a>
    </div>
  );
};
