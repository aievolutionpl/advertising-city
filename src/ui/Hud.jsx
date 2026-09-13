// HUD: minimalny pasek + menu „☰" (mobile-first) + nakładka trybu gry (spacer).
// Zasada: w mieście widać tylko to, co potrzebne; reszta chowa się w menu jednym kliknięciem.
import React, { useEffect, useState } from 'react';
import { useCity } from '../store.js';
import { VIEWS } from '../scene/Scene.jsx';
import { POIS, exploreProgress, levelOf } from '../lib/player.js';
import { playerRuntime } from '../scene/playerRuntime.js';
import { CharacterSelect } from './CharacterSelect.jsx';
import { useDevice } from './useDevice.js';
import { EASTER_EGGS, eventFeed } from '../lib/events.js';

import { dayRuntime } from '../scene/dayRuntime.js';
import { PLOTS } from '../data/city.js';

const MODES = [
  ['iso', '🏙️', 'Panorama'],
  ['kino', '🎬', 'Kino'],
  ['top', '🗺️', 'Plan'],
  ['walk', '🚶', 'Spacer'],
];
const SPEEDS = [
  ['pause', '⏸'],
  ['real', '1×'],
  ['fast', '⏩'],
  ['epic', '⚡'],
];

/* ── ekran startowy (wybór postaci) ── */
export function Intro() {
  const started = useCity((s) => s.started);
  const enter = useCity((s) => s.enter);
  const charId = useCity((s) => s.charId);
  const setChar = useCity((s) => s.setChar);
  const player = useCity((s) => s.player);
  const coins = useCity((s) => s.coins);
  const clock = useCity((s) => s.clock);
  if (started) return null;
  return <CharacterSelect charId={charId} player={player} coins={coins} clock={clock} onPick={setChar} onStart={enter} />;
}

/* ── główny HUD ── */
export function Hud() {
  const started = useCity((s) => s.started);
  const mode = useCity((s) => s.mode);
  const setMode = useCity((s) => s.setMode);
  const clock = useCity((s) => s.clock);
  const timeSpeed = useCity((s) => s.timeSpeed);
  const setTimeSpeed = useCity((s) => s.setTimeSpeed);
  const coins = useCity((s) => s.coins);
  const player = useCity((s) => s.player);
  const perf = useCity((s) => s.perf);
  const setPerf = useCity((s) => s.setPerf);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(true);
  const dev = useDevice();
  // Tablet landscape / responsywny viewport też dostaje pełne kontrolki, nie tylko touch-UA.
  const touch = dev.touch || dev.w <= 1100;
  const feed = eventFeed(dayRuntime.hours);
  const walk = mode === 'walk';
  const drive = useCity((s) => s.drive);

  const dayOverride = useCity((s) => s.dayOverride);
  const setDayOverride = useCity((s) => s.setDayOverride);
  const buildings = useCity((s) => s.buildings);
  const select = useCity((s) => s.select);

  useEffect(() => { if (!walk) setMenu(false); }, [walk]);

  /* Desktop: naciśnięcie WASD/strzałek od razu przełącza w tryb chodzenia —
     bez tego „chodzenie nie działa", bo gracz zostaje w kamerze miasta. */
  useEffect(() => {
    if (!started) return;
    const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const onKey = (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (MOVE.includes(e.code) && useCity.getState().mode !== 'walk') useCity.getState().setMode('walk');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  if (!started) return null;

  const lvl = levelOf(player.xp || 0);
  const prog = exploreProgress(player.discovered || [], POIS);
  const eggs = EASTER_EGGS.filter((e) => (player.discovered || []).includes(e.id));

  return (
    <>
      {/* pasek górny — zawsze widoczny, ale cienki */}
      <div className="hud-bar">
        <div className="hb-left">
          <span className="hb-coins" title="Kredyty">🪙 {coins?.toLocaleString('pl-PL')}</span>
          {!walk && <span className="hb-clock" title="Czas w mieście">🕒 {clock}</span>}
        </div>
        <div className="hb-right">
          {/* 🎮 gra ↔ kamera miasta: przycisk widoczny ZAWSZE (także na tablecie/telefonie) */}
          <button
            className={`btn play ${walk ? 'on' : ''}`}
            title={walk ? 'Wróć do kamery miasta' : 'Tryb gry: chodź po mieście i wsiądź do auta'}
            onClick={() => useCity.getState().setMode(walk ? 'iso' : 'walk')}
          >
            <span className="bi">{walk ? '←' : '🎮'}</span><span>{walk ? 'MIASTO' : 'GRAJ'}</span>
          </button>
          {/* desktop: widoki i czas na wierzchu */}
          <div className="hud-desktop">
            <div className="seg">
              {MODES.filter(([m]) => m !== 'walk').map(([m, ico, label]) => (
                <button key={m} className={`btn ${mode === m ? 'on' : ''}`} title={label} onClick={() => setMode(m)}>
                  <span className="bi">{ico}</span><span>{label}</span>
                </button>
              ))}
            </div>

            <div className="seg">
              {SPEEDS.map(([sp, ico]) => (
                <button key={sp} className={`btn tiny ${timeSpeed === sp ? 'on' : ''}`} onClick={() => setTimeSpeed(sp)} title={`Tempo czasu: ${sp}`}>{ico}</button>
              ))}
            </div>
            <div className="seg">
              <button
                className={`btn tiny ${dayOverride !== null ? 'on' : ''}`}
                title="Włącz dzień / noc (ręcznie)"
                onClick={() => setDayOverride(dayOverride !== null ? null : (dayRuntime.hours >= 6 && dayRuntime.hours < 19 ? 23 : 12))}
              >{dayRuntime.hours >= 6 && dayRuntime.hours < 19 ? '☀️' : '🌙'}</button>
              <button
                className={`btn tiny ${perf === 'light' ? 'on' : ''}`}
                title={perf === 'light' ? 'Tryb lekki włączony (bez cieni) — kliknij, by wrócić do pełnej grafiki' : 'Włącz tryb lekki (słabsze GPU / płynniej)'}
                onClick={() => setPerf(perf === 'light' ? 'auto' : 'light')}
              >🧊</button>
            </div>
          </div>
          {/* mobile: jedna ikona */}
          <button className="btn hb-burger" onClick={() => setMenu((v) => !v)} title="Menu">{menu ? '✕' : '☰'}</button>
        </div>
      </div>

      {/* co się dzieje teraz w mieście */}
      {!walk && feed.length > 0 && (
        <div className="hud-feed">
          {feed.map((e) => <span key={e.id}>{e.emoji} {e.name}</span>)}
        </div>
      )}

      {/* minimalistyczne menu (mobile / po kliknięciu ☰) */}
      {menu && (
        <div className="hud-menu">
          <div className="hm-label">🎥 Widok kamery</div>
          <div className="hm-row">
            {MODES.filter(([m]) => m !== 'walk').map(([m, ico, label]) => (
              <button key={m} className={`btn wide ${mode === m ? 'on' : ''}`} onClick={() => { setMode(m); setMenu(false); }}>{ico} {label}</button>
            ))}
          </div>
          <button
            className={`btn wide game ${walk ? 'on' : ''}`}
            onClick={() => { useCity.getState().setMode(walk ? 'iso' : 'walk'); setMenu(false); }}
          >
            {walk ? '🏙️ Wróć do kamery miasta' : '🎮 Wejdź do gry — chodzenie i auto'}
          </button>
          <div className="hm-row hm-time">
            {SPEEDS.map(([sp, ico]) => (
              <button key={sp} className={`btn ${timeSpeed === sp ? 'on' : ''}`} onClick={() => setTimeSpeed(sp)}>{ico}</button>
            ))}
            <button
              className={`btn ${dayOverride !== null ? 'on' : ''}`}
              onClick={() => setDayOverride(dayOverride !== null ? null : (dayRuntime.hours >= 6 && dayRuntime.hours < 19 ? 23 : 12))}
            >{dayRuntime.hours >= 6 && dayRuntime.hours < 19 ? '☀️ Dzień' : '🌙 Noc'}</button>
          </div>
          <div className="hm-row hm-build-shortcut">
            <div><div className="hm-label">🏗️ Budowanie</div><span>Typ, pełny koszt i saldo wybierzesz przy działce.</span></div>
            <button className="btn wide" onClick={() => {
              const free = PLOTS.find((p) => !p.park && !buildings[p.id]);
              if (free) select(free.id);
              setMenu(false);
            }}>Wybierz wolną działkę →</button>
          </div>

          {/* easter eggi: podpowiedź + postęp odkryć */}
          <div className="hm-eggs">
            <div className="hm-label">🥚 Easter eggi {eggs.length}/{EASTER_EGGS.length}</div>
            {EASTER_EGGS.map((e) => {
              const done = (player.discovered || []).includes(e.id);
              return (
                <div key={e.id} className={`egg ${done ? 'done' : ''}`}>
                  <span>{done ? '✅' : '❔'}</span>
                  <span><b>{done ? e.name : '???'}</b> · {done ? `+${e.xp} XP` : e.hint}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* nakładka trybu gry */}
      {walk && (
        <>
          <div className="walk-cross" aria-hidden="true" />
          {touch && (
            <div className="walk-touch">
              <button className="wt-btn" onPointerDown={() => (playerRuntime.want.jump = true)}>SKOK</button>
            </div>
          )}

          {/* ── AUTO: jedno kliknięcie. Przy aucie → wsiadanie; dalej → przywołanie auta ── */}
          {!drive.on && (
            <div className="car-bar">
              {drive.near
                ? <button className="btn primary car-enter" onClick={() => window.__car?.enter()}>🚗 Wsiądź do auta <b>E</b></button>
                : <button className="btn primary car-enter" onClick={() => window.__car?.summon()}>🚗 Przywołaj auto</button>}
            </div>
          )}
          {help && !drive.on && (
            <div className="walk-help">
              <b>🎮 Jak chodzić:</b>
              <span><b>W A S D</b> / strzałki — ruch · <b>Shift</b> — bieg · <b>Space</b> — skok · <b>E</b> — wsiądź do auta · <b>przeciągnij myszką</b> — rozglądanie</span>
              <button className="wl-x" onClick={() => setHelp(false)}>✕</button>
            </div>
          )}
          {drive.on && (
            <div className="drive-hud">
              <div className="speedo">
                <b>{Math.round(drive.kmh)}</b><span>km/h</span>
                {drive.boost && <i className="nos">NOS</i>}
              </div>
              <div className="speedbar"><b style={{ width: `${Math.min(100, (drive.kmh / 140) * 100)}%` }} /></div>
              <div className="drive-help">WSAD — jazda · Shift — NOS · Space — hamulec · E — wysiądź</div>
              {touch && (
                <div className="drive-touch">
                  <button className="dt-btn" onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))}>◀</button>
                  <button className="dt-btn wide" onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))}>GAZ</button>
                  <button className="dt-btn" onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }))}>▶</button>
                  <button className="dt-btn" onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))}>HAMULEC</button>
                  <button className="dt-btn" onPointerDown={() => window.__car?.exit()}>WYSIĄDŹ</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── komunikat (toast) ── */
export function Toast() {
  const toast = useCity((s) => s.toast);
  const toastMsg = useCity((s) => s.toastMsg);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => toastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toast, toastMsg]);
  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}

/* ── klauzula AI (obowiązkowa na każdej stronie) ── */
export function ClauseBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`clause ${open ? 'open' : ''}`}>
      {open && (
        <p>
          Ten serwis jest w 100% prowadzony przez agenta AI. Treści i reklamy mogą zawierać błędy —
          weryfikuj samodzielnie przed podjęciem decyzji. Dane miasta (budynki, reklamy, postęp) trzymane są
          lokalnie w Twojej przeglądarce.
        </p>
      )}
      <button className="btn tiny ghost" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ukryj informację AI' : 'ℹ️ Serwis AI'}
      </button>
    </div>
  );
}

export { VIEWS };
