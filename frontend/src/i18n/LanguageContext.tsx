import { createContext, useContext, useState, type ReactNode } from "react";
import type { Category, Localized } from "../types/place";
import { CATEGORY_META } from "../data/categoryMeta";
import { OVERLAY_META, type OverlayKey } from "../data/overlayMeta";
import { TRANSLATIONS, type Lang } from "./translations";

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  /** UI strings for the active language. */
  t: (typeof TRANSLATIONS)[Lang];
  /** Localized label for a category value. */
  categoryLabel: (c: Category) => string;
  /** Localized label for an overlay layer. */
  overlayLabel: (k: OverlayKey) => string;
  /** Resolve a possibly-bilingual value to the active language. */
  loc: (value: Localized) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const LANG_KEY = "maps-nat.lang";

function initialLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === "en" || saved === "es" ? saved : "es"; // default: Spanish
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }

  const value: I18nValue = {
    lang,
    setLang,
    toggleLang: () => setLang(lang === "es" ? "en" : "es"),
    t: TRANSLATIONS[lang],
    categoryLabel: (c) => CATEGORY_META[c][lang],
    overlayLabel: (k) => OVERLAY_META[k][lang],
    loc: (value) => (typeof value === "string" ? value : value[lang]),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
