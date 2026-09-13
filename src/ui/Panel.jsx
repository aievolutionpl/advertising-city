// Panel działki: kupno, rozbudowa i edytor reklamy (logo/obraz/kolory/CTA) z podglądem na żywo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCity } from '../store.js';
import { CITY, plotById } from '../data/city.js';
import {
  rentCost, buildCost, purchaseCost, upgradeCost, MAX_FLOORS, AD_LIMITS, billboardCost, SHAPES,
} from '../lib/economy.js';
import { drawAdCanvas, AD_W, AD_H } from '../lib/adTexture.js';
import { fileToDataUrl } from '../lib/image.js';

function AdPreview({ ad }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const paint = () => drawAdCanvas(ad, ref.current, { width: 1024, height: 512 });
    paint();
    const t = [150, 600].map((ms) => setTimeout(paint, ms));
    return () => t.forEach(clearTimeout);
  }, [ad]);
  return <canvas ref={ref} className="preview" width={AD_W} height={AD_H} />;
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}{hint && <em> ({hint})</em>}</span>
      {children}
    </label>
  );
}

function AdEditor({ b }) {
  const updateAd = useCity((s) => s.updateAd);
  const ad = b.ad;
  const [draft, setDraft] = useState(ad);
  useEffect(() => setDraft(ad), [b.plotId]);
  const fileRef = useRef();
  const set = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const allowed = ['title', 'subtitle', 'cta', 'url', 'bg', 'fg', 'accent', 'layout', 'image', 'fontScale'];
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
    if (Object.keys(clean).length) updateAd(b.plotId, clean);
  };

  const LAYOUTS = [
    ['brand', '🎨 Marka', 'Nazwa + logo + CTA — klasyczny billboard'],
    ['text', '✍️ Nagłówek', 'Duży tekst i linia korzyści — czytelne z daleka'],
    ['image', '🖼️ Zdjęcie', 'Twoje zdjęcie/logo wypełnia billboard'],
  ];

  return (
    <div className="editor">
      <div className="tabs">
        {LAYOUTS.map(([k, l]) => (
          <button key={k} className={`tab ${draft.layout === k ? 'on' : ''}`} onClick={() => set({ layout: k })} title={LAYOUTS.find((x) => x[0] === k)[2]}>{l}</button>
        ))}
      </div>

      <div className="preview-wrap">
        <AdPreview ad={draft} />
        <span className="preview-tag">podgląd 1:1 na budynku</span>
      </div>

      <Field label="Nazwa / nagłówek" hint={`max ${AD_LIMITS.title}`}>
        <input value={draft.title || ''} maxLength={AD_LIMITS.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Linia korzyści" hint={`max ${AD_LIMITS.subtitle}`}>
        <input value={draft.subtitle || ''} maxLength={AD_LIMITS.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
      </Field>
      <div className="grid2">
        <Field label="Przycisk CTA"><input value={draft.cta || ''} maxLength={AD_LIMITS.cta} onChange={(e) => set({ cta: e.target.value })} /></Field>
        <Field label="Link do strony"><input placeholder="https://twojadomena.pl" value={draft.url || ''} onChange={(e) => set({ url: e.target.value })} /></Field>
      </div>

      <div className="grid3">
        <Field label="Tło"><input type="color" value={draft.bg || '#0b1020'} onChange={(e) => set({ bg: e.target.value })} /></Field>
        <Field label="Tekst"><input type="color" value={draft.fg || '#ffffff'} onChange={(e) => set({ fg: e.target.value })} /></Field>
        <Field label="Akcent"><input type="color" value={draft.accent || '#00E7FF'} onChange={(e) => set({ accent: e.target.value })} /></Field>
      </div>

      <Field label="Skala tekstu" hint={`${Math.round((draft.fontScale || 1) * 100)}%`}>
        <input
          type="range" min="0.7" max="1.6" step="0.05"
          value={draft.fontScale || 1}
          onChange={(e) => set({ fontScale: Number(e.target.value) })}
        />
      </Field>

      <div className="row wrap">
        <button className="btn primary" onClick={() => fileRef.current?.click()}>📷 Wgraj logo lub zdjęcie marki</button>
        {draft.image && <button className="btn ghost" onClick={() => set({ image: '', layout: 'brand' })}>Usuń obraz</button>}
        <input
          ref={fileRef} type="file" accept="image/*" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const dataUrl = await fileToDataUrl(f);
              set({ image: dataUrl, layout: 'image' });
              useCity.getState().toastMsg('Obraz wgrany — widoczny na billboardzie');
            } catch {
              useCity.getState().toastMsg('Nie udało się wczytać obrazu.');
            }
            e.target.value = '';
          }}
        />
      </div>

      {draft.image && (
        <div className="thumb-row">
          <img className="thumb" src={draft.image} alt="Wgrane logo / zdjęcie marki" />
          <div className="thumb-info">
            <b>Wgrany obraz</b>
            <span className="muted">Układ „Zdjęcie": obraz wypełnia billboard. Układ „Marka": obraz + Twoja nazwa i CTA.</span>
          </div>
        </div>
      )}

      <p className="fine">
        Wgrany obraz zapisuje się lokalnie w przeglądarce (bez serwera). Maks. ~1,5 MB po kompresji.
        Najlepiej wyglądają pliki poziome (np. 1600×800) — pionowe są kadrowane do środka.
      </p>
    </div>
  );
}

export function Panel() {
  const selected = useCity((s) => s.selected);
  const buildings = useCity((s) => s.buildings);
  const coins = useCity((s) => s.coins);
  const buy = useCity((s) => s.buy);
  const upgrade = useCity((s) => s.upgrade);
  const select = useCity((s) => s.select);
  const buildShape = useCity((s) => s.buildShape);
  const setBuildShape = useCity((s) => s.setBuildShape);
  const plot = selected ? plotById(selected) : null;
  const b = selected ? buildings[selected] : null;

  /* ranking wysokości — „wyróżnij się na tle miasta" */
  const rank = useMemo(() => {
    if (!selected) return '—';
    const heights = Object.values(buildings)
      .map((x) => ((x.floors || 1) * 3.5 + 0.55))
      .sort((p, q) => q - p);
    const myH = ((b?.floors || 1) * 3.5 + 0.55);
    const above = heights.filter((h) => h > myH).length;
    return above + 1;
  }, [buildings, selected, b]);

  const stats = useMemo(() => {
    if (!selected) return null;
    const rent = rentCost(plot);
    const build = buildCost(plot);
    const shape = SHAPES[buildShape] || SHAPES.tower;
    const total = purchaseCost(plot, buildShape);
    return { rent, build, shape, total, district: plot?.district, after: coins - total };
  }, [selected, plot, buildShape, coins]);

  if (!selected || !plot) return null;

  return (
    <aside className="panel" aria-label="Panel budowania i reklamy">
      <header className="panel-head">
        <div>
          <span className="panel-kicker">{b ? 'ZARZĄDZANIE BUDYNKIEM' : 'NOWA INWESTYCJA'}</span>
          <b>{b ? (b.owner === 'player' ? 'Twój budynek' : 'Budynek demonstracyjny') : 'Wolna działka'}</b>
          <span className="muted">{stats.district === 'core' ? 'Centrum' : 'Obrzeża'} · działka {selected}</span>
        </div>
        <button className="btn ghost panel-close" aria-label="Zamknij panel" onClick={() => select(null)}>✕</button>
      </header>

      {plot.park && (
        <p className="note">🌳 Teren zielony — parki zostają parkami. Wybierz wolną działkę.</p>
      )}

      {!b && !plot.park && stats && (
        <div className="build-flow">
          <div className="build-steps" aria-label="Etapy budowy">
            <span className="done"><i>1</i>Działka</span><span className="active"><i>2</i>Typ</span><span><i>3</i>Budowa</span>
          </div>

          <section className="build-section">
            <div className="build-section-head">
              <div><span className="eyebrow">KROK 2</span><h3>Wybierz typ budynku</h3></div>
              <b className="balance">Saldo {coins.toLocaleString('pl-PL')} AC</b>
            </div>
            <div className="shape-grid" role="radiogroup" aria-label="Typ budynku">
              {Object.values(SHAPES).map((shape) => {
                const price = purchaseCost(plot, shape.id);
                return (
                  <button
                    key={shape.id}
                    className={`shape-card ${buildShape === shape.id ? 'on' : ''}`}
                    role="radio"
                    aria-checked={buildShape === shape.id}
                    onClick={() => setBuildShape(shape.id)}
                  >
                    <span className="shape-icon">{shape.icon}</span>
                    <span><b>{shape.label}</b><small>{shape.floors} {shape.floors === 1 ? 'piętro' : 'piętra'} · {shape.note}</small></span>
                    <strong>{price.toLocaleString('pl-PL')} AC</strong>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="build-summary">
            <div className="kv"><span>Wynajem działki</span><b>{stats.rent.toLocaleString('pl-PL')} AC</b></div>
            <div className="kv"><span>Budowa bazowa</span><b>{stats.build.toLocaleString('pl-PL')} AC</b></div>
            <div className="kv"><span>Typ: {stats.shape.label}</span><b>{stats.shape.extra >= 0 ? '+' : '−'}{Math.abs(stats.shape.extra).toLocaleString('pl-PL')} AC</b></div>
            <div className="kv total"><span>Do zapłaty</span><b>{stats.total.toLocaleString('pl-PL')} AC</b></div>
            <div className={`balance-after ${stats.after < 0 ? 'is-error' : ''}`}>
              <span>Saldo po budowie</span><b>{Math.max(0, stats.after).toLocaleString('pl-PL')} AC</b>
            </div>
            {stats.after < 0 && <p className="funds-error" role="alert">Brakuje {(stats.total - coins).toLocaleString('pl-PL')} AC. Wybierz tańszy typ albo poczekaj na wpływy.</p>}
            <button className="btn primary wide build-cta" disabled={stats.after < 0} onClick={() => buy(selected)}>
              {stats.after < 0 ? 'Brak środków' : `Zbuduj: ${stats.shape.icon} ${stats.shape.label}`}
            </button>
            <p className="fine">Po budowie od razu ustawisz reklamę, logo i link.</p>
          </section>
        </div>
      )}

      {b && (
        <>
          <div className="box">
            {b.owner === 'player' && <div className="build-success">✓ Budynek działa. Teraz rozbuduj go lub ustaw billboard.</div>}
            <div className="kv"><span>Piętra</span><b>{b.floors} / {MAX_FLOORS}</b></div>
            <div className="bar"><i style={{ width: `${(b.floors / MAX_FLOORS) * 100}%` }} /></div>
            <div className="kv"><span>Wysokość</span><b>{((b.floors || 1) * 3.5 + 0.55).toFixed(1)} m · {rank}. miejsce w mieście</b></div>
            <div className="kv"><span>Wartość billboardu</span><b>{billboardCost(b.floors)} AC</b></div>
            <div className="kv"><span>Styl</span><b>{b.style === 'tower' ? 'wieżowiec' : 'lokal usługowy'}</b></div>
            {b.owner === 'player' && (
              (() => {
                const price = upgradeCost(b.floors);
                const missing = Math.max(0, price - coins);
                return (
                  <>
              <button
                className="btn primary wide upgrade-cta"
                disabled={b.floors >= MAX_FLOORS || missing > 0}
                onClick={() => upgrade(b.plotId)}
              >
                {b.floors >= MAX_FLOORS
                  ? 'Maksymalna wysokość — jesteś na szczycie'
                  : missing > 0
                    ? `Brakuje ${missing.toLocaleString('pl-PL')} AC do rozbudowy`
                    : `⬆️ Rozbuduj do ${b.floors + 1} pięter — ${price.toLocaleString('pl-PL')} AC`}
              </button>
                    {b.floors < MAX_FLOORS && <div className="upgrade-balance">Po rozbudowie: {Math.max(0, coins - price).toLocaleString('pl-PL')} AC</div>}
                  </>
                );
              })()
            )}
            {b.owner === 'player' && b.floors < MAX_FLOORS && (
              <p className="fine">
                Każde piętro = wyższy budynek, większy billboard i mocniejsze wyróżnienie na tle miasta.
                Kolejne piętra kosztują coraz więcej — rośnie Twój prestiż i wartość billboardu.
              </p>
            )}
            {b.owner === 'house' && (
              <p className="fine">To budynek demonstracyjny. Wybierz wolną działkę, żeby zbudować własny i nim zarządzać.</p>
            )}
          </div>
          {b.owner === 'player' && <><h4 className="sec">Billboard</h4><AdEditor b={b} /></>}
          {b.owner === 'player' && b.ad?.url && (
            <a className="btn wide" href={b.ad.url} target="_blank" rel="noreferrer noopener">🔗 Otwórz stronę reklamodawcy</a>
          )}
        </>
      )}
    </aside>
  );
}
