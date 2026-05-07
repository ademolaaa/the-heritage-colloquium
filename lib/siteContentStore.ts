import { SiteContent } from '../types';

const STORAGE_KEY = 'heritage.siteContent.v3';

export function loadSiteContent(fallback: SiteContent): SiteContent {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    return mergeWithDefaults(fallback, parsed);
  } catch {
    return fallback;
  }
}

export function saveSiteContent(value: SiteContent): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearSiteContent(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function mergeWithDefaults(defaults: SiteContent, override: unknown): SiteContent {
  const merged = deepMerge(defaults, override) as SiteContent;
  merged.nav = mergeNav(defaults.nav, merged.nav);
  return merged;
}

function deepMerge<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }

  if (!isRecord(base)) {
    return (override === undefined ? base : (override as T)) as T;
  }

  if (!isRecord(override)) return base;

  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const baseValue = (base as Record<string, unknown>)[key];
    const overrideValue = override[key];
    result[key] = deepMerge(baseValue, overrideValue);
  }
  for (const key of Object.keys(override)) {
    if (!(key in result)) {
      result[key] = override[key];
    }
  }
  return result as T;
}

function mergeNav(defaultNav: SiteContent['nav'], currentNav: SiteContent['nav']): SiteContent['nav'] {
  const base = Array.isArray(defaultNav) ? defaultNav : [];
  const current = Array.isArray(currentNav) ? currentNav : [];
  const seen = new Set(current.map((x) => x?.path).filter((x): x is string => typeof x === 'string'));
  const missing = base.filter((x) => typeof x?.path === 'string' && !seen.has(x.path));
  return [...current, ...missing];
}

