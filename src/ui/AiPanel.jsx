// 🤖 Menedżer AI — panel, w którym agent prowadzi reklamę w Twoim budynku.
// Trzy zakładki: Kampania (generator), Ruch (gdzie warto), Audyt (ocena + poprawki).
// Do tego misja dnia i seria dni — element, który sprawia, że chce się wracać.
import React, { useEffect, useMemo, useState } from 'react';
import { useCity } from '../store.js';
import { PLOTS, plotById } from '../data/city.js';
import {
  AI_MANAGER, auditAd, dailyMission, dayKeyOf, generateCampaign, nextStreak, rankPlots,
} from '../lib/aiManager.js';

const STREAK_KEY = 'ac.ai.streak.v1';
const MODE_KEY = 'ac.ai.mode.v1';

function readJSON(key, fallback) {
  try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return fallback; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* tryb prywatny — pomijamy */ }
}

const ScoreRing = ({ score, grade }) => (
  <div className={`ai-score g-${grade}`}>
    <b>{score}</b>
    <span>ocena {grade}</span>
  </div>
);

export function AiPanel() {
  const selected = useCity((s) => s.selected);
  const buildings = useCity((s) => s.buildings);
  const updateAd = useCity((s) => s.updateAd);
  const select = useCity((s) => s.select);
  const toastMsg = useCity((s) => s.toastMsg);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('campaign');
  const [brand, setBrand] = useState('');
  const [what, setWhat] = useState('');
  const [offer, setOffer] = useState('');
  const [camp, setCamp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(() => readJSON(MODE_KEY, { agent: false }).agent);
  const [streak, setStreak] = useState(() => readJSON(STREAK_KEY, { key: '', days: 0 }));

  const today = dayKeyOf();
  const mission = useMemo(() => dailyMission(today), [today]);
  const b = selected ? buildings[selected] : null;
  const plot = selected ? plotById(selected) : null;
  const mine = !!(b && b.owner === 'player');

  // Seria dni: pierwsze wejście w dniu = +1 (lub reset po przerwie)
  useEffect(() => {
    const next = nextStreak(streak.key, today, streak.days);
    if (next !== streak.days) {
      const val = { key: today, days: next };
      setStreak(val);
      writeJSON(STREAK_KEY, val);
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = useMemo(() => rankPlots(PLOTS.filter((p) => !p.park), 5), []);
  const myTraffic = plot && !plot.park ? plot.traffic ?? 0 : 0;

  const runAI = () => {
    setBusy(true);
    setCamp({ ...generateCampaign({ brand, what, offer }), myTraffic });
    setTab('campaign');
    setBusy(false);
    toastMsg?.(`Agent AI: kampania gotowa — ${brand.trim() || 'Twoja marka'}`);
  };

  const applyVariant = (v) => {
    if (!mine) { toastMsg?.('Najpierw zbuduj własny budynek — wtedy agent wgra tam reklamę.'); return; }
    updateAd(selected, { title: v.title, subtitle: v.subtitle, cta: v.cta, layout: v.layout, bg: v.palette.bg, fg: v.palette.fg, accent: v.palette.accent });
    toastMsg?.('Agent AI: reklama wgrana na Twój billboard ✅');
  };

  const audit = useMemo(
    () => (mine ? auditAd(b.ad, { traffic: myTraffic, floors: b.floors }) : null),
    [mine, b, myTraffic],
  );

  const autoFix = () => {
    if (!mine) return;
    const v = camp?.variants?.[0];
    const patch = {};
    const ad = b.ad || {};
    if (!ad.cta) patch.cta = v?.cta || 'Sprawdź ofertę';
    if (!ad.url) patch.url = '';
    if (!ad.title || ad.title.length > 26) patch.title = v?.title || 'Twoja marka — sprawdź nas';
    if (!ad.subtitle) patch.subtitle = v?.subtitle || 'Lokalnie i bez niespodzianek';
    if (audit && audit.findings.some((f) => f.text.startsWith('Kontrast'))) {
      Object.assign(patch, { bg: v?.palette?.bg || '#0f1a24', fg: v?.palette?.fg || '#ffffff' });
    }
    if (!Object.keys(patch).length) { toastMsg?.('Agent AI: reklama nie wymaga poprawek 👌'); return; }
    updateAd(selected, patch);
    toastMsg?.(`Agent AI: wdrożone poprawki (${Object.keys(patch).join(', ')}) ✅`);
  };

  const toggleMode = () => {
    const val = !mode;
    setMode(val);
    writeJSON(MODE_KEY, { agent: val });
    toastMsg?.(val ? `Tryb agenta AI WŁĄCZONY — ${AI_MANAGER.name} ${AI_MANAGER.version} pilnuje reklamy` : 'Tryb agenta AI wyłączony');
  };

  return (
    <>
      <button className={`ai-fab ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} title="Menedżer AI — reklama w Twoim budynku">
        🤖 <span>Menedżer AI</span>
        {mode && <i className="ai-dot" />}
      </button>

      {open && (
        <aside className="ai-panel">
          <header className="ai-head">
            <div>
              <b>🤖 {AI_MANAGER.name} <span className="muted">{AI_MANAGER.version}</span></b>
              <span className="muted">Twoją reklamą zarządza agent AI</span>
            </div>
            <button className="btn ghost" onClick={() => setOpen(false)}>✕</button>
          </header>

          <div className="ai-mode">
            <label className="ai-switch">
              <input type="checkbox" checked={mode} onChange={toggleMode} />
              <span>{mode ? 'Tryb agenta: WŁĄCZONY' : 'Tryb agenta: wyłączony'}</span>
            </label>
            <div className="ai-streak">🔥 seria <b>{streak.days}</b> {streak.days === 1 ? 'dzień' : 'dni'} · misja dnia: {mission.reward} AC</div>
            <p className="ai-mission">🎯 <b>Misja dnia:</b> {mission.text}</p>
          </div>

          <div className="tabs">
            <button className={`tab ${tab === 'campaign' ? 'on' : ''}`} onClick={() => setTab('campaign')}>✨ Kampania</button>
            <button className={`tab ${tab === 'traffic' ? 'on' : ''}`} onClick={() => setTab('traffic')}>📈 Gdzie warto</button>
            <button className={`tab ${tab === 'audit' ? 'on' : ''}`} onClick={() => setTab('audit')}>🩺 Audyt</button>
          </div>

          {tab === 'campaign' && (
            <div className="ai-body">
              <label className="ai-field">Czym się zajmujesz / co sprzedajesz
                <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="np. sushi i maki w Gdyni, siłownia, kominki, kursy AI" />
              </label>
              <div className="grid2">
                <label className="ai-field">Nazwa marki
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="np. Nomu" />
                </label>
                <label className="ai-field">Twoja przewaga / promocja
                  <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="np. dostawa 30 minut" />
                </label>
              </div>
              <button className="btn primary wide" onClick={runAI} disabled={busy || what.trim().length < 3}>
                {busy ? 'Agent myśli…' : '✨ Wygeneruj kampanię (AI)'}
              </button>

              {camp && (
                <>
                  <p className="fine">Rozpoznana branża: <b>{camp.industryName}</b>. Wybierz wariant — agent wgra go na Twój billboard.</p>
                  {camp.variants.map((v) => (
                    <div className="ai-variant" key={v.id}>
                      <div className="ai-ad" style={{ background: v.palette.bg, color: v.palette.fg, borderColor: v.palette.accent }}>
                        <b>{v.title}</b>
                        <span>{v.subtitle}</span>
                        <em style={{ background: v.palette.accent }}>{v.cta}</em>
                      </div>
                      <button className="btn primary" onClick={() => applyVariant(v)}>Zastosuj ✓</button>
                    </div>
                  ))}
                  <ul className="ai-tips">
                    {camp.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === 'traffic' && (
            <div className="ai-body">
              <p className="fine">Ruch liczy ten sam model, który napędza auta i pieszych w mieście (auta × 12 + piesi × 3,2, korekta o piętra i odległość od centrum).</p>
              <div className="ai-table">
                {top.map((p, i) => (
                  <div className={`ai-row ${selected === p.id ? 'on' : ''}`} key={p.id}>
                    <span className="ai-rank">#{i + 1}</span>
                    <span className="ai-id">{p.id} <em className="muted">{Math.abs(p.x) <= 28 && Math.abs(p.z) <= 28 ? 'centrum' : 'obrzeża'}</em></span>
                    <b>{(p.traffic ?? 0).toLocaleString('pl-PL')}</b>
                    <button className="btn ghost" onClick={() => select(p.id)}>Pokaż</button>
                  </div>
                ))}
              </div>
              {mine ? (
                <p className="fine">Twój budynek: <b>{myTraffic.toLocaleString('pl-PL')}</b> kontaktów/dobę · {b.floors} pięter. {myTraffic < 400 ? 'Agent radzi: rozważ wyższą działkę lub dodaj piętro.' : 'Dobra lokalizacja — trzymaj reklamę aktualną.'}</p>
              ) : (
                <p className="fine">Wybierz działkę z rankingu, żeby agent mógł ustawić tam Twoją reklamę.</p>
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div className="ai-body">
              {!mine && <p className="note">Audyt działa na Twoim budynku — najpierw zbuduj własny (WOLNA DZIAŁKA → Zbuduj budynek).</p>}
              {mine && audit && (
                <>
                  <div className="ai-audit-head">
                    <ScoreRing score={audit.score} grade={audit.grade} />
                    <div className="muted">Ocena liczona z długości nagłówka, kontrastu (WCAG), CTA, linku, obrazu i ruchu przy działce.</div>
                  </div>
                  <ul className="ai-findings">
                    {audit.findings.map((f, i) => (
                      <li key={i} className={f.level}>{f.level === 'ok' ? '✅' : f.level === 'err' ? '⛔' : f.level === 'warn' ? '⚠️' : 'ℹ️'} {f.text}</li>
                    ))}
                  </ul>
                  <button className="btn primary wide" onClick={autoFix}>🪄 Wdróż rekomendacje agenta</button>
                </>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
