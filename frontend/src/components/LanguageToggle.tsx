"use client";

import { LOCALES } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";

// Compact two-segment pill switch (EN / हि) living in the navbar; the whole app
// re-renders through the shared LanguageProvider on change.
export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <div
      className="flex items-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5"
      role="group"
      aria-label={t("nav.language")}
    >
      {LOCALES.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            onClick={() => setLocale(l.code)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 ${
              active
                ? "bg-gradient-to-r from-indigo-600/30 to-violet-600/30 text-indigo-300 border border-indigo-500/30"
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}
