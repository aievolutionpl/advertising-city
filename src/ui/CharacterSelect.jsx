import React, { useEffect, useState } from 'react';
import { CHARACTERS, POIS, characterById, exploreProgress, levelOf } from '../lib/player.js';
import './character-select.css';

const figureStyle = (palette) => ({
  '--skin': palette.skin,
  '--hair': palette.hair,
  '--shirt': palette.shirt,
  '--pants': palette.pants,
  '--shoe': palette.shoe,
  '--accent': palette.accent,
});

const roleLabel = (role) => role === 'Event manager' ? 'Organizator wydarzeń' : role;

function CharacterFigure({ character }) {
  return (
    <div className="cs-figure" style={figureStyle(character.palette)} aria-hidden="true">
      <span className="head" /><span className="neck" /><span className="torso" />
      <span className="accent" /><span className="arm left" /><span className="arm right" />
      <span className="leg left" /><span className="leg right" />
    </div>
  );
}

export function CharacterSelect({ charId, onPick, onStart, player, coins }) {
  const [sel, setSel] = useState(charId || 'maja');
  useEffect(() => setSel(charId || 'maja'), [charId]);
  const char = characterById(sel);
  const lvl = levelOf(player?.xp || 0);
  const prog = exploreProgress(player?.discovered || [], POIS);
  const returning = (player?.xp || 0) > 0 || prog.done > 0;

  const start = () => {
    // Nie zapisuj wyboru przy samym przeglądaniu kart. Powrót z tą samą
    // postacią nie wywoła resetu jej runtime'u ani postępu.
    if (sel !== charId) onPick?.(sel);
    onStart?.();
  };

  return (
    <div className="cs-wrap">
      <main className="cs-card" aria-labelledby="cs-title">
        <div className="cs-scroll">
          <header className="cs-head">
            <div className="cs-brand">
              <span className="cs-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32"><path fill="currentColor" d="M4 27V12h7v15H4Zm9 0V5h7v22h-7Zm9 0V9h6v18h-6ZM2 29h28v2H2z" /></svg>
              </span>
              <div>
                <h1 id="cs-title">Advertising City</h1>
                <p className="cs-kicker">{returning ? `Witaj ponownie · poziom ${lvl.level}` : 'Wybierz bohatera i ruszaj do miasta'}</p>
              </div>
            </div>
            <span className="cs-balance" aria-label={`Saldo ${coins || 0} kredytów`}><b>{(coins || 0).toLocaleString('pl-PL')}</b> AC</span>
          </header>

          <div className="cs-main">
            <section className="cs-stage" aria-label={`Podgląd postaci ${char.name}`}>
              <span className="cs-stage-label">Podgląd w mieście</span>
              <span className="cs-sun" /><span className="cs-skyline" /><span className="cs-road" />
              <CharacterFigure key={char.id} character={char} />
            </section>

            <section className="cs-choices" aria-label="Wybór postaci">
              <p className="cs-prompt">Kim wejdziesz do miasta?</p>
              <div className="cs-grid" role="radiogroup" aria-label="Dostępne postacie">
                {CHARACTERS.map((c) => {
                  const selected = sel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`cs-char ${selected ? 'on' : ''}`}
                      style={{ ...figureStyle(c.palette), '--char-accent': c.palette.accent }}
                      onClick={() => setSel(c.id)}
                    >
                      <span className="cs-mini" aria-hidden="true" />
                      <b>{c.name}</b>
                      <small>{roleLabel(c.role)}</small>
                      <span className="cs-check" aria-hidden="true">✓</span>
                    </button>
                  );
                })}
              </div>

              <div className="cs-picked" aria-live="polite">
                <div className="cs-picked-line"><span>Wybrano</span><b>{char.name}</b><span>{roleLabel(char.role)}</span></div>
                <p>Wygląd i tempo poruszania odpowiadają tej postaci. Pozostałe zasady gry są takie same.</p>
                {returning && <div className="cs-progress">Postęp: poziom {lvl.level} · odkryte miejsca {prog.done}/{prog.total}</div>}
              </div>
            </section>
          </div>
        </div>

        <footer className="cs-actions">
          <button type="button" className="cs-go" onClick={start}>
            {returning && sel === charId ? `Wróć do miasta jako ${char.name}` : `Wejdź do miasta jako ${char.name}`}
          </button>
          <p className="cs-hint">Telefon: D-pad steruje ruchem, przeciągnięcie po mieście obraca kamerę.</p>
        </footer>
      </main>
    </div>
  );
}
