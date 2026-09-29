export type Lang = "es" | "en";

export const LANGS: Lang[] = ["es", "en"];

/** UI strings per language. (Category labels live in data/categoryMeta.ts.) */
interface Dict {
  subtitle: string;
  search: string;
  loading: string;
  empty: string;
  delete: string;
  addTitle: string;
  name: string;
  category: string;
  description: string;
  cancel: string;
  save: string;
  saving: string;
  newPlaceHere: string;
  attribution: string;
  hidePanel: string;
  showPanel: string;
  boundaries: string;
}

export const TRANSLATIONS: Record<Lang, Dict> = {
  es: {
    subtitle: "Lugares especiales · haz clic en el mapa para agregar uno",
    search: "Buscar lugares…",
    loading: "Cargando…",
    empty: "Aún no hay lugares.",
    delete: "Eliminar",
    addTitle: "Agregar un lugar especial",
    name: "Nombre",
    category: "Categoría",
    description: "Descripción",
    cancel: "Cancelar",
    save: "Guardar lugar",
    saving: "Guardando…",
    newPlaceHere: "Nuevo lugar aquí…",
    attribution: "Datos de referencia: Esencial Costa Rica",
    hidePanel: "Ocultar panel",
    showPanel: "Mostrar panel",
    boundaries: "Límites",
  },
  en: {
    subtitle: "Special places · click the map to add one",
    search: "Search places…",
    loading: "Loading…",
    empty: "No places yet.",
    delete: "Delete",
    addTitle: "Add a special place",
    name: "Name",
    category: "Category",
    description: "Description",
    cancel: "Cancel",
    save: "Save place",
    saving: "Saving…",
    newPlaceHere: "New place here…",
    attribution: "Reference data: Esencial Costa Rica",
    hidePanel: "Hide panel",
    showPanel: "Show panel",
    boundaries: "Boundaries",
  },
};
