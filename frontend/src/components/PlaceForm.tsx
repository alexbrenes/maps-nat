import { useState, type FormEvent } from "react";
import type { Category, DraftLocation, NewPlace } from "../types/place";
import { CATEGORIES } from "../data/categoryMeta";
import { useI18n } from "../i18n/LanguageContext";

interface PlaceFormProps {
  location: DraftLocation;
  onSubmit: (place: NewPlace) => void | Promise<void>;
  onCancel: () => void;
}

export default function PlaceForm({ location, onSubmit, onCancel }: PlaceFormProps) {
  const { t, categoryLabel } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      category,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setSubmitting(false);
  }

  return (
    <div className="form-overlay">
      <form className="place-form" onSubmit={handleSubmit}>
        <h2>{t.addTitle}</h2>
        <label>
          {t.name}
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label>
          {t.category}
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.description}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <p className="coords">
          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </p>
        <div className="form-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>
            {t.cancel}
          </button>
          <button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
