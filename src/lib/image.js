// Upload obrazu → data-URL (bez backendu). Downscale w canvas, żeby localStorage nie puchł.
const MAX_SIDE = 1280;
const MAX_BYTES = 1_500_000;

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('To nie jest plik graficzny (PNG/JPG/WEBP/SVG).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      // SVG i małe pliki zostawiamy 1:1; duże zdjęcia przepuszczamy przez canvas
      if (file.type === 'image/svg+xml' || raw.length < 400_000) { resolve(raw); return; }
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * r));
        c.height = Math.max(1, Math.round(img.height * r));
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/jpeg', 0.86);
        if (out.length > MAX_BYTES) out = c.toDataURL('image/jpeg', 0.7);
        resolve(out);
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export function downloadJson(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });
}
