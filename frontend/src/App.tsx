import { useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import PlaceForm from "./components/PlaceForm";
import { createPlace, deletePlace, listPlaces } from "./api/places";
import type { Category, DraftLocation, LakeSize, Localized, NewPlace, Place } from "./types/place";
import type { OverlayKey } from "./data/overlayMeta";

/** Lowercase + strip diacritics so search is accent-insensitive. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** All searchable text for a localized value (both languages). */
function searchable(value: Localized): string {
  return typeof value === "string" ? value : `${value.es} ${value.en}`;
}

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftLocation | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());
  const [activeSizes, setActiveSizes] = useState<Set<LakeSize>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(true);
  const [overlays, setOverlays] = useState<Set<OverlayKey>>(new Set());

  useEffect(() => {
    listPlaces().then((loaded) => {
      setPlaces(loaded);
      setLoading(false);
    });
  }, []);

  const visiblePlaces = useMemo(() => {
    const q = normalize(query.trim());
    return places.filter((p) => {
      if (activeCategories.size > 0 && !activeCategories.has(p.category)) return false;
      // Size sub-filter refines only lakes; other categories are unaffected.
      if (p.category === "lake" && activeSizes.size > 0 && (!p.size || !activeSizes.has(p.size)))
        return false;
      if (!q) return true;
      return normalize(`${searchable(p.name)} ${searchable(p.description)}`).includes(q);
    });
  }, [places, activeCategories, activeSizes, query]);

  async function handleCreate(input: NewPlace) {
    const created = await createPlace(input);
    setPlaces((prev) => [...prev, created]);
    setDraft(null);
    setFocusedId(created.id);
  }

  async function handleDelete(id: string) {
    await deletePlace(id);
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }

  function toggleCategory(cat: Category) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleSize(size: LakeSize) {
    setActiveSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  }

  function toggleOverlay(key: OverlayKey) {
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="app">
      <Sidebar
        places={visiblePlaces}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        activeSizes={activeSizes}
        onToggleSize={toggleSize}
        overlays={overlays}
        onToggleOverlay={toggleOverlay}
        onSelect={setFocusedId}
        onDelete={handleDelete}
        open={menuOpen}
        onToggle={() => setMenuOpen((o) => !o)}
      />
      <main className="map-pane">
        <MapView
          places={visiblePlaces}
          draft={draft}
          focusedId={focusedId}
          overlays={overlays}
          onMapClick={setDraft}
        />
        {draft && (
          <PlaceForm
            location={draft}
            onSubmit={handleCreate}
            onCancel={() => setDraft(null)}
          />
        )}
      </main>
    </div>
  );
}
