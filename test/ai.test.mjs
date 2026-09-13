// Testy AI Menedżera — czysta logika, więc mierzymy realne liczby (bez przeglądarki).
import test from 'node:test';
import assert from 'node:assert/strict';

import { PLOTS, plotById } from '../src/data/city.js';
import {
  estimateTraffic, rankPlots, generateCampaign, detectIndustry, auditAd, contrastRatio,
  dailyMission, nextStreak, dayKeyOf, AI_TIPS,
} from '../src/lib/aiManager.js';

test('AI: ruch jest deterministyczny, dodatni i wyższy przy centrum niż na obrzeżach', () => {
  const centre = plotById('p22en') || PLOTS.find((p) => p.x === 0 && !p.park);
  const edge = PLOTS[PLOTS.length - 1];
  const a = estimateTraffic(centre);
  const b = estimateTraffic(edge);
  assert.ok(a > 0 && b > 0);
  assert.equal(a, estimateTraffic(centre), 'ten sam input = ten sam wynik');
  assert.ok(a > b, `centrum (${a}) powinno mieć więcej ruchu niż obrzeża (${b})`);
  assert.equal(estimateTraffic(null), 0);
  assert.equal(estimateTraffic({ park: true, x: 0, z: 0 }) > 0, true);
});

test('AI: wyższe piętro = większy zasięg, park = mniej przechodniów', () => {
  const p = { x: 7, z: 7, floors: 1 };
  assert.ok(estimateTraffic({ ...p, floors: 4 }) > estimateTraffic(p));
  assert.ok(estimateTraffic({ ...p, park: true }) < estimateTraffic(p));
});

test('AI: ranking działek posortowany malejąco i przycięty do limitu', () => {
  const top = rankPlots(PLOTS, 5);
  assert.equal(top.length, 5);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].traffic >= top[i].traffic);
  assert.equal(rankPlots(PLOTS, 3).length, 3);
});

test('AI: rozpoznaje branżę po słowach kluczowych (PL) i daje 3 warianty kampanii', () => {
  assert.equal(detectIndustry('robimy najlepsze sushi w Gdyni').key, 'sushi');
  assert.equal(detectIndustry('siłownia i trening personalny').key, 'fitness');
  assert.equal(detectIndustry('wklady kominkowe i piecyki').key, 'fireplace');
  assert.equal(detectIndustry('kursy z AI i automatyzacja marketingu').key, 'ai');
  assert.equal(detectIndustry('sprzedaję losowe rzeczy').matched, false);

  const camp = generateCampaign({ brand: 'Nomu', what: 'sushi i maki', offer: 'Dostawa 30 minut' });
  assert.equal(camp.variants.length, 3);
  for (const v of camp.variants) {
    assert.ok(v.title.length <= 34 && v.title.length > 3);
    assert.ok(v.subtitle.length <= 46);
    assert.ok(v.cta.length > 1);
    assert.match(v.palette.accent, /^#[0-9a-fA-F]{6}$/);
    assert.ok(['brand', 'text', 'image'].includes(v.layout));
  }
  assert.ok(camp.variants[0].title.includes('Nomu'), 'nazwa marki trafia do nagłówka');
  assert.ok(camp.tips.length >= 3);
});

test('AI: kampania bez marki i bez rozpoznanej branży nadal daje sensowny wynik', () => {
  const camp = generateCampaign({ what: 'coś tam' });
  assert.equal(camp.industry, 'generic');
  assert.equal(camp.variants.length, 3);
  assert.ok(camp.variants[0].title.length <= 34);
});

test('AI: kontrast WCAG liczony poprawnie (czarne na białym = 21, to samo = 1)', () => {
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('#123456', '#123456'), 1);
  assert.ok(contrastRatio('#0b1020', '#ffffff') > 10);
});

test('AI: audyt wystawia ocenę A–D i wskazuje braki (link, CTA, kontrast, obraz)', () => {
  const slaby = auditAd({ title: '', bg: '#888888', fg: '#999999' }, { traffic: 90, floors: 4 });
  assert.ok(slaby.score < 60);
  assert.equal(slaby.grade, 'D');
  assert.ok(slaby.findings.some((f) => f.level === 'err'));

  const mocny = auditAd(
    { title: 'Świeże sushi w Gdyni', subtitle: 'Dostawa 30 minut', cta: 'Zamów', url: 'https://nomu.pl', image: 'data:image/png;base64,x', bg: '#101a2b', fg: '#ffffff' },
    { traffic: 900, floors: 5 },
  );
  assert.ok(mocny.score >= 90, `mocna reklama powinna mieć ≥90, ma ${mocny.score}`);
  assert.equal(mocny.grade, 'A');
  assert.ok(mocny.findings.every((f) => f.level !== 'err'));
});

test('AI: misja dnia jest deterministyczna i ma nagrodę', () => {
  const a = dailyMission('2026-09-13');
  const b = dailyMission('2026-09-13');
  assert.deepEqual(a, b);
  assert.ok(a.text.length > 10 && a.reward > 0);
  assert.notEqual(dailyMission('2026-09-13').id, undefined);
});

test('AI: seria dni rośnie po kolei, nie psuje się w tym samym dniu i resetuje po przerwie', () => {
  assert.equal(nextStreak('2026-09-12', '2026-09-13', 3), 4);
  assert.equal(nextStreak('2026-09-13', '2026-09-13', 4), 4);
  assert.equal(nextStreak('2026-09-01', '2026-09-13', 9), 1);
  assert.equal(dayKeyOf(new Date('2026-09-13T10:00:00')), '2026-09-13');
  assert.ok(AI_TIPS.length >= 5);
});
