/* ============================================================
   Tóny klavíru pro hru Sluch - syntéza přímo v prohlížeči (Web Audio),
   bez nahrávek a bez knihovny. Zní jako jednoduché elektrické piano:
   základní tón (trojúhelník) + tichá vyšší harmonická (sinus), rychlý
   náběh a pozvolné doznění.

   Tón se zadává číslem klávesy MIDI: c1 = 60, cis1 = 61 … c2 = 72.
   Hraje se vždycky, i když je vypnutý „Zvuk" - ten patří efektům
   (cinknutí za správnou odpověď), bez tónů by se tahle hra hrát nedala.
   ============================================================ */

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  // prohlížeč kontext uspí, dokud uživatel na stránku neklepne
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const midiFreq = (m) => 440 * 2 ** ((m - 69) / 12);

function tone(m, at, dur) {
  const c = audio();
  const f = midiFreq(m);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.9, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.25, at + 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  env.connect(master);
  for (const [type, mult, vol] of [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12]]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = f * mult;
    g.gain.value = vol;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

/* Zahraje tóny po sobě. `gap` je odstup začátků v sekundách. Vrací,
   za kolik milisekund dohrají - podle toho se dá zablokovat klepání. */
export function playSeq(notes, gap = 0.75, dur = 1.1) {
  try {
    const c = audio();
    const start = c.currentTime + 0.05;
    notes.forEach((m, i) => tone(m, start + i * gap, dur));
    return Math.round(((notes.length - 1) * gap + dur) * 1000);
  } catch {
    return 0; // bez Web Audio prostě nic nezazní
  }
}

export const playNote = (m) => playSeq([m], 0, 1.1);
