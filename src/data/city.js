// Advertising City — layout miasta. CZYSTE DANE (bez three/react) → testowalne headless.
//
// Siatka (metry): pitch 28 = blok 16 + 2×chodnik 2 + jezdnia 8.
//   bloki  → 7×7 kwartałów; stare pięć osi zachowuje kolejność/ID i współrzędne
//   chodnik→ pas 8..10 od środka bloku (tu chodzą piesi)
//   jezdnia→ pas 10..18, tj. wyśrodkowana na ±14, ±42 i ±70 (tam jeżdżą auta)
// Dzięki temu żaden budynek nie stoi na asfalcie, a pieszy nie chodzi po jezdni.
//
// Wszystko jest PARAMETRYCZNE (BLOCK_CENTERS / ROAD_LINES) — powiększanie miasta to zmiana
// tych dwóch tablic, a nie łatanie współrzędnych po plikach.

export const CITY = {
  pitch: 28,
  block: 16,
  road: 8,
  sidewalk: 2,
  grid: 7,          // 7×7 kwartałów (49 bloków, 196 działek)
  ring: 98,         // obwodnica = najbardziej zewnętrzna linia jezdni (±98)
  extent: 112,      // pół-miasta: -112..112
  plotSize: 7,
};

/**
 * Stare osie MUSZĄ zostać na indeksach 0..4: ID p00..p44 są kluczami localStorage.
 * Nowe zachodnie/wschodnie kwartały dopisujemy na końcu zamiast renumerować mapę.
 */
export const BLOCK_CENTERS = [-56, -28, 0, 28, 56, -84, 84];
export const ROAD_LINES = [-98, -70, -42, -14, 14, 42, 70, 98];

export function buildPlots() {
  const plots = [];
  const off = CITY.plotSize / 2 + 0.75; // 4.25 → działka 7×7 siedzi w bloku 16×16 z zapasem
  BLOCK_CENTERS.forEach((cx, i) => {
    BLOCK_CENTERS.forEach((cz, j) => {
      for (const dx of [-1, 1]) {
        for (const dz of [-1, 1]) {
          plots.push({
            id: `p${i}${j}${dx > 0 ? 'e' : 'w'}${dz > 0 ? 's' : 'n'}`,
            x: cx + dx * off,
            z: cz + dz * off,
            w: CITY.plotSize,
            d: CITY.plotSize,
            district: Math.abs(cx) < 1 && Math.abs(cz) < 1 ? 'core' : 'outer',
            park: false,
          });
        }
      }
    });
  });
  // parki: rdzeń (p00*, p22*) + zieleń w pierścieniu zewnętrznym, żeby miasto nie było betonowe
  const parkIds = [
    'p00wn', 'p00ws', 'p22en', 'p22es', 'p01en', 'p10en', 'p21ws', 'p12wn',
    'p04wn', 'p04es', 'p40wn', 'p40es', 'p33wn', 'p11ws', 'p13en', 'p31en',
    'p44wn', 'p44es', 'p24ws', 'p42en',
    // nowe obrzeża: małe parki kieszonkowe rozbijają 196 działek na czytelne dzielnice
    'p50wn', 'p50es', 'p52ws', 'p54en', 'p56wn', 'p56es',
    'p61en', 'p63ws', 'p65en', 'p66wn', 'p66es', 'p55ws',
  ];
  for (const p of plots) if (parkIds.includes(p.id)) p.park = true;
  return plots;
}

export const PLOTS = buildPlots();

export function buildRoads() {
  const roads = [];
  for (const c of ROAD_LINES) {
    roads.push({ id: `rx${c}`, axis: 'x', c, width: CITY.road });
    roads.push({ id: `rz${c}`, axis: 'z', c, width: CITY.road });
  }
  return roads;
}

export const ROADS = buildRoads();

/** Chodniki wokół bloków (render + sprawdzanie pozycji pieszych). */
export function buildSidewalks() {
  const out = [];
  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      out.push({ x: cx, z: cz, w: CITY.block + CITY.sidewalk * 2, d: CITY.block + CITY.sidewalk * 2 });
    }
  }
  return out;
}

export const SIDEWALKS = buildSidewalks();

/** Latarnie: stoją na CHODNIKU wokół kwartału (pas 8..10 od środka bloku), nigdy na jezdni (10..18).
 *  Uwaga: środek jezdni to pitch/2 = 14 — wcześniejsza wersja stawiała latarnie dokładnie tam
 *  („dziwne lampy na środku ulicy", zgłoszenie użytkownika). */
export const LAMP_OFF = 9;                 // środek pasa chodnika
export const LAMP_SIDE = [-6.5, 0, 6.5];   // rozstaw wzdłuż krawędzi (blok ma półszerokość 8)

export function buildLampPosts() {
  const out = [];
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      for (const t of LAMP_SIDE) {
        out.push({ x: bx + t, z: bz + LAMP_OFF });
        out.push({ x: bx + t, z: bz - LAMP_OFF });
        out.push({ x: bx + LAMP_OFF, z: bz + t });
        out.push({ x: bx - LAMP_OFF, z: bz + t });
      }
    }
  }
  return out;
}

export const LAMP_POSTS = buildLampPosts();

/** Skrzyżowania z realnym światłem punktowym (koszt GPU) — środek + dwa węzły.
 *  Współrzędne = realne słupki latarni, żeby światło nie wisiało w losowym miejscu. */
export const LAMP_LIGHTS = [
  { x: 9, z: 0 },
  { x: -34.5, z: 37 },
  { x: 34.5, z: -37 },
];

/** Drzewa i krzaki — deterministyczny PRNG (ten sam las na każdym urządzeniu). */
export function buildTrees() {
  const trees = [];
  let seed = 20260913;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (const p of PLOTS.filter((q) => q.park)) {
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      trees.push({
        x: p.x + (rnd() - 0.5) * (p.w - 2),
        z: p.z + (rnd() - 0.5) * (p.d - 2),
        s: 0.8 + rnd() * 0.9,
        tone: rnd(),
        kind: 'tree',
      });
    }
    // Niskie krzewy przy narożnikach parku: osobna warstwa instancji, bez dodatkowych draw calli.
    // Są odsunięte od krzyżujących się alejek, więc skwer pozostaje czytelny i przechodni.
    const edge = p.w * 0.34;
    for (const [dx, dz] of [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge]]) {
      trees.push({
        x: p.x + dx + (rnd() - 0.5) * 0.45,
        z: p.z + dz + (rnd() - 0.5) * 0.45,
        s: 0.46 + rnd() * 0.2,
        tone: rnd(),
        kind: 'shrub',
      });
    }
  }
  // zielony bufor między obwodnicą a skrajem mapy; wyprowadzony z CITY zamiast starego ±84
  const LANE = CITY.ring + CITY.road / 2 + 5;
  const LANE2 = CITY.extent - 1.5;
  // punkty pomiędzy pasami jezdni — nigdy na asfalcie
  const ALONG = [-91, -81, -63, -53, -35, -25, -7, 7, 25, 35, 53, 63, 81, 91];
  for (const u of ALONG) {
    for (const s of [-1, 1]) {
      trees.push({ x: u, z: s * LANE, s: 1.05, tone: 0.4 });
      trees.push({ x: s * LANE, z: u, s: 1.0, tone: 0.6 });
      trees.push({ x: u, z: s * LANE2, s: 0.9, tone: 0.25 });
      trees.push({ x: s * LANE2, z: u, s: 0.95, tone: 0.7 });
      trees.push({ x: u * 0.9, z: s * (LANE - 4), s: 0.85, tone: 0.3 });
    }
  }
  // zieleń wzdłuż wewnętrznych kwartałów (skwer na każdym skrzyżowaniu pasa zieleni)
  for (const a of [-91, -63, -35, -7, 7, 35, 63, 91]) {
    for (const b of [-91, -63, -35, -7, 7, 35, 63, 91]) {
      if (rnd() < 0.55) trees.push({ x: a, z: b, s: 0.8 + rnd() * 0.5, tone: rnd() });
    }
  }
  return trees;
}

export const TREES = buildTrees();

/** House-ads — startowe budynki, żeby miasto nie było puste (brandy Chrisa). */
export const SEED_BUILDINGS = [
  {
    id: 'b-hfj', plotId: 'p00en', floors: 3, style: 'tower', owner: 'house',
    ad: { layout: 'brand', bg: '#141110', fg: '#FFFFFF', accent: '#FF6A00', title: 'HOME FIRES JERSEY', subtitle: 'Premium fireplaces & flue systems', cta: 'Zobacz realizacje', url: 'https://homefiresjersey.com' },
  },
  {
    id: 'b-nomu', plotId: 'p01wn', floors: 2, style: 'shop', owner: 'house',
    ad: { layout: 'brand', bg: '#0d1512', fg: '#FFFFFF', accent: '#2FA36B', title: 'NOMU SUSHI', subtitle: 'Świeże sushi robione na zamówienie', cta: 'Zamów online', url: 'https://nomu.pl' },
  },
  {
    id: 'b-aiev', plotId: 'p02en', floors: 4, style: 'tower', owner: 'house',
    ad: { layout: 'brand', bg: '#05070d', fg: '#FFFFFF', accent: '#00E7FF', title: 'AI EVOLUTION', subtitle: 'Darmowe szkolenia z AI po polsku', cta: 'Dołącz do nas', url: 'https://aievolution.pl' },
  },
  {
    id: 'b-wrozki', plotId: 'p10ws', floors: 2, style: 'shop', owner: 'house',
    ad: { layout: 'brand', bg: '#120a1c', fg: '#F3E9FF', accent: '#B14BFF', title: 'WROZKI24', subtitle: 'Tarot i numerologia online 24/7', cta: 'Sprawdź kartę', url: 'https://wrozki24.pl' },
  },
  {
    id: 'b-marina', plotId: 'p12en', floors: 3, style: 'tower', owner: 'house',
    ad: { layout: 'brand', bg: '#08131f', fg: '#EAF6FF', accent: '#39B6FF', title: 'MARINA METRO HOTEL', subtitle: 'Nocleg blisko centrum — od 189 zł', cta: 'Rezerwuj', url: 'https://marinametrohotel.pl' },
  },
  {
    id: 'b-alvins', plotId: 'p20ws', floors: 2, style: 'shop', owner: 'house',
    ad: { layout: 'brand', bg: '#1b0d07', fg: '#FFF3E6', accent: '#FF4D2E', title: "ALVIN'S HOT STUFF", subtitle: 'Pizza z pieca, dowóz w 30 minut', cta: 'Zamów teraz', url: 'https://alvinshotstuff.com' },
  },
  {
    id: 'b-strong', plotId: 'p24en', floors: 3, style: 'tower', owner: 'house',
    ad: { layout: 'brand', bg: '#0a0f14', fg: '#FFFFFF', accent: '#7CFF1E', title: 'STRONG BODY & MIND', subtitle: 'Trening i dieta — plan na 12 tygodni', cta: 'Zacznij teraz', url: 'https://strongbody.pl' },
  },
  {
    id: 'b-beaumont', plotId: 'p31ws', floors: 2, style: 'shop', owner: 'house',
    ad: { layout: 'brand', bg: '#101821', fg: '#EAF6FF', accent: '#4FA8E0', title: 'BEAUMONT HOME CENTER', subtitle: 'Materiały i remonty pod klucz', cta: 'Zobacz ofertę', url: 'https://beaumont.pl' },
  },
  {
    id: 'b-smart', plotId: 'p43wn', floors: 4, style: 'tower', owner: 'house',
    ad: { layout: 'brand', bg: '#0b1220', fg: '#FFFFFF', accent: '#39B6FF', title: 'SMART CONCEPT', subtitle: 'Nowoczesne wnętrza i automatyka', cta: 'Umów projekt', url: 'https://smartconcept.pl' },
  },
  {
    id: 'b-ukbff', plotId: 'p34es', floors: 3, style: 'tower', owner: 'house',
    ad: { layout: 'brand', bg: '#141014', fg: '#FFFFFF', accent: '#FFB020', title: 'UKBFF CHANNEL ISLANDS', subtitle: 'Zawody fitness — zgłoś się', cta: 'Zapisy', url: 'https://ukbff.gg' },
  },
];

export const plotById = (id) => PLOTS.find((p) => p.id === id) || null;
