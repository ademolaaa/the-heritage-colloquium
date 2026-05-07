type PlaceholderImageOptions = {
  width: number;
  height: number;
  label?: string;
};

export function placeholderImageDataUri({ width, height, label }: PlaceholderImageOptions): string {
  const safeLabel = (label ?? '').trim();
  const text = safeLabel.length > 0 ? safeLabel : `${width}×${height}`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs>`,
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="#0b0b0f"/>`,
    `<stop offset="0.5" stop-color="#1a1a22"/>`,
    `<stop offset="1" stop-color="#7a5b1a"/>`,
    `</linearGradient>`,
    `<radialGradient id="v" cx="50%" cy="45%" r="70%">`,
    `<stop offset="0" stop-color="rgba(0,0,0,0)"/>`,
    `<stop offset="1" stop-color="rgba(0,0,0,0.55)"/>`,
    `</radialGradient>`,
    `<filter id="noise">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>`,
    `<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .22 0"/>`,
    `</filter>`,
    `</defs>`,
    `<rect width="100%" height="100%" fill="url(#g)"/>`,
    `<rect width="100%" height="100%" fill="url(#v)"/>`,
    `<rect width="100%" height="100%" filter="url(#noise)" opacity="0.6"/>`,
    `<rect x="${Math.max(16, Math.round(width * 0.04))}" y="${Math.max(16, Math.round(height * 0.06))}" width="${Math.max(0, width - Math.max(32, Math.round(width * 0.08)))}" height="${Math.max(0, height - Math.max(32, Math.round(height * 0.12)))}" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)"/>`,
    `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.78)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="${Math.max(18, Math.round(Math.min(width, height) * 0.06))}" letter-spacing="0.04em">`,
    `${escapeXml(text)}`,
    `</text>`,
    `</svg>`
  ].join('');

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
