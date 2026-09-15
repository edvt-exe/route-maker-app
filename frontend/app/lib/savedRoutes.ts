import type { RouteData } from "../components/ui/RouteResults";

export type SavedRouteRecord = {
  id: string;
  title: string;
  city: string;
  createdAt: string;
  route: RouteData;
};

const STORAGE_KEY = "triply_saved_routes";

export function loadSavedRoutes(): SavedRouteRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SavedRouteRecord => Boolean(item && typeof item === "object" && item.id && item.route));
  } catch {
    return [];
  }
}

export function saveRouteToHistory(route: RouteData): SavedRouteRecord | null {
  if (typeof window === "undefined") return null;

  const record: SavedRouteRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `route-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: route.title || `${route.city} Trip`,
    city: route.city,
    createdAt: new Date().toISOString(),
    route,
  };

  const existing = loadSavedRoutes();
  const next = [record, ...existing.filter(item => item.id !== record.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 20)));

  return record;
}

export function getSavedRouteById(id: string): SavedRouteRecord | null {
  const routes = loadSavedRoutes();
  return routes.find(route => route.id === id) ?? null;
}
