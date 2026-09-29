import type { Category, Place } from "../types/place";
import { CATEGORIES, CATEGORY_META } from "../data/categoryMeta";
import { OVERLAY_KEYS, OVERLAY_META, type OverlayKey } from "../data/overlayMeta";
import { useI18n } from "../i18n/LanguageContext";
import { LANGS } from "../i18n/translations";

interface SidebarProps {
  places: Place[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  activeCategories: Set<Category>;
  onToggleCategory: (c: Category) => void;
  overlays: Set<OverlayKey>;
  onToggleOverlay: (k: OverlayKey) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  places,
  loading,
  query,
  onQueryChange,
  activeCategories,
  onToggleCategory,
  overlays,
  onToggleOverlay,
  onSelect,
  onDelete,
  open,
  onToggle,
}: SidebarProps) {
  const { t, lang, setLang, loc, categoryLabel, overlayLabel } = useI18n();

  return (
    <aside className={"sidebar" + (open ? " sidebar-open" : " sidebar-closed")}>
      <header className="sidebar-header">
        <div className="sidebar-title-row">
          <button
            className="menu-toggle"
            onClick={onToggle}
            aria-expanded={open}
            title={open ? t.hidePanel : t.showPanel}
            aria-label={open ? t.hidePanel : t.showPanel}
          >
            <span className={"menu-caret" + (open ? " menu-caret-open" : "")}>▸</span>
            <h1>Costa Rica</h1>
          </button>
          <div className="lang-toggle" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l}
                className={"lang-option" + (lang === l ? " lang-option-active" : "")}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="sidebar-body">
        <div className="sidebar-scroll">
          <div className="sidebar-top">
              <p className="sidebar-subtitle">{t.subtitle}</p>
              <input
                className="search-input"
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
              />
            </div>

            <div className="filters">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={"chip" + (activeCategories.has(c) ? " chip-active" : "")}
                  onClick={() => onToggleCategory(c)}
                >
                  {CATEGORY_META[c].emoji} {categoryLabel(c)}
                </button>
              ))}
            </div>

            <div className="overlays">
              <span className="overlays-title">{t.boundaries}</span>
              <div className="overlay-chips">
                {OVERLAY_KEYS.map((k) => (
                  <button
                    key={k}
                    className={"chip" + (overlays.has(k) ? " chip-active" : "")}
                    onClick={() => onToggleOverlay(k)}
                    aria-pressed={overlays.has(k)}
                  >
                    {OVERLAY_META[k].emoji} {overlayLabel(k)}
                  </button>
                ))}
              </div>
            </div>

            <div className="place-list">
              {loading && <p className="muted">{t.loading}</p>}
              {!loading && places.length === 0 && <p className="muted">{t.empty}</p>}
              {places.map((p) => (
                <div key={p.id} className="place-item">
                  <button className="place-item-main" onClick={() => onSelect(p.id)}>
                    <span className="place-name">
                      {CATEGORY_META[p.category].emoji} {loc(p.name)}
                    </span>
                    <span className="place-cat">{categoryLabel(p.category)}</span>
                  </button>
                  <button className="place-delete" title={t.delete} onClick={() => onDelete(p.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <footer className="sidebar-footer">{t.attribution}</footer>
        </div>
    </aside>
  );
}
