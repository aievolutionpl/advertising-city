// Generator tekstur reklam — Canvas 2D → THREE.CanvasTexture. Bez plików, bez fontów do wgrania.
// Czyste helpery (wrapText / contrast / layout) są eksportowane i testowane w node.

export const AD_W = 1024;
export const AD_H = 512;

const FONT = '"Inter", "Segoe UI", Roboto, "DejaVu Sans", Arial, sans-serif';

/** Zawijanie tekstu do maxWidth — czysta funkcja (testowana bez canvasu). */
export function wrapText(text, maxCharsPerLine = 22, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxCharsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = next;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

/** Czy na tle bg lepiej czytać ciemny czy jasny tekst (WCAG-owa luminancja). */
export function pickReadable(bgHex, lightHex = '#ffffff', darkHex = '#0b1020') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(bgHex || ''));
  if (!m) return lightHex;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.45 ? darkHex : lightHex;
}

export function hexToRgba(hex, a = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fitFont(ctx, text, maxWidth, maxSize, weight = 800, minSize = 20) {
  let size = maxSize;
  for (let i = 0; i < 40; i++) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) break;
    size -= 2;
  }
  return size;
}

/**
 * Rysuje billboard reklamowy na canvasie. Trzy layouty:
 *  - brand: logo/nazwa + linia korzyści + CTA (domyślny dla house-ads)
 *  - text : mocny nagłówek, jak klasyczny banner
 *  - image: wgrane zdjęcie/logo na pełnym kadrze + pasek z CTA (naturalne dla uploadu)
 */
export function drawAdCanvas(ad, canvas, opts = {}) {
  const W = opts.width || AD_W;
  const H = opts.height || AD_H;
  const ctx = canvas.getContext('2d');
  const bg = ad?.bg || '#0b1020';
  const fg = ad?.fg || pickReadable(bg);
  const accent = ad?.accent || '#00E7FF';
  const scale = ad?.fontScale || 1;

  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  // tło: gradient + delikatna siatka (żeby kadr nie był „obiektem w próżni")
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, shade(bg, -0.35));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = hexToRgba('#ffffff', 0.05);
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // pasek akcentu
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillRect(0, H - 8, W, 8);

  const pad = 46;

  if (ad?.layout === 'image') {
    const img = getCachedImage(ad.image);
    if (img && img.complete) {
      const r = Math.max(W / img.width, H / img.height);
      const dw = img.width * r;
      const dh = img.height * r;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // scrim, żeby CTA zawsze czytelne
      const sg = ctx.createLinearGradient(0, H * 0.6, 0, H);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, H * 0.6, W, H * 0.4);
    } else {
      ctx.fillStyle = '#1a2233';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `600 ${34}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('wgraj obraz / logo', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
    ctx.font = `800 ${Math.round(46 * scale)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(oneLine(ctx, ad?.title || 'TWOJA MARKA', W - pad * 2 - 6), pad, H - 74);
    drawCta(ctx, ad, pad, H - 56, accent);
  } else if (ad?.layout === 'text') {
    ctx.textAlign = 'left';
    const title = ad?.title || 'TWOJA MARKA';
    const size = fitFont(ctx, title, W - pad * 2, Math.round(126 * scale));
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.fillStyle = fg;
    ctx.fillText(title, pad, pad + size);
    const lines = wrapText(ad?.subtitle || '', 40, 3);
    ctx.font = `500 ${Math.round(38 * scale)}px ${FONT}`;
    ctx.fillStyle = hexToRgba(fg, 0.86);
    lines.forEach((l, i) => ctx.fillText(l, pad, pad + size + 62 + i * 46));
    drawCta(ctx, ad, pad, H - 72, accent);
  } else {
    // brand: logo-blok z inicjałami + nazwa + linia korzyści + CTA + domena
    const initials = (ad?.title || 'AD').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const box = Math.round(112 * scale);
    ctx.fillStyle = accent;
    roundRect(ctx, pad, pad, box, box, 18);
    ctx.fill();
    ctx.fillStyle = pickReadable(accent, '#ffffff', '#0b1020');
    ctx.font = `900 ${Math.round(box * 0.46)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, pad + box / 2, pad + box / 2 + 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const nameX = pad + box + 26;
    const nameMax = W - nameX - pad;
    const nSize = fitFont(ctx, ad?.title || 'TWOJA MARKA', nameMax, Math.round(64 * scale), 900, 22);
    ctx.font = `900 ${nSize}px ${FONT}`;
    ctx.fillStyle = fg;
    ctx.fillText(oneLine(ctx, ad?.title || 'TWOJA MARKA', nameMax), nameX, pad + 46);
    ctx.font = `500 ${Math.round(30 * scale)}px ${FONT}`;
    ctx.fillStyle = hexToRgba(fg, 0.8);
    const sub = wrapText(ad?.subtitle || '', 34, 2);
    sub.forEach((l, i) => ctx.fillText(l, nameX, pad + 46 + 44 + i * 38));
    drawCta(ctx, ad, pad, H - 82, accent);
  }

  // badge „REKLAMA" — uczciwe oznaczanie (i zgodne z EU AI Act / uczciwość reklamowa)
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('REKLAMA · ADVERTISING CITY', W - pad, 52);
  ctx.textAlign = 'left';

  return canvas;
}

function oneLine(ctx, text, maxWidth) {
  const s = String(text || '');
  if (ctx.measureText(s).width <= maxWidth) return s;
  let cut = s;
  while (cut.length > 4 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function drawCta(ctx, ad, x, y, accent) {
  const label = (ad?.cta || 'DOWIEDZ SIĘ WIĘCEJ').toUpperCase();
  ctx.font = `800 30px ${FONT}`;
  const w = ctx.measureText(label).width + 56;
  ctx.fillStyle = accent;
  roundRect(ctx, x, y - 24, w, 58, 29);
  ctx.fill();
  ctx.fillStyle = pickReadable(accent, '#ffffff', '#0b1020');
  ctx.fillText(label, x + 28, y + 14);
  if (ad?.url) {
    ctx.font = `600 24px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const host = String(ad.url).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    ctx.fillText(host, x + w + 22, y + 12);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Ciemniejsza/jaśniejsza wersja koloru (amt<0 ciemniej). */
export function shade(hex, amt = -0.3) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const t = amt < 0 ? 0 : 255;
    return Math.round(v + (t - v) * Math.abs(amt));
  });
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/* --- cache obrazów: nie dekodujemy tego samego data-URL w każdej klatce --- */
const imgCache = new Map();
export function getCachedImage(src) {
  if (!src || typeof Image === 'undefined') return null;
  if (imgCache.has(src)) return imgCache.get(src);
  const img = new Image();
  img.onload = () => { imgCache.set(src, img); };
  img.src = src;
  imgCache.set(src, img);
  return img;
}

export function clearImageCache() { imgCache.clear(); }
