function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(/\s+/g).filter(Boolean);
}

export function matchesQuery(haystack, query) {
  const q = tokenize(query);
  if (q.length === 0) return true;
  const h = normalizeText(haystack);
  if (!h) return false;
  return q.every((t) => h.includes(t));
}

export function scoreMatch(haystack, query) {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const h = normalizeText(haystack);
  let score = 0;
  for (const t of q) {
    if (h.includes(t)) score += 1;
  }
  return score;
}

