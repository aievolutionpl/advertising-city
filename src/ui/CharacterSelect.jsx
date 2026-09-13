// 🎮 Ekran startowy jak w grze: wybierz postać → wejdź do miasta.
// Każda postać ma inny styl, tempo i „specialność" — wybór ma znaczenie, nie jest ozdobą.
import React, { useState } from 'react';
import { CHARACTERS, POIS, characterById, exploreProgress, levelOf } from '../lib/player.js';

export function CharacterSelect({ charId, onPick, onStart, player, coins, clock }) {
  const [sel, setSel] = useState(charId || 'maja');
  const char = characterById(sel);
  const lvl = levelOf(player?.xp || 0);
  const prog = exploreProgress(player?.discovered || [], POIS);

  return (
    <div className="cs-wrap">
      <div className="cs-card">
        <header className="cs-head">
          <div>
            <h1>🏙️ Advertising City</h1>
            <p className="cs-sub">Wybierz postać i wejdź do miasta. Zwiedzaj dzielnice, odkrywaj punkty, zarabiaj kredyty i stawiaj budynki z reklamami.</p>
          </div>
          <div className="cs-stats">
            <span>🪙 <b>{coins?.toLocaleString('pl-PL')}</b></span>
            <span>🕒 <b>{clock}</b></span>
          </div>
        </header>

        <div className="cs-grid">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className={`cs-char ${sel === c.id ? 'on' : ''}`}
              onClick={() => { setSel(c.id); onPick?.(c.id); }}
              title={c.blurb}
            >
              <span className="cs-avatar" style={{ background: `linear-gradient(160deg, ${c.palette.shirt} 0 55%, ${c.palette.pants} 55% 100%)` }}>
                <i style={{ background: c.palette.skin }} />
                <em style={{ background: c.palette.accent }} />
              </span>
              <b>{c.name}</b>
              <small>{c.role}</small>
            </button>
          ))}
        </div>

        <div className="cs-picked">
          <b>{char.name}</b> · {char.role}
          <p>{char.blurb}</p>
          <div className="cs-bars">
            <span>Tempo: <i style={{ width: `${Math.round(char.speed * 60)}%` }} /></span>
            <span>Zwiedzanie: <i style={{ width: `${20 + prog.ratio * 80}%` }} /></span>
          </div>
          {lvl.level > 1 && <p className="cs-lvl">⭐ Poziom {lvl.level} — {lvl.title} ({player.xp} XP, odkryte {prog.done}/{prog.total})</p>}
        </div>

        <button className="btn primary wide cs-go" onClick={() => { onPick?.(sel); onStart?.(); }}>
          ▶ Wejdź do miasta jako {char.name}
        </button>
        <p className="cs-hint">
          Sterowanie: <b>WASD</b> ruch · <b>Shift</b> bieg · <b>Spacja</b> skok · <b>mysz</b> rozglądanie · <b>1–4</b> widoki · <b>P</b> spacer.
          Na telefonie: joystick po lewej, przeciągnięcie palcem = rozglądanie, przyciski <b>SKOK</b> i <b>BIEG</b>.
        </p>
      </div>
    </div>
  );
}
