// Lightweight i18n: flat string tables per locale + a pure interpolating
// translator. No dependencies, no runtime provider needed for the logic itself,
// so it is trivially unit-testable and usable from any component.
export type Locale = "en" | "hi";

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हि" },
];

// English is the source of truth; every key must exist here. Hindi falls back
// to English per-key when a translation is missing (see translate()).
export const EN: Record<string, string> = {
  "brand.name": "ChainChit",
  "brand.tagline": "Transparent On-Chain Chit Funds",

  "nav.dashboard": "Dashboard",
  "nav.analytics": "Analytics",
  "nav.profile": "Profile",
  "nav.createGroup": "Create Group",
  "nav.planner": "Planner",
  "nav.discover": "Discover",
  "nav.disputes": "Disputes",
  "nav.disconnect": "Disconnect",
  "nav.notConnected": "Not connected",
  "nav.language": "Language",

  "landing.title": "Chit Funds, Reinvented",
  "landing.subtitle":
    "Smart contract custody eliminates fraud. On-chain reputation lets you evaluate strangers before pooling money. Join rotating savings groups beyond your immediate circle — safely.",
  "landing.cta": "Create a pool",
  "landing.goDashboard": "Go to Dashboard",
  "landing.explore": "Explore groups",

  "common.pool": "Pool",
  "common.cycle": "Cycle {n}",
  "common_members": "Members",
};

export const HI: Record<string, string> = {
  "brand.name": "चेनचिट",
  "brand.tagline": "पारदर्शी ऑन-चेन चिट फंड",

  "nav.dashboard": "डैशबोर्ड",
  "nav.analytics": "विश्लेषण",
  "nav.profile": "प्रोफ़ाइल",
  "nav.createGroup": "ग्रुप बनाएँ",
  "nav.planner": "प्लानर",
  "nav.discover": "खोजें",
  "nav.disputes": "विवाद",
  "nav.disconnect": "डिस्कनेक्ट",
  "nav.notConnected": "कनेक्ट नहीं है",
  "nav.language": "भाषा",

  "landing.title": "चिट फंड, नया अवतार",
  "landing.subtitle":
    "स्मार्ट कॉन्ट्रैक्ट अभिरक्षा धोखाधड़ी समाप्त करती है। ऑन-चेन प्रतिष्ठा आपको पैसा जोड़ने से पहले अजनबियों का आकलन करने देती है। अपने तत्काल परिधि से परे घूर्णी बचत समूहों में शामिल हों — सुरक्षित।",
  "landing.cta": "पूल बनाएँ",
  "landing.goDashboard": "डैशबोर्ड पर जाएँ",
  "landing.explore": "ग्रुप देखें",

  "common.pool": "पूल",
  "common.cycle": "चक्र {n}",
  "common_members": "सदस्य",
};

export const DICTIONARIES: Record<Locale, Record<string, string>> = { en: EN, hi: HI };

// Resolve a key for `locale`, interpolating `{var}` placeholders. Falls back to
// English, then to the raw key, so the UI never renders empty.
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = DICTIONARIES[locale]?.[key] ?? EN[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m,
  );
}
