// 🤖 AI Menedżer miasta — CAŁA logika w jednym czystym module (bez Reacta, bez three).
// Dzięki temu: testowalne headless (node --test), a UI tylko wyświetla wynik.
//
// Co robi agent:
//  1. liczy RUCH przy każdej działce (auta + piesi z tej samej symulacji, którą widać w mieście),
//  2. generuje KAMPANIĘ (hasła, linia korzyści, CTA, paleta) na podstawie tego, co sprzedajesz,
//  3. robi AUDYT reklamy (długości, kontrast, CTA, link, widoczność) i daje ocenę 0–100,
//  4. wyznacza MISJĘ DNIA i liczy serię (streak) — po to, żeby wracać do miasta.
import { CITY, ROAD_LINES } from '../data/city.js';

export const AI_MANAGER = { name: 'Menedżer AI', version: 'v1' };

const nearestRoad = (v) => Math.min(...ROAD_LINES.map((r) => Math.abs(v - r)));

/**
 * Ruch „przy budynku” — deterministyczny szacunek na podstawie geometrii miasta:
 * im bliżej jezdni i im bliżej centrum, tym więcej oczu. Wyższy budynek = lepsza widoczność.
 */
export function estimateTraffic(plot, opts = {}) {
  if (!plot || typeof plot.x !== 'number') return 0;
  const cars = opts.cars ?? 54;
  const peds = opts.peds ?? 120;

  const dRoad = nearestRoad(plot.x) + nearestRoad(plot.z);         // metry do dwóch najbliższych jezdni
  const centre = Math.hypot(plot.x, plot.z) / CITY.extent;          // 0 = ścisłe centrum, 1 = obrzeża

  const roadFlow = (cars * 12) / (1 + dRoad / 10);                  // auta w zasięgu wzroku / dobę
  const pedFlow = (peds * 3.2) / (1 + centre * 2.4);                // piesi — im bliżej centrum, tym gęściej
  const height = 1 + 0.12 * Math.max(0, (plot.floors || 1) - 1);    // piętra ponad parter
  const park = plot.park ? 0.35 : 1;                                // parki nie generują przechodniów przy witrynie

  return Math.round((roadFlow + pedFlow) * height * park);
}

/** Ranking działek wg ruchu (agent wskazuje, GDZIE warto postawić reklamę). */
export function rankPlots(plots, limit = 5) {
  return [...plots]
    .map((p) => ({ ...p, traffic: estimateTraffic(p) }))
    .sort((a, b) => b.traffic - a.traffic)
    .slice(0, limit);
}

// ── Generator kampanii ────────────────────────────────────────────────────────
// Wykrywanie branży po słowach kluczowych (PL) — bez API, bez kluczy, działa offline.
const INDUSTRIES = [
  { key: 'sushi', m: /sushi|maki|japoń|japon|ramen|azjatyc/i,
    name: 'Restauracja japońska',
    slogans: ['Świeżość prosto z Tokio', 'Sushi, które pamiętasz', 'Ręcznie zwijane, codziennie'],
    sub: 'Świeże ryby i ryż o idealnej temperaturze', cta: 'Zamów stolik',
    palette: { bg: '#101a2b', fg: '#ffffff', accent: '#ff5a5f' }, layout: 'text' },
  { key: 'fitness', m: /siłowni|silowni|fitness|trening|gym|crossfit|trener|spalanie|masa/i,
    name: 'Klub fitness',
    slogans: ['Twoja forma, nasz plan', 'Trening, który zostaje', 'Siła zaczyna się dzisiaj'],
    sub: 'Karnet bez zobowiązań, trener w cenie', cta: 'Zapisz się',
    palette: { bg: '#12140f', fg: '#f7ffe8', accent: '#7CFF1E' }, layout: 'text' },
  { key: 'hotel', m: /hotel|nocleg|apartament|pokoje|spa|wellness|restauracja w hotelu/i,
    name: 'Hotel',
    slogans: ['Noc, którą zapamiętasz', 'Twój pokój z widokiem', 'Wypoczynek bez kompromisów'],
    sub: 'Śniadanie, spa i parking w cenie', cta: 'Zarezerwuj',
    palette: { bg: '#1b1710', fg: '#fff8ec', accent: '#e0b070' }, layout: 'brand' },
  { key: 'fireplace', m: /kominek|piec|wklad|wkład|flue|komin|fireplace|ogien|ogień/i,
    name: 'Kominki premium',
    slogans: ['Ciepło, które zostaje w domu', 'Kominek skrojony na Twój salon', 'Prawdziwy ogień. Bez dymu.'],
    sub: 'Projekt, montaż i serwis w jednym miejscu', cta: 'Zamów wycenę',
    palette: { bg: '#141a24', fg: '#fff4e6', accent: '#ff8a3d' }, layout: 'brand' },
  { key: 'tarot', m: /tarot|wróżb|wroz|ezoteryk|horoskop|energi|runa|medium/i,
    name: 'Ezoteryka',
    slogans: ['Zobacz, co mówią karty', 'Odpowiedź jest bliżej, niż myślisz', 'Twój rozkład na dziś'],
    sub: 'Konsultacje online i na żywo', cta: 'Rozpocznij',
    palette: { bg: '#1a1030', fg: '#f4ecff', accent: '#b98bff' }, layout: 'text' },
  { key: 'pizza', m: /pizz|burger|kebab|fast ?food|dostaw|jedzenie na wynos/i,
    name: 'Pizza / street food',
    slogans: ['Prosto z pieca, w 30 minut', 'Ciasto, które się ciągnie', 'Głodny? Wiemy, co robić.'],
    sub: 'Dostawa w 30 minut — albo rabat', cta: 'Zamów teraz',
    palette: { bg: '#1c1410', fg: '#fff6ee', accent: '#ffb020' }, layout: 'image' },
  { key: 'property', m: /nieruchom|mieszkani|dom(?!ek)|działk|dzialk|deweloper|biuro nieruchomo/i,
    name: 'Nieruchomości',
    slogans: ['Znajdź miejsce, nie tylko metraż', 'Oglądaj do skutku', 'Adres, do którego chcesz wracać'],
    sub: 'Oferty z rynku i wycena w 24 h', cta: 'Zobacz oferty',
    palette: { bg: '#0f1720', fg: '#eef6ff', accent: '#3f9ae0' }, layout: 'text' },
  { key: 'ai', m: /ai|sztuczna inteligencja|automatyzac|agent|automat|marketing|kurs|szkolen/i,
    name: 'AI / automatyzacja',
    slogans: ['Agent, który pracuje, gdy Ty śpisz', 'Marketing prowadzony przez AI', 'Oszczędź 20 godzin w miesiącu'],
    sub: 'Wdrożenie w 14 dni — bez etatu', cta: 'Bezpłatna konsultacja',
    palette: { bg: '#0b1020', fg: '#ffffff', accent: '#00E7FF' }, layout: 'brand' },
];

const GENERIC = {
  key: 'generic', name: 'Twoja marka',
  slogans: ['Zobacz różnicę od pierwszego dnia', 'Robimy to dobrze, od 10 lat', 'Sprawdź, dlaczego wracają'],
  sub: 'Lokalnie, szybko i bez niespodzianek', cta: 'Sprawdź ofertę',
  palette: { bg: '#0f1a24', fg: '#ffffff', accent: '#3f9ae0' }, layout: 'brand',
};

export function detectIndustry(text = '') {
  const hit = INDUSTRIES.find((i) => i.m.test(text));
  return hit ? { ...hit, matched: true } : { ...GENERIC, matched: false };
}

const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/**
 * Kampania od agenta: 3 warianty nagłówka + linia korzyści + CTA + paleta + wskazówki.
 * `what` = co sprzedajesz; `brand` = nazwa marki; `offer` = przewaga/promocja (opcjonalnie).
 */
export function generateCampaign({ brand = '', what = '', offer = '' } = {}) {
  const ind = detectIndustry(`${what} ${brand} ${offer}`);
  const city = /trójmiast|trojmiast|gdyni|sopot|gdańsk|gdansk|warszaw|krakow|kraków/i.test(what) ? 'lokalnie' : '';
  const prefix = brand.trim() ? `${brand.trim()} — ` : '';

  const variants = ind.slogans.map((s, i) => ({
    id: `v${i + 1}`,
    title: clip(prefix + s, 34),
    subtitle: clip(offer.trim() || ind.sub, 46),
    cta: ind.cta,
    layout: ind.layout,
    palette: ind.palette,
  }));

  const tips = [
    `Branża rozpoznana: ${ind.matched ? ind.name : 'ogólna (dopisz branżę, np. „sushi”, „siłownia”, „kominki” — hasła będą celniejsze)'}.`,
    'Hasło 4–6 słów czyta się z przejeżdżającego auta. Dłuższe = mniej zapamiętane.',
    'Jedno CTA na billboardzie. Dwa przyciski rozmywają decyzję.',
    city ? 'Dodaj konkret miasta (np. „Gdynia”) — lokalne reklamy mają wyższy odsetek kliknięć.' : 'Dodaj lokalizację do hasła — „Tu, obok” sprzedaje lepiej niż „w Polsce”.',
    'Wgraj logo i trzymaj je w tym samym rogu na wszystkich nośnikach — to buduje rozpoznawalność.',
  ];

  return { industry: ind.key, industryName: ind.name, variants, tips, palette: ind.palette };
}

// ── Audyt reklamy ─────────────────────────────────────────────────────────────
const hexToRgb = (h) => {
  const s = (h || '#000000').replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
};
/** Kontrast wg WCAG (0–21). Poniżej 4.5 = tekst trudny do przeczytania z ulicy. */
export function contrastRatio(bg, fg) {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(hexToRgb(bg)), lum(hexToRgb(fg))].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}

export function auditAd(ad = {}, ctx = {}) {
  const findings = [];
  let score = 100;
  const title = ad.title || '';
  const sub = ad.subtitle || '';
  const traffic = ctx.traffic || 0;
  const floors = ctx.floors || 1;

  if (!title) { score -= 30; findings.push({ level: 'err', text: 'Brak nagłówka — billboard nie mówi, co sprzedajesz.' }); }
  else if (title.length > 26) { score -= 8; findings.push({ level: 'warn', text: `Nagłówek ma ${title.length} znaków — skróć do ~24, żeby był czytelny z jezdni.` }); }
  else findings.push({ level: 'ok', text: `Nagłówek ma ${title.length} znaków — czytelny z przejeżdżającego auta.` });

  if (!sub) { score -= 10; findings.push({ level: 'warn', text: 'Brak linii korzyści — dodaj konkret (cena, czas, gwarancja).' }); }
  if (!ad.cta) { score -= 12; findings.push({ level: 'warn', text: 'Brak CTA — bez wezwania do działania billboard tylko „wisi”.' }); }
  if (!ad.url) { score -= 12; findings.push({ level: 'warn', text: 'Brak linku — nie zmierzysz, kto przyszedł z miasta.' }); }
  if (!ad.image) { score -= 6; findings.push({ level: 'warn', text: 'Brak logo/zdjęcia — same litery zapamiętuje się słabiej niż obraz.' }); }

  const cr = contrastRatio(ad.bg, ad.fg);
  if (cr < 4.5) { score -= 12; findings.push({ level: 'err', text: `Kontrast tekstu ${cr}:1 (min. 4.5:1) — z daleka się rozmyje.` }); }
  else findings.push({ level: 'ok', text: `Kontrast ${cr}:1 — czytelne na słońcu i po zmroku.` });

  if (traffic && traffic < 200) { score -= 10; findings.push({ level: 'warn', text: `Ruch przy tej działce to ~${traffic} kontaktów/dobę — rozważ działkę bliżej centrum.` }); }
  else if (traffic) findings.push({ level: 'ok', text: `Szacowany ruch: ~${traffic.toLocaleString('pl-PL')} kontaktów/dobę.` });

  if (floors >= 3 && !ad.image) { score -= 5; findings.push({ level: 'info', text: `Masz ${floors} piętra — wysoki budynek bez logo na elewacji traci darmowy zasięg.` }); }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  return { score, grade, findings };
}

// ── Misja dnia + seria (powód, żeby wracać) ───────────────────────────────────
const MISSIONS = [
  { id: 'buy', text: 'Postaw nowy budynek w dowolnej dzielnicy', reward: 1200 },
  { id: 'floor', text: 'Dodaj jedno piętro do dowolnego budynku', reward: 900 },
  { id: 'ad', text: 'Ustaw lub popraw reklamę (nagłówek + CTA + link)', reward: 800 },
  { id: 'audit', text: 'Zrób audyt AI i wdroż jedną z rekomendacji', reward: 700 },
  { id: 'centre', text: 'Umieść reklamę w kwartale przy centrum (|x|,|z| ≤ 28)', reward: 1100 },
  { id: 'walk', text: 'Przejdź się po mieście w trybie Spacer', reward: 500 },
  { id: 'night', text: 'Zobacz miasto po zmroku (przewiń dobę do nocy)', reward: 600 },
];

/** Misja na dany dzień — deterministyczna (ten sam dzień = ta sama misja dla wszystkich). */
export function dailyMission(dayKey) {
  const key = String(dayKey || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  return { ...MISSIONS[h % MISSIONS.length], date: key };
}

export const dayKeyOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Seria dni z rzędu: wczoraj → +1, dziś → bez zmian, starsze → reset do 1. */
export function nextStreak(prevKey, todayKey, prevStreak = 0) {
  if (prevKey === todayKey) return prevStreak || 1;
  const day = 86400000;
  const diff = Math.round((Date.parse(`${todayKey}T00:00:00`) - Date.parse(`${prevKey}T00:00:00`)) / day);
  if (diff === 1) return (prevStreak || 0) + 1;
  return 1;
}

/** Komunikaty agenta wyświetlane na holobillboardzie w mieście (rotujące). */
export const AI_TIPS = [
  'Agent AI: reklama bez CTA to dekoracja.',
  'Agent AI: 4–6 słów na billboardzie. Reszta się nie mieści w pamięci.',
  'Agent AI: logo w tym samym rogu na każdym nośniku.',
  'Agent AI: mierz link — inaczej nie wiesz, czy miasto działa.',
  'Agent AI: kontrast min. 4,5:1 albo giniesz w południowym słońcu.',
  'Agent AI: piętro wyżej = darmowy zasięg na całą ulicę.',
];
