export const MEDIA_CATEGORIES = [
  'AHIAJOKU ARTS & CRAFTS',
  'AHIAJOKU COSMOLOGY',
  'AHIAJOKU CULINARY CULTURE',
  'AHIAJOKU DIASPORA PROGRAM',
  'AHIAJOKU DIGITAL ARCHIVES & LIBRARY',
  'AHIAJOKU KNOWLEDGE & RESEARCH',
  'AHIAJOKU MOVIES REELS CLIPS INTERVIEWS DOCUMENTARIES',
  'BACKGROUND IMAGE',
  'EZEJI FESTIVAL',
  'GALLERY',
  'Governing council & management',
  'GOVERNMENT & CULTURE',
  'NEWS & BLOG',
  'past SPEAKERS'
] as const;

export type MediaCategory = typeof MEDIA_CATEGORIES[number];

export const SYSTEM_CATEGORIES = [
  'BACKGROUND IMAGE',
  'GALLERY',
  'Governing council & management',
  'NEWS & BLOG',
  'past SPEAKERS'
] as const satisfies readonly MediaCategory[];

export const PROGRAM_CATEGORIES = MEDIA_CATEGORIES.filter(
  (c) => !(SYSTEM_CATEGORIES as readonly string[]).includes(c)
) as unknown as readonly MediaCategory[];

export const categoryTitle = (category: string) => {
  if (category === 'AHIAJOKU MOVIES REELS CLIPS INTERVIEWS DOCUMENTARIES') {
    return 'Movies, Clips & Documentaries';
  }
  return category
    .replace(/^AHIAJOKU\s+/i, '')
    .replace(/\bPROGRAM\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
