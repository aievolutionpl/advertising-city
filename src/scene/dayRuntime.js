// Mutowalny stan doby dla sceny 3D — czytany co klatkę w useFrame, BEZ re-renderów Reacta.
// Do Reacta trafia tylko zegar (raz na ~0,5 s), żeby HUD nie renderował się 60×/s.
import { dayState, advance } from '../lib/daynight.js';

const realHour = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

export const dayRuntime = {
  hours: realHour(),          // start = prawdziwa godzina u gracza
  speed: 'fast',              // 'pause' | 'real' | 'fast' | 'epic'
  day: null,                  // wypełniane niżej
  _lastClock: null,
};

dayRuntime.day = dayState(dayRuntime.hours);

export function setRuntimeHours(h) {
  dayRuntime.hours = ((h % 24) + 24) % 24;
  dayRuntime.day = dayState(dayRuntime.hours);
  return dayRuntime.hours;
}

export function setRuntimeSpeed(speed) {
  dayRuntime.speed = speed;
}

/** Postęp czasu z klatki; zwraca true, gdy zmieniła się minuta (HUD może odświeżyć zegar). */
export function tickRuntime(dtSeconds) {
  const prev = dayRuntime.hours;
  dayRuntime.hours = advance(dayRuntime.hours, dayRuntime.speed, dtSeconds);
  dayRuntime.day = dayState(dayRuntime.hours);
  const clock = dayRuntime.day.clock;
  if (clock !== dayRuntime._lastClock) {
    dayRuntime._lastClock = clock;
    return true;
  }
  return prev === dayRuntime.hours ? false : false;
}
