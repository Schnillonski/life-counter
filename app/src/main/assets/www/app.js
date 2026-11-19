'use strict';
(function () {

/* ================= Helfer ================= */
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const NB = window.Android || null;
const now = () => Date.now();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sgn = d => (d > 0 ? '+' : '−') + Math.abs(d);
const num = v => v < 0 ? '−' + Math.abs(v) : String(v);
const uid = () => Math.random().toString(36).slice(2, 9);
function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function fmtT(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
}
const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

/* ================= Daten (Spielbegriffe englisch) ================= */
const COLORS = ['#e5484d', '#3e8ef7', '#30a46c', '#f5a524', '#8e4ec6', '#12a5b0', '#e5579b', '#f76b15', '#6e56cf', '#8b95a8'];

// n = Name (auch Suchbegriff für die Doku), s = Kurzname auf dem Feld
const COUNTERS = {
  poison: { n: 'Poison', s: 'Poison', c: '#8be36a', lose: 10 },
  tax: { n: 'Commander Tax', s: 'Tax', c: '#9fd2ff', step: 2 },
  energy: { n: 'Energy', s: 'Energy', c: '#ffd84d' },
  exp: { n: 'Experience', s: 'XP', c: '#c9b2ff' },
  storm: { n: 'Storm', s: 'Storm', c: '#8fb7ff' },
  rad: { n: 'Rad', s: 'Rad', c: '#c3f56b' },
  speed: { n: 'Speed', s: 'Speed', c: '#ffa366', max: 4 },
  dmg: { n: 'Damage (Active)', s: 'Dmg', c: '#ff8f80', step: 10, doc: 'Knocked Out' },
  misc: { n: 'Counter', s: '#1', c: '#cfd6e4', neg: true, doc: '-' },
  misc2: { n: 'Counter 2', s: '#2', c: '#9ee6e0', neg: true, doc: '-' }
};
const FLAGS = { // g = gehört immer genau einem Spieler (wird übernommen)
  monarch: { n: 'Monarch', b: '👑', g: 1, i: '👑', take: 'Monarch übernehmen', now: 'ist jetzt Monarch' },
  initiative: { n: 'Initiative', b: '🗝️ Init', g: 1, i: '🗝️', take: 'Initiative übernehmen', now: 'hat die Initiative – venture into Undercity' },
  blessing: { n: "City's Blessing", b: '🏛️' },
  vstar: { n: 'VSTAR Power used', b: 'VSTAR', doc: 'VSTAR Power' },
  gx: { n: 'GX Attack used', b: 'GX', doc: 'GX Attack' }
};
// Reihenfolge im Zähler-Chip auf dem Feld: Wichtigstes zuerst
const CTR_ORDER = ['poison', 'dmg', 'tax', 'speed', 'rad', 'energy', 'exp', 'storm', 'misc', 'misc2'];
const CONDS = { // x = Asleep/Confused/Paralyzed schließen sich gegenseitig aus
  poisoned: { n: 'Poisoned' }, burned: { n: 'Burned' },
  asleep: { n: 'Asleep', x: 1 }, confused: { n: 'Confused', x: 1 }, paralyzed: { n: 'Paralyzed', x: 1 }
};
const EV = {
  mtg: ['Mulligan', 'Board Wipe', 'Combo', 'Extra Turn', 'Commander cast', 'Counterspell', 'Gain Control', 'Graveyard exiled', 'Tutor', 'Big Attack'],
  pkm: ['Mulligan', 'Knocked Out', 'Evolution', 'Stadium played', 'Retreat', 'Coin Flip', 'Deck low'],
  ygo: ['Hand Trap', 'Board broken', 'Chain block', 'Extra Deck Summon', 'Link Summon', 'Side Deck'],
  gen: ['Mulligan', 'Turning point', 'Combo', 'Big play', 'Rules question', 'Break']
};
const PRESETS = {
  commander: { n: 'Commander', g: 'Magic', start: 40, players: 4, step: 1, big: 10, ctr: ['poison', 'tax', 'energy', 'exp'], cmd: true, lose0: true, flags: ['monarch', 'initiative', 'blessing'], dn: true, ev: 'mtg', doc: 'mtg', checks: ['Land drop'], quick: [40, 30, 20, 60] },
  standard: { n: 'Standard / Modern', g: 'Magic', start: 20, players: 2, step: 1, big: 5, ctr: ['poison', 'energy'], lose0: true, flags: ['monarch', 'initiative', 'blessing'], dn: true, ev: 'mtg', doc: 'mtg', checks: ['Land drop'], quick: [20, 25, 30] },
  brawl: { n: 'Brawl', g: 'Magic', start: 25, players: 2, step: 1, big: 5, ctr: ['poison', 'tax', 'energy'], lose0: true, flags: ['monarch', 'initiative'], dn: true, ev: 'mtg', doc: 'mtg', checks: ['Land drop'], quick: [25, 20, 30] },
  oath: { n: 'Oathbreaker', g: 'Magic', start: 20, players: 4, step: 1, big: 5, ctr: ['poison', 'tax', 'energy'], lose0: true, flags: ['monarch', 'initiative'], dn: true, ev: 'mtg', doc: 'mtg', checks: ['Land drop'], quick: [20, 25] },
  pokemon: { n: 'Pokémon TCG', g: 'Pokémon', start: 6, players: 2, step: 1, big: 1, label: 'Prize Cards', ctr: ['dmg'], win0: true, conds: true, flags: ['vstar', 'gx'], ev: 'pkm', doc: 'pkm', checks: ['Energy', 'Supporter', 'Retreat'], quick: [6, 4, 3] },
  yugioh: { n: 'Yu-Gi-Oh!', g: 'Yu-Gi-Oh!', start: 8000, players: 2, step: 100, big: 1000, label: 'LP', calc: true, ctr: [], lose0: true, ev: 'ygo', doc: 'ygo', checks: ['Normal Summon'], quick: [8000, 4000] },
  lorcana: { n: 'Lorcana', g: 'Lorcana', start: 0, players: 2, step: 1, big: 5, label: 'Lore', winAt: 20, ctr: [], ev: 'gen', doc: 'other', checks: ['Ink'], quick: [0] },
  fab: { n: 'Flesh and Blood', g: 'FaB', start: 40, players: 2, step: 1, big: 5, ctr: ['misc'], lose0: true, ev: 'gen', doc: 'other', quick: [40, 20] },
  swu: { n: 'Star Wars Unlimited', g: 'SWU', start: 30, players: 2, step: 1, big: 5, label: 'Base HP', ctr: ['misc'], lose0: true, ev: 'gen', doc: 'other', checks: ['Resource'], quick: [30, 28, 25] },
  custom: { n: 'Eigenes Spiel', g: 'Frei', start: 20, players: 2, step: 1, big: 10, ctr: ['misc', 'misc2'], lose0: true, ev: 'gen', doc: 'modes', quick: [10, 20, 30, 50, 100] }
};
/* Sitzordnung im Uhrzeigersinn: [grid-area, Drehung].
   hub = Menüknopf, next = zentraler „Nächster Zug“-Knopf. Beide sitzen auf Trennlinien/Ecken,
   wo sie keine Namen oder Chips verdecken (berücksichtigt den Spielfeld-Rand). */
const SV = 'var(--safe-v,0px)', SH = 'var(--safe-h,0px)';
const THIRD = `calc(${SV} + (100% - 2 * ${SV}) / 3)`, TWO = `calc(${SV} + (100% - 2 * ${SV}) * 2 / 3)`, TOP = `calc(${SV} + 40px)`;
const LEFT = `calc(${SH} + 44px)`, RIGHT = `calc(100% - ${SH} - 44px)`;
const LAYOUTS = {
  1: { c: '1fr', r: '1fr', s: [['1/1', 0]], hub: [`calc(100% - ${SH} - 40px)`, TOP], next: null },
  2: { c: '1fr', r: '1fr 1fr', s: [['2/1', 0], ['1/1', 180]], hub: [LEFT, '50%'], next: [RIGHT, '50%'] },
  3: { c: '1fr 1fr', r: '1fr 1fr', s: [['2/1', 90], ['1/1/2/3', 180], ['2/2', 270]], hub: [LEFT, '50%'], next: [RIGHT, '50%'] },
  4: { c: '1fr 1fr', r: '1fr 1fr', s: [['2/1', 90], ['1/1', 90], ['1/2', 270], ['2/2', 270]], hub: ['50%', TOP], next: ['50%', '50%'] },
  5: { c: '1fr 1fr', r: '1fr 1fr 1fr', s: [['3/1/4/3', 0], ['2/1', 90], ['1/1', 90], ['1/2', 270], ['2/2', 270]], hub: ['50%', TOP], next: ['50%', THIRD] },
  6: { c: '1fr 1fr', r: '1fr 1fr 1fr', s: [['3/1', 90], ['2/1', 90], ['1/1', 90], ['1/2', 270], ['2/2', 270], ['3/2', 270]], hub: ['50%', TWO], next: ['50%', THIRD] }
};
const DICE = [
  { k: 'coin', n: 'Münze', f: 2, s: 'Heads / Tails' }, { k: 'd4', n: 'W4', f: 4 }, { k: 'd6', n: 'W6', f: 6 },
  { k: 'd8', n: 'W8', f: 8 }, { k: 'd10', n: 'W10', f: 10 }, { k: 'd12', n: 'W12', f: 12 },
  { k: 'd20', n: 'W20', f: 20 }, { k: 'd100', n: 'W100', f: 100 }, { k: 'planar', n: 'Planar', f: 6, s: 'Planechase' }
];
const DEF = {
  haptics: true, rotate: true, turns: true, turnTimer: true, checks: true, cmdLife: true, autoMonarch: true, partner: false, awake: true, zones: true,
  holdMs: 450, holdMode: 'big', commitMs: 1800, shake: true, diceN: 1, diceLast: 'd20', names: [], colors: [], events: {},
  updates: true, skipVer: '', askResume: true, hints: true
};
const LOG_MAX = 3000, HIST_MAX = 1500, UNDO_MAX = 80;

/* ================= Zustand ================= */
let S = Object.assign({}, DEF, LS.get('lc.settings', {}));
let games = LS.get('lc.games', []);
let state = LS.get('lc.state', null);
const board = document.getElementById('board'), hub = document.getElementById('hub'), nextBtn = document.getElementById('next');
const layer = document.getElementById('layer'), toasts = document.getElementById('toasts');
const preset = () => PRESETS[state.preset] || PRESETS.custom;

function makeGame(pk, n, start) {
  const P = PRESETS[pk], t = now(), players = [];
  for (let i = 0; i < n; i++) players.push({
    id: i, name: S.names[i] || 'Spieler ' + (i + 1), color: S.colors[i] || COLORS[i % COLORS.length], life: start,
    ctr: {}, cmd: {}, flags: {}, conds: {}, checks: {}, time: 0, manual: null, _st: ''
  });
  return {
    v: 1, preset: pk, start, startedAt: t, turnNo: 1, active: 0, turnStart: t, monarch: null, initiative: null, dayNight: null,
    players, log: [{ t, turn: 1, type: 'sys', text: `Neues Spiel: ${P.n} · ${n} Spieler · Start ${start}` }],
    hist: [{ t, l: players.map(p => p.life) }], reminders: [], dice: []
  };
}
function valid(s) { return s && s.v === 1 && Array.isArray(s.players) && s.players.length >= 1 && s.players.length <= 6 && PRESETS[s.preset]; }

let saveT = null;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 400); }
function saveNow() { clearTimeout(saveT); saveT = null; state.lastSeen = now(); LS.set('lc.state', state); }
function saveS() { LS.set('lc.settings', S); }

function hap(ms) {
  if (!S.haptics) return;
  try { if (NB && NB.vibrate) NB.vibrate(ms | 0); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
}
function rotOf(pid) { return S.rotate ? LAYOUTS[state.players.length].s[pid][1] : 0; }
// Dialoge immer hochkant (0° oder 180°), damit Inhalt und Tastatur Platz haben
function sheetRot(pid) { const r = rotOf(pid); return r % 180 ? 0 : r; }

/* ---------- Undo ----------
   Log und Verlauf sind append-only und werden nicht mitkopiert, nur ihre Länge.
   Spart bei langen Partien viel Speicher und CPU gegenüber vollen Kopien. */
let undoStack = [], undoKey = null, undoAt = 0;
function snap(key) {
  const t = now();
  if (key && key === undoKey && t - undoAt < 2500) { undoAt = t; return; }
  const { log, hist, ...rest } = state;
  undoStack.push({ s: JSON.stringify(rest), l: log.length, h: hist.length });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  undoKey = key; undoAt = t;
}
function undo() {
  flushPending();
  const u = undoStack.pop();
  if (!u) { toast('Nichts zum Rückgängigmachen'); return; }
  const log = state.log, hist = state.hist;
  state = JSON.parse(u.s);
  state.log = log.slice(0, u.l); state.hist = hist.slice(0, u.h);
  undoKey = null;
  clearBubbles(); renderBoard(); refreshSheets(true); saveNow();
  toast('↶ Rückgängig'); hap(20);
}

/* ---------- Änderungen bündeln (ein Log-Eintrag pro Tipp-Serie) ---------- */
const pend = {};
function accum(key, d, commit) {
  const q = pend[key] || (pend[key] = { d: 0 });
  q.d += d; q.c = commit; clearTimeout(q.t);
  q.t = setTimeout(() => finish(key), S.commitMs);
}
function finish(key) {
  const q = pend[key]; if (!q) return;
  clearTimeout(q.t); delete pend[key]; q.c(q.d); saveSoon(); refreshSheets();
}
function flushPending() { Object.keys(pend).forEach(finish); }

const bub = {}, bubT = {};
function bubble(pid, d) {
  bub[pid] = (bub[pid] || 0) + d; clearTimeout(bubT[pid]);
  bubT[pid] = setTimeout(() => { delete bub[pid]; renderPanel(pid); }, S.commitMs);
}
function clearBubbles() { for (const k in bub) { clearTimeout(bubT[k]); delete bub[k]; } }

function addLog(e) {
  e.t = now(); e.turn = state.turnNo; state.log.push(e);
  if (state.log.length > LOG_MAX) { state.log.splice(0, 500); undoStack = []; } // selten; Undo-Längen wären danach ungültig
}
function pushHist() {
  const l = state.players.map(p => p.life), last = state.hist[state.hist.length - 1];
  if (last && last.l.every((v, i) => v === l[i])) return;
  state.hist.push({ t: now(), l });
  if (state.hist.length > HIST_MAX) { state.hist.splice(0, 300); undoStack = []; }
}

/* ---------- Werte ändern ---------- */
function changeLife(pid, d) {
  const p = state.players[pid]; if (!p || !d) return;
  snap('l' + pid);
  p.life += d; bubble(pid, d);
  accum('l' + pid, d, tot => { if (tot) addLog({ type: 'life', pid, d: tot, v: p.life }); pushHist(); });
  afterChange(pid);
}
function changeCtr(pid, k, d) {
  const p = state.players[pid], C = COUNTERS[k]; if (!p || !C) return;
  const old = p.ctr[k] || 0; let v = old + d;
  if (!C.neg) v = Math.max(0, v);
  if (C.max != null) v = Math.min(C.max, v);
  if (v === old) return;
  snap('c' + pid + k); p.ctr[k] = v;
  accum('c' + pid + k, v - old, tot => { if (tot) addLog({ type: 'ctr', pid, k, d: tot, v: p.ctr[k] }); });
  hap(8); afterChange(pid);
}
function changeCmd(pid, from, idx, d) {
  const p = state.players[pid]; if (!p) return;
  const arr = p.cmd[from] || (p.cmd[from] = [0, 0]);
  const old = arr[idx] || 0, v = Math.max(0, old + d); if (v === old) return;
  const key = 'k' + pid + '_' + from + '_' + idx;
  snap(key);
  arr[idx] = v; const real = v - old;
  if (S.cmdLife) { p.life -= real; bubble(pid, -real); }
  accum(key, real, tot => { if (tot) { addLog({ type: 'cmd', pid, from, d: tot, v: arr[idx] }); pushHist(); } });
  // Commander Damage ist Combat Damage: Wer den Monarch / die Initiative trifft, übernimmt sie.
  let moved = false;
  if (real > 0 && S.autoMonarch && from !== pid && state.players[from] && !status(state.players[from]).out) {
    for (const f of ['monarch', 'initiative']) if (state[f] === pid) { giveGlobal(f, from, 'Combat Damage'); moved = true; }
  }
  hap(8); afterChange(pid);
  if (moved) renderPanels(); // Symbol wandert auch ins Feld des Angreifers
}
function afterChange(pid) {
  if (checkStatus()) renderPanels(); else renderPanel(pid);
  refreshSheets(); saveSoon();
}

/* ---------- Status: ausgeschieden / gewonnen ---------- */
function status(p, ignoreManual) {
  const P = preset();
  if (!ignoreManual) {
    if (p.manual === 'out') return { out: 'Aufgegeben' };
    if (p.manual === 'alive') return {};
  }
  if (P.winAt != null && p.life >= P.winAt) return { win: 'Gewonnen' };
  if (P.win0 && p.life <= 0) return { win: 'Alle Prize Cards' };
  if (P.lose0 && p.life <= 0) return { out: (P.label || 'Life') + ' 0' };
  for (const k in p.ctr) { const C = COUNTERS[k]; if (C && C.lose && p.ctr[k] >= C.lose) return { out: C.lose + ' ' + C.n }; }
  if (P.cmd) for (const f in p.cmd) for (const v of p.cmd[f]) if (v >= 21) return { out: '21 Commander Damage' };
  return {};
}
function checkStatus() {
  let changed = false, newOut = false;
  state.players.forEach(p => {
    if (p.manual === 'alive' && !status(p, true).out) p.manual = null;
    const s = status(p), k = s.out ? 'o:' + s.out : s.win ? 'w:' + s.win : '';
    if (k === (p._st || '')) return;
    changed = true; p._st = k;
    if (s.out) {
      addLog({ type: 'sys', pid: p.id, text: `${p.name} ist ausgeschieden (${s.out})` });
      toast(`${esc(p.name)} ist raus`, { rot: rotOf(p.id) }); hap(150); newOut = true;
      // Regel: Verlässt der Monarch / Initiative-Spieler das Spiel, geht sie an den Spieler am Zug
      // (bzw. an den nächsten in Zugreihenfolge, wenn der Ausscheidende selbst am Zug ist).
      for (const f of ['monarch', 'initiative']) if (state[f] === p.id) giveGlobal(f, heirOf(p.id), `${p.name} ist raus`);
    } else if (s.win) {
      addLog({ type: 'sys', pid: p.id, text: `${p.name} gewinnt (${s.win})` });
      toast(`🏆 ${esc(p.name)} gewinnt!`, { rot: rotOf(p.id), ms: 3000 }); hap(200);
    }
  });
  if (newOut && state.players.length > 1) {
    const alive = state.players.filter(p => !status(p).out);
    if (alive.length === 1) {
      const w = alive[0];
      addLog({ type: 'sys', pid: w.id, text: `${w.name} gewinnt das Spiel!` });
      setTimeout(() => toast(`🏆 ${esc(w.name)} gewinnt!`, { rot: rotOf(w.id), ms: 3500 }), 1300);
    }
  }
  return changed;
}

/* ---------- Züge ---------- */
function passTurn() {
  const n = state.players.length; if (n < 2) return;
  let i = state.active;
  for (let k = 0; k < n; k++) { i = (i + 1) % n; if (!status(state.players[i]).out) break; }
  setActive(i, true);
}
function setActive(pid, isPass) {
  snap(null);
  const t = now(), prev = state.active, cur = state.players[prev];
  if (cur) { cur.time += t - state.turnStart; cur.checks = {}; }
  // Regel-Hinweise vor dem Wechsel bestimmen (z. B. Monarch zieht im End Step)
  const H = isPass && S.hints && cur ? turnHints(prev, pid) : { out: [], inc: [] };
  state.active = pid; state.turnStart = t; state.players[pid].checks = {};
  if (isPass) state.turnNo++;
  addLog({ type: 'turn', pid });
  hap(25); renderPanels(); refreshSheets(); saveSoon();

  const p = state.players[pid];
  const li = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
  if (H.out.length) toast(`<h5>Zugende · ${esc(cur.name)}</h5>${li(H.out)}`, { rot: rotOf(prev), ms: 3500, big: true, queue: true });
  const inc = H.inc.concat(state.reminders.filter(r => r.onTurn && (r.pid == null || r.pid === pid)).map(r => '📌 ' + esc(r.text)));
  if (inc.length) toast(`<h5>Zug ${state.turnNo} · ${esc(p.name)}</h5>${li(inc)}<span class="tclose">Tippen zum Schließen</span>`, { rot: rotOf(pid), ms: 4000 + 1500 * inc.length, big: true, queue: true });
  else if (isPass) toast(`Zug ${state.turnNo} · ${esc(p.name)}`, { rot: rotOf(pid), ms: 1100, queue: true });
}
/* Hinweise beim Zugwechsel: out = für den Spieler, der seinen Zug beendet; inc = für den nächsten. */
function turnHints(prev, next) {
  const P = preset(), np = state.players[next], out = [], inc = [];
  if (state.monarch === prev) out.push('👑 Monarch: im End Step 1 Karte ziehen');
  if (P.dn && state.dayNight === 'day') out.push('☀️ Day: Kein Spell in diesem Zug gewirkt? → Night');
  if (P.dn && state.dayNight === 'night') out.push('🌙 Night: 2+ Spells in diesem Zug gewirkt? → Day');
  if (P.conds) state.players.forEach(q => { // Pokémon Checkup zwischen den Zügen
    const c = q.conds, l = [];
    if (c.poisoned) l.push('Poisoned +10');
    if (c.burned) l.push('Burned +20, dann Münze');
    if (c.asleep) l.push('Asleep: Münze');
    if (c.paralyzed && q.id === prev) { c.paralyzed = false; l.push('Paralyzed endet (entfernt)'); }
    if (l.length) out.push(`Checkup ${esc(q.name)}: ${l.join(', ')}`);
  });
  if (state.initiative === next) inc.push('🗝️ Initiative: im Upkeep venture into Undercity');
  if ((np.ctr.rad || 0) > 0) inc.push(`☢ Rad ${np.ctr.rad}: in der Main Phase ${np.ctr.rad} Karten millen`);
  return { out, inc };
}
function toggleCheck(pid, k) {
  const p = state.players[pid]; p.checks[k] = !p.checks[k]; hap(10); renderPanel(pid); saveSoon();
}
function toggleFlag(pid, f) {
  const F = FLAGS[f], p = state.players[pid];
  if (F.g) { setGlobal(f, state[f] === pid ? null : pid); return; }
  snap(null); const on = !p.flags[f]; p.flags[f] = on;
  addLog({ type: 'sys', pid, text: `${p.name}: ${F.n} ${on ? '✓' : '✗'}` });
  hap(15); renderPanels(); refreshSheets(); saveSoon();
}
// Monarch / Initiative von Hand an einen Spieler geben (oder mit null entfernen)
function setGlobal(f, pid) {
  if (state[f] === pid) return;
  snap(null); giveGlobal(f, pid);
  renderPanels(); refreshSheets(); saveSoon();
}
// Übergabe ohne eigenen Undo-Schritt (wird auch automatisch ausgelöst); reason erscheint im Protokoll
function giveGlobal(f, pid, reason) {
  const F = FLAGS[f], old = state[f]; if (old === pid) return;
  state[f] = pid;
  const nm = i => state.players[i].name, why = reason ? ` (${reason})` : '';
  addLog({ type: 'sys', pid: pid != null ? pid : old, text: pid == null ? `${F.n} entfernt` : `${nm(pid)} übernimmt ${F.n}${old != null ? ' von ' + nm(old) : ''}${why}` });
  hap(25);
  if (pid != null) toast(`${F.i} ${esc(nm(pid))} ${F.now}${reason ? `<br><small>${esc(reason)}</small>` : ''}`, { rot: rotOf(pid), ms: 2400, queue: !!reason });
}
// Wer erbt Monarch/Initiative, wenn pid ausscheidet: Spieler am Zug, sonst der nächste lebende in Zugreihenfolge
function heirOf(pid) {
  const n = state.players.length, alive = i => i !== pid && !status(state.players[i]).out;
  if (alive(state.active)) return state.active;
  for (let k = 1; k < n; k++) { const i = (pid + k) % n; if (alive(i)) return i; }
  return null;
}
function toggleCond(pid, k) {
  const p = state.players[pid]; snap(null); const on = !p.conds[k];
  if (on && CONDS[k].x) for (const c in CONDS) if (CONDS[c].x) p.conds[c] = false;
  p.conds[k] = on;
  addLog({ type: 'sys', pid, text: `${p.name}: ${CONDS[k].n} ${on ? '✓' : '✗'}` });
  hap(10); afterChange(pid);
}
function cycleDN() {
  snap(null);
  state.dayNight = state.dayNight == null ? 'day' : state.dayNight === 'day' ? 'night' : null;
  addLog({ type: 'sys', text: state.dayNight === 'day' ? 'It becomes Day' : state.dayNight === 'night' ? 'It becomes Night' : 'Day/Night entfernt' });
  hap(15); updateHub(); refreshSheets(); saveSoon();
}

/* ================= Spielfeld ================= */
function renderBoard() {
  const n = state.players.length, L = LAYOUTS[n];
  board.style.gridTemplateColumns = L.c; board.style.gridTemplateRows = L.r;
  board.innerHTML = L.s.map(([a, r], i) => {
    const rr = S.rotate ? r : 0;
    return `<div class="cell" style="grid-area:${a}"><div class="panel${rr % 180 ? ' side' : ''}" data-pid="${i}" style="--rot:${rr}deg">` +
      '<div class="zone minus" data-z="-1"><span>−</span></div><div class="zone plus" data-z="1"><span>+</span></div><div class="pc"></div></div></div>';
  }).join('');
  $$('.zone', board).forEach(bindZone);
  document.body.classList.toggle('nozones', !S.zones);
  renderPanels();
}
function renderPanels() { state.players.forEach((_, i) => renderPanel(i)); updateHub(); }

function renderPanel(pid) {
  const el = board.querySelector(`.panel[data-pid="${pid}"]`); if (!el) return;
  const p = state.players[pid], P = preset(), st = status(p);
  const act = S.turns && state.active === pid && state.players.length > 1;
  el.style.setProperty('--pc', p.color);
  el.classList.toggle('active', act); el.classList.toggle('out', !!st.out); el.classList.toggle('win', !!st.win);

  // Kopf: Name, ••• (Details), Status-Symbole (Monarch …), Timer.
  // Fuß: höchstens ein Chip je Bereich – Commander Damage, Zähler, Zustände, Checkliste.
  let badges = '';
  if (state.monarch === pid) badges += `<button class="bdg" data-act="flag" data-k="monarch">${FLAGS.monarch.b}</button>`;
  if (state.initiative === pid) badges += `<button class="bdg" data-act="flag" data-k="initiative">${FLAGS.initiative.b}</button>`;
  for (const f in p.flags) if (p.flags[f] && FLAGS[f]) badges += `<button class="bdg" data-act="flag" data-k="${f}">${FLAGS[f].b}</button>`;

  let foot = '';
  if (P.cmd) {
    // Unten: nur Commander Damage vom Spieler am Zug (zum schnellen Eintragen).
    // Oben beim Namen: bisheriger Commander Damage aller anderen Gegner.
    const hitFrom = S.turns && state.players.length > 1 && state.active !== pid && !st.out ? state.active : null;
    const tot = f => (p.cmd[f][0] || 0) + (p.cmd[f][1] || 0);
    // Ausgeschiedene Gegner zählen nicht mehr (ihr Commander hat das Spiel verlassen)
    const src = Object.keys(p.cmd).map(Number).filter(f => f !== hitFrom && state.players[f] && tot(f) && !status(state.players[f]).out);
    if (src.length) {
      const leth = src.some(f => p.cmd[f][0] >= 21 || p.cmd[f][1] >= 21);
      badges += `<button class="bdg${leth ? ' lethal' : ''}" data-act="cmdhead" data-f="${src.length === 1 ? src[0] : ''}">⚔ ${src.map(f => `<b class="cd" style="background:${state.players[f].color}"></b>${tot(f)}`).join(' ')}</button>`;
    }
    if (hitFrom != null) {
      const a = p.cmd[hitFrom] || [0, 0], t = (a[0] || 0) + (a[1] || 0);
      foot += `<button class="chip hit${a[0] >= 21 || a[1] >= 21 ? ' lethal' : ''}" data-act="cmdsum"><b style="background:${state.players[hitFrom].color}"></b>⚔ Cmd ${t || '+'}</button>`;
    }
  }
  const cs = CTR_ORDER.filter(k => p.ctr[k]);
  if (cs.length) { // ein Chip: bis zu 4 Zähler (Wichtigstes zuerst), Rest als +N
    const leth = cs.some(k => COUNTERS[k].lose && p.ctr[k] >= COUNTERS[k].lose);
    const show = cs.slice(0, 4).map(k => `${COUNTERS[k].s} <span style="color:${COUNTERS[k].c}">${p.ctr[k]}</span>`).join(' · ');
    foot += `<button class="chip${leth ? ' lethal' : ''}" data-act="ctrs" data-k="${cs.length === 1 ? cs[0] : ''}">${show}${cs.length > 4 ? ` <small>+${cs.length - 4}</small>` : ''}</button>`;
  }
  const cd = Object.keys(CONDS).filter(c => p.conds[c]);
  if (cd.length) foot += `<button class="chip" data-act="cond" data-k="${cd[0]}">${cd.map(c => CONDS[c].n).join(' · ')}</button>`;
  if (act && S.checks && P.checks) foot += P.checks.map(c => `<button class="chip chk${p.checks[c] ? ' on' : ''}" data-act="check" data-k="${esc(c)}">${p.checks[c] ? '✓ ' : ''}${esc(c)}</button>`).join('');

  const b = bub[pid], len = String(Math.abs(p.life)).length + (p.life < 0 ? 1 : 0);
  const low = P.lose0 && p.life > 0 && p.life <= Math.max(1, Math.round(P.start * 0.25));
  const lbl = st.out ? `<div class="lbl out">☠ ${esc(st.out)}</div>` : st.win ? `<div class="lbl win">🏆 ${esc(st.win)}</div>` :
    `<div class="lbl">${esc(P.label || 'Life')}${P.winAt ? ' / ' + P.winAt : ''}</div>`;
  const html =
    `<div class="head"><button class="name" data-act="player">${esc(p.name)}</button><button class="bdg more" data-act="player" aria-label="Details">•••</button>${badges}${act && S.turnTimer ? `<span class="tmr" data-tmr>${fmtT(now() - state.turnStart)}</span>` : ''}</div>` +
    (b ? `<div class="delta ${b > 0 ? 'pos' : 'neg'}">${sgn(b)}</div>` : '') +
    `<div class="life l${Math.min(len, 6)}${low ? ' low' : ''}"><span${P.calc ? ' data-act="calc"' : ''}>${num(p.life)}</span></div>` +
    lbl + `<div class="foot">${foot}</div>`;
  const pc = el.lastElementChild; // .pc
  if (pc._h !== html) { pc.innerHTML = html; pc._h = html; } // DOM nur anfassen, wenn sich etwas geändert hat
}

function updateHub() {
  const L = LAYOUTS[state.players.length], showNext = !!(S.turns && L.next);
  const hp = showNext ? L.hub : (L.next || L.hub); // ohne Zugverfolgung sitzt das Menü zentral
  hub.style.left = hp[0]; hub.style.top = hp[1];
  nextBtn.hidden = !showNext;
  if (showNext) {
    nextBtn.style.left = L.next[0]; nextBtn.style.top = L.next[1];
    nextBtn.style.setProperty('--nc', state.players[state.active].color);
  }
  const rc = state.reminders.length;
  hub.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
    (rc ? `<span class="hb">${rc}</span>` : '') +
    (state.dayNight ? `<span class="dn">${state.dayNight === 'day' ? '☀️' : '🌙'}</span>` : '');
}

/* ---------- Tippen / Halten ---------- */
function bindZone(z) {
  let t1 = 0, t2 = 0, held = false, down = false;
  const dir = +z.dataset.z;
  const pid = +z.parentElement.dataset.pid;
  z.addEventListener('pointerdown', e => {
    e.preventDefault();
    z.setPointerCapture(e.pointerId);
    down = true; held = false; z.classList.add('press');
    const P = preset(), rep = S.holdMode === 'repeat', step = rep ? P.step : P.big;
    t1 = setTimeout(() => {
      held = true; changeLife(pid, dir * step); hap(20);
      t2 = setInterval(() => { changeLife(pid, dir * step); hap(rep ? 5 : 12); }, rep ? 110 : 600);
    }, S.holdMs);
  });
  const end = e => {
    if (!down) return; down = false;
    clearTimeout(t1); clearInterval(t2); z.classList.remove('press');
    if (!held && e.type === 'pointerup') { changeLife(pid, dir * preset().step); hap(8); }
  };
  z.addEventListener('pointerup', end);
  z.addEventListener('pointercancel', end);
  z.addEventListener('lostpointercapture', end);
}
board.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const pid = +a.closest('.panel').dataset.pid;
  switch (a.dataset.act) {
    case 'player': case 'calc': openPlayer(pid); break;
    case 'check': toggleCheck(pid, a.dataset.k); break;
    case 'flag': case 'cond': openQuick(pid, a.dataset.act, a.dataset.k); break;
    case 'ctrs': if (a.dataset.k) openQuick(pid, 'ctr', a.dataset.k); else openPlayer(pid); break;
    case 'cmdsum': // Spieler am Zug trifft dieses Feld -> Schnelltasten
      if (S.turns && state.players.length > 1 && state.active !== pid) openQuick(pid, 'cmd', null, state.active); else openPlayer(pid);
      break;
    case 'cmdhead': // bisheriger Schaden: eine Quelle -> deren Regler, mehrere -> Details
      if (a.dataset.f !== '') openQuick(pid, 'cmd', null, +a.dataset.f); else openPlayer(pid);
      break;
  }
});
hub.addEventListener('click', () => { hap(10); openMenu(); });
nextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4.5l10 7.5-10 7.5z"/><rect x="16.5" y="4.5" width="3" height="15" rx="1.2"/></svg>';
let nextAt = 0;
nextBtn.addEventListener('click', () => { // Schutz gegen versehentlichen Doppeltipp
  const t = now(); if (t - nextAt < 700) return; nextAt = t; passTurn();
});

/* ================= Hinweise ================= */
// o.queue: Hinweis wartet, bis der aktuelle verschwunden ist (z. B. Zugende, dann Zugbeginn)
let toastT = 0, toastOn = false;
const toastQ = [];
function toast(msg, o = {}) {
  if (o.queue && toastOn) { toastQ.push([msg, o]); return; }
  const t = document.createElement('div');
  t.className = 'toast' + (o.big ? ' big' : '');
  t.style.setProperty('--rot', (o.rot || 0) + 'deg');
  t.innerHTML = msg;
  toasts.replaceChildren(t); toastOn = true;
  const hide = () => {
    clearTimeout(toastT); t.remove(); toastOn = false;
    const n = toastQ.shift(); if (n) toast(n[0], n[1]);
  };
  clearTimeout(toastT); toastT = setTimeout(hide, o.ms || 1500);
  if (o.big) t.addEventListener('click', hide);
}

/* ================= Dialoge ================= */
const sheets = [];
function openSheet(o) {
  const ov = document.createElement('div'); ov.className = 'ov';
  o.rot = o.rot || 0;
  ov.innerHTML = `<div class="frame${o.rot % 180 ? ' side' : ''}" style="--rot:${o.rot}deg"><div class="sheet">` +
    `<div class="sh-head"><div class="sh-title">${o.title}</div><button class="ib" data-a="_rot" aria-label="Für andere Tischseite drehen">⟳</button><button class="ib" data-a="_close" aria-label="Schließen">✕</button></div>` +
    '<div class="sh-body"></div></div></div>';
  o.el = ov; o.body = ov.querySelector('.sh-body'); o.frame = ov.firstElementChild;
  ov.addEventListener('click', e => {
    const a = e.target.closest('[data-a]');
    if (!a) { if (e.target === ov || e.target === o.frame) closeSheet(o); return; }
    const n = a.dataset.a;
    if (n === '_close') return closeSheet(o);
    if (n === '_rot') {
      o.rot = (o.rot + 90) % 360; o.frame.classList.toggle('side', o.rot % 180 !== 0); o.frame.style.setProperty('--rot', o.rot + 'deg');
      o.body.style.touchAction = o.rot ? 'none' : ''; return;
    }
    if (o.act && o.act[n]) o.act[n](a, e, o);
  });
  // Nach einer Wischbewegung keinen Klick auslösen (Merker gilt nur für genau diese Geste)
  ov.addEventListener('pointerdown', () => { o.dragged = false; }, true);
  ov.addEventListener('click', e => { if (o.dragged) { o.dragged = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  bindRotatedScroll(o);
  ov.addEventListener('input', e => { if (o.input) o.input(e.target, o); });
  ov.addEventListener('keydown', e => { if (e.key === 'Enter' && o.enter) { e.preventDefault(); o.enter(e.target, o); } });
  layer.appendChild(ov); sheets.push(o);
  renderSheet(o, true);
  if (o.onOpen) o.onOpen(o);
  return o;
}
/* Gedrehte Dialoge: Die WebView scrollt rotierte Container per Touch nicht zuverlässig.
   Deshalb wird die Wischbewegung hier selbst in die lokale Scrollrichtung umgerechnet (mit Schwung). */
function bindRotatedScroll(o) {
  const b = o.body;
  b.style.touchAction = o.rot ? 'none' : '';
  let pid = null, sx = 0, sy = 0, st = 0, drag = false, lastV = 0, lastP = 0, lastT = 0, raf = 0;
  const localDy = (dx, dy) => { const r = o.rot * Math.PI / 180; return -Math.sin(r) * dx + Math.cos(r) * dy; };
  b.addEventListener('pointerdown', e => {
    if (!o.rot || pid !== null) return;
    cancelAnimationFrame(raf);
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; st = b.scrollTop; drag = false; lastV = 0;
    lastP = 0; lastT = e.timeStamp;
  });
  b.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const d = localDy(e.clientX - sx, e.clientY - sy);
    if (!drag) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
      drag = true; o.dragged = true;
      try { b.setPointerCapture(pid); } catch (x) { }
    }
    b.scrollTop = st - d;
    const dt = e.timeStamp - lastT;
    if (dt > 0) { lastV = (d - lastP) / dt; lastP = d; lastT = e.timeStamp; }
  });
  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (!drag) { o.dragged = false; return; }
    // Ein evtl. folgender Klick kommt synchron nach pointerup – danach verfällt der Merker.
    setTimeout(() => { o.dragged = false; }, 0);
    let v = lastV * 16; // px pro Frame
    const step = () => {
      if (Math.abs(v) < 0.4) return;
      b.scrollTop -= v; v *= 0.94; raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
}
function renderSheet(o, force) {
  if (!force) { const a = document.activeElement; if (a && a.tagName === 'INPUT' && o.body.contains(a)) return; }
  o.dirty = false;
  const st = o.body.scrollTop; o.body.innerHTML = o.render(o); o.body.scrollTop = st;
}
// Nur der oberste (sichtbare) Dialog wird sofort neu gezeichnet, verdeckte erst beim Freilegen.
function refreshSheets(force) {
  const top = sheets.length - 1;
  sheets.forEach((o, i) => { if (o.static) return; if (i === top) renderSheet(o, force); else o.dirty = true; });
}
function closeSheet(o) {
  const i = sheets.indexOf(o); if (i < 0) return;
  sheets.splice(i, 1);
  if (document.activeElement && o.el.contains(document.activeElement)) document.activeElement.blur();
  o.el.remove();
  if (o.onClose) o.onClose(o);
  const top = sheets[sheets.length - 1];
  if (top && top.dirty) renderSheet(top, true);
}
function closeAll() { sheets.slice().forEach(closeSheet); }
function confirmBox(text, yes, fn) {
  openSheet({
    title: 'Sicher?',
    render: () => `<p class="cf">${text}</p><div class="row2"><button class="btn" data-a="no">Abbrechen</button><button class="btn pri" data-a="yes">${yes}</button></div>`,
    act: { no: (a, e, o) => closeSheet(o), yes: (a, e, o) => { closeSheet(o); fn(); } }
  });
}
const stp = (a, val, extra, cls) => `<div class="stp ${cls || ''}"><button data-a="${a}" data-d="-1" ${extra}>−</button><span>${val}</span><button data-a="${a}" data-d="1" ${extra}>+</button></div>`;
const mbtn = (a, i, l, c) => `<button class="mbtn" data-a="${a}"><i>${i}</i>${l}${c ? `<span class="cnt">${c}</span>` : ''}</button>`;
const pchips = (sel, allLabel) =>
  `<button class="pchip ${sel == null ? 'on' : ''}" data-a="selp" data-p="">${allLabel}</button>` +
  state.players.map(p => `<button class="pchip ${sel === p.id ? 'on' : ''}" data-a="selp" data-p="${p.id}"><b class="dot" style="background:${p.color}"></b>${esc(p.name)}</button>`).join('');
const selp = (a, e, o) => { o.pid = a.dataset.p === '' ? null : +a.dataset.p; renderSheet(o, true); };

/* ---------- Menü ---------- */
function openMenu() {
  openSheet({
    title: 'Menü',
    render() {
      const P = preset(), a = state.players[state.active], turns = S.turns && state.players.length > 1;
      const dn = state.dayNight === 'day' ? 'Day' : state.dayNight === 'night' ? 'Night' : 'aus';
      return `<div class="stat"><div><b>${esc(P.n)}</b><span>${state.players.length} Spieler · Start ${state.start}</span></div>
        <div class="clk"><span data-clock>${fmtT(now() - state.startedAt)}</span><span>Zug ${state.turnNo}${turns ? ' · ' + esc(a.name) : ''}</span></div></div>
        <h4>Spiel</h4><div class="mgrid">
          ${turns ? mbtn('pass', '⏭', 'Nächster Zug') : ''}
          ${mbtn('undo', '↶', 'Rückgängig', undoStack.length || '')}
          ${mbtn('dice', '🎲', 'Würfel & Münze')}
          ${mbtn('first', '🎯', 'Wer beginnt?')}
          ${P.dn ? mbtn('dn', state.dayNight === 'night' ? '🌙' : '☀️', 'Day/Night: ' + dn) : ''}
          ${['monarch', 'initiative'].filter(f => (P.flags || []).includes(f)).map(f => mbtn('g_' + f, FLAGS[f].i, FLAGS[f].n + ': ' + (state[f] != null ? esc(state.players[state[f]].name) : '–'))).join('')}
        </div>
        <h4>Notizen</h4><div class="mgrid">
          ${mbtn('event', '⚑', 'Ereignis')}
          ${mbtn('rem', '📌', 'Merker', state.reminders.length || '')}
          ${mbtn('log', '📜', 'Protokoll')}
        </div>
        <h4>Setup & Hilfe</h4><div class="mgrid">
          ${mbtn('new', '＋', 'Neues Spiel')}
          ${mbtn('restart', '⟲', 'Neustart')}
          ${mbtn('settings', '⚙', 'Einstellungen')}
          ${mbtn('docs', '📖', 'Doku & Regeln')}
        </div>`;
    },
    act: {
      pass: () => { closeAll(); passTurn(); }, undo: () => undo(), dice: () => openDice(), first: () => openFirst(), dn: () => cycleDN(),
      g_monarch: () => openQuick(state.monarch != null ? state.monarch : state.active, 'flag', 'monarch'),
      g_initiative: () => openQuick(state.initiative != null ? state.initiative : state.active, 'flag', 'initiative'),
      event: () => openEvent(null, 0), rem: () => openRem(null, 0), log: () => openLog(),
      new: () => openNew(), settings: () => openSettings(), docs: () => openDocs(),
      restart: () => confirmBox('Spiel mit gleichen Einstellungen und Namen neu starten?', 'Neustart', () => { closeAll(); startGame(state.preset, state.players.length, state.start); })
    }
  });
}

/* ---------- Spieler-Details ---------- */
function openPlayer(pid) {
  hap(8);
  const P0 = preset();
  openSheet({
    title: esc(state.players[pid].name), rot: sheetRot(pid), pid, buf: '', more: false, calc: !!P0.calc,
    render(o) {
      const p = state.players[o.pid], P = preset(), st = status(p);
      let h = `<div class="mainrow">
          <button data-a="life" data-d="${-P.big}">−${P.big}</button><button data-a="life" data-d="${-P.step}">−${P.step}</button>
          <div class="mval" style="background:color-mix(in srgb,${p.color} 40%,#1d212b)"><b>${num(p.life)}</b><small>${esc(P.label || 'Life')}</small></div>
          <button data-a="life" data-d="${P.step}">+${P.step}</button><button data-a="life" data-d="${P.big}">+${P.big}</button></div>`;
      if (o.calc) h += `<div class="calc"><div class="kd">${o.buf ? esc(o.buf) : '<span class="mut">Betrag</span>'}</div>
          <div class="keys">${['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '⌫'].map(k => `<button data-a="key" data-k="${k}">${k}</button>`).join('')}</div>
          <div class="ops"><button class="sub" data-a="op" data-op="sub">− Abziehen</button><button class="add" data-a="op" data-op="add">+ Addieren</button>
            <button data-a="op" data-op="set">= Setzen</button>${P.calc ? '<button data-a="op" data-op="half">½ Halbieren</button>' : ''}</div></div>`;
      h += `<button class="lnk" data-a="calcT">${o.calc ? 'Rechner ausblenden' : 'Rechner öffnen'}</button>`;

      if (P.cmd && state.players.length > 1) {
        h += `<h4>Commander Damage erhalten <small>· tödlich ab 21</small><button class="hlink" data-a="doc" data-q="Commander Damage">ⓘ</button></h4><div class="cmds">${state.players.filter(q => q.id !== p.id && !status(q).out).map(q => {
          const a = p.cmd[q.id] || [0, 0], leth = a[0] >= 21 || a[1] >= 21;
          return `<div class="cmdrow${leth ? ' lethal' : ''}"><span class="cn"><b class="dot" style="background:${q.color}"></b>${esc(q.name)}</span>` +
            stp('cmd', a[0], `data-f="${q.id}" data-i="0"`, a[0] >= 21 ? 'lethal' : '') +
            (S.partner ? stp('cmd', a[1] || 0, `data-f="${q.id}" data-i="1"`, a[1] >= 21 ? 'lethal' : '') : '') + '</div>';
        }).join('')}</div>`;
      }

      const ctrKeys = o.more ? Object.keys(COUNTERS) : [...new Set(P.ctr.concat(Object.keys(p.ctr).filter(k => p.ctr[k])))];
      h += `<h4>Zähler</h4><div class="ctrs">${ctrKeys.map(k => {
        const C = COUNTERS[k], v = p.ctr[k] || 0, hasDoc = C.doc !== '-';
        return `<div class="ctr${C.lose && v >= C.lose ? ' lethal' : ''}"><button class="cn"${hasDoc ? ` data-a="doc" data-q="${esc(C.doc || C.n)}"` : ''}>${C.n}${C.lose ? ` <small>/ ${C.lose}</small>` : C.step ? ` <small>±${C.step}</small>` : ''}${hasDoc ? ' <small>ⓘ</small>' : ''}</button>${stp('ctr', v, `data-k="${k}"`)}</div>`;
      }).join('') || '<p class="mut small">Keine Zähler aktiv.</p>'}</div>
        <button class="lnk" data-a="more">${o.more ? 'Weniger Zähler' : '+ Weitere Zähler'}</button>`;

      let tg = '';
      (P.flags || []).forEach(f => { const F = FLAGS[f], on = F.g ? state[f] === p.id : !!p.flags[f]; tg += `<button class="tg${on ? ' on' : ''}" data-a="flag" data-k="${f}">${F.n}</button>`; });
      if (P.conds) Object.keys(CONDS).forEach(k => { tg += `<button class="tg${p.conds[k] ? ' on' : ''}" data-a="cond" data-k="${k}">${CONDS[k].n}</button>`; });
      if (tg) h += `<h4>${P.conds ? 'Special Conditions & Status' : 'Status'}<button class="hlink" data-a="docT">ⓘ Erklärung</button></h4><div class="tgs">${tg}</div>`;

      h += `<h4>Aktionen</h4><div class="acts">
        ${S.turns && state.players.length > 1 ? `<button class="btn" data-a="turn">${state.active === p.id ? '✓ Ist am Zug' : '▶ Ist am Zug'}</button>` : ''}
        <button class="btn" data-a="event">⚑ Ereignis</button>
        <button class="btn" data-a="rem">📌 Merker</button>
        <button class="btn${st.out ? '' : ' warn'}" data-a="out">${st.out ? '↺ Wiederbeleben' : '☠ Ausscheiden'}</button></div>
        <h4>Name & Farbe</h4>
        <div class="pname"><input data-in="name" value="${esc(p.name)}" maxlength="24" placeholder="Name"></div>
        <div class="swatches">${COLORS.map(c => `<button class="sw-c${p.color === c ? ' on' : ''}" style="background:${c}" data-a="color" data-c="${c}" aria-label="Farbe"></button>`).join('')}</div>
        <p class="mut small">Zugzeit gesamt: ${fmtT(p.time + (state.active === p.id ? now() - state.turnStart : 0))}</p>`;
      return h;
    },
    act: {
      life: (a, e, o) => { changeLife(o.pid, +a.dataset.d); hap(8); },
      calcT: (a, e, o) => { o.calc = !o.calc; renderSheet(o, true); },
      key: (a, e, o) => {
        const k = a.dataset.k;
        if (k === '⌫') o.buf = o.buf.slice(0, -1);
        else if (o.buf.length < 7) o.buf = (o.buf + k).replace(/^0+/, '');
        hap(5); renderSheet(o, true);
      },
      op: (a, e, o) => {
        const p = state.players[o.pid], op = a.dataset.op, n = parseInt(o.buf || '0', 10);
        let d;
        if (op === 'half') d = Math.ceil(p.life / 2) - p.life;
        else { if (!o.buf) { toast('Erst einen Betrag eingeben', { rot: o.rot }); return; } d = op === 'sub' ? -n : op === 'add' ? n : n - p.life; }
        o.buf = ''; hap(15);
        if (d) changeLife(o.pid, d); else renderSheet(o, true);
      },
      ctr: (a, e, o) => { const k = a.dataset.k; changeCtr(o.pid, k, (+a.dataset.d) * (COUNTERS[k].step || 1)); },
      cmd: (a, e, o) => changeCmd(o.pid, +a.dataset.f, +a.dataset.i, +a.dataset.d),
      more: (a, e, o) => { o.more = !o.more; renderSheet(o, true); },
      doc: (a, e, o) => openDocs(null, a.dataset.q, o.rot),
      docT: (a, e, o) => openDocs(preset().doc, '', o.rot),
      color: (a, e, o) => {
        const p = state.players[o.pid]; p.color = a.dataset.c; S.colors[o.pid] = p.color; saveS();
        renderPanel(o.pid); renderSheet(o, true); saveSoon(); hap(8);
      },
      flag: (a, e, o) => toggleFlag(o.pid, a.dataset.k),
      cond: (a, e, o) => toggleCond(o.pid, a.dataset.k),
      turn: (a, e, o) => { if (state.active !== o.pid) setActive(o.pid, false); },
      event: (a, e, o) => openEvent(o.pid, o.rot),
      rem: (a, e, o) => openRem(o.pid, o.rot),
      out: (a, e, o) => {
        const p = state.players[o.pid]; snap(null);
        if (status(p).out) {
          p.manual = null; if (status(p).out) p.manual = 'alive';
          addLog({ type: 'sys', pid: p.id, text: `${p.name} ist zurück im Spiel` });
        } else p.manual = 'out';
        afterChange(o.pid);
      }
    },
    input(el, o) {
      if (el.dataset.in !== 'name') return;
      const p = state.players[o.pid], v = el.value.trim();
      p.name = v || 'Spieler ' + (o.pid + 1); S.names[o.pid] = v || null;
      saveS(); saveSoon(); renderPanel(o.pid);
    },
    enter: el => el.blur()
  });
}

/* ---------- Kurzmenüs für Chips (Monarch übernehmen, Zähler, Commander Damage …) ---------- */
function docText(q) {
  if (!window.DOCS || !q || q === '-') return '';
  q = q.toLowerCase(); let best = '';
  for (const t of window.DOCS.tabs) for (const it of t.items) {
    if (it.length < 2) continue;
    const n = it[0].toLowerCase();
    if (n === q) return it[1];
    if (!best && n.startsWith(q)) best = it[1];
  }
  return best;
}
function openQuick(pid, kind, k, from) {
  const isG = kind === 'flag' && FLAGS[k].g, turns = S.turns && state.players.length > 1;
  // Monarch/Initiative übernimmt meist der Spieler am Zug -> zu ihm drehen
  const rot = isG && turns ? sheetRot(state.active) : sheetRot(pid);
  const term = kind === 'flag' ? (FLAGS[k].doc || FLAGS[k].n) : kind === 'cond' ? CONDS[k].n :
    kind === 'ctr' ? (COUNTERS[k].doc || COUNTERS[k].n) : 'Commander Damage';
  const title = kind === 'flag' ? FLAGS[k].n : kind === 'cond' ? 'Special Conditions' : kind === 'ctr' ? COUNTERS[k].n : 'Commander Damage';
  const who = p => `<div class="qhead"><b class="dot" style="background:${p.color}"></b>${esc(p.name)}</div>`;
  hap(8);
  openSheet({
    title: esc(title), rot, pid, kind, k, qf: from,
    render(o) {
      const p = state.players[o.pid]; let h = '';
      if (isG) {
        const F = FLAGS[k], holder = state[k], a = state.players[state.active];
        if (turns && holder !== state.active) h += `<button class="btn pri wide" style="margin-top:6px" data-a="give" data-p="${state.active}">${F.i} ${esc(a.name)}: ${F.take}</button>`;
        h += `<h4>Wer hat ${F.n}?</h4><div class="pgrid">${state.players.map(q => `<button class="pcard${holder === q.id ? ' on' : ''}" data-a="give" data-p="${q.id}"><b><span class="dot" style="background:${q.color}"></span> ${esc(q.name)}</b><span>${holder === q.id ? 'hat ' + F.n : 'übernimmt'}</span></button>`).join('')}</div>`;
        if (holder != null) h += `<button class="btn warn wide" data-a="give" data-p="">${F.n} entfernen</button>`;
      } else if (kind === 'flag') {
        const on = !!p.flags[k];
        h += who(p) + `<button class="btn ${on ? 'warn' : 'pri'} wide" style="margin-top:0" data-a="toggle">${FLAGS[k].n} ${on ? 'entfernen' : 'setzen'}</button>`;
      } else if (kind === 'cond') {
        h += who(p) + `<div class="tgs">${Object.keys(CONDS).map(c => `<button class="tg${p.conds[c] ? ' on' : ''}" data-a="cond" data-k="${c}">${CONDS[c].n}</button>`).join('')}</div>
          <button class="btn wide" data-a="heal">Alle heilen</button>`;
      } else if (kind === 'ctr') {
        const C = COUNTERS[k], v = p.ctr[k] || 0, st = C.step || 1;
        h += who(p) + `<div class="bigstep"><button data-a="ctr" data-d="-1">−${st}</button><b class="${C.lose && v >= C.lose ? 'lethal' : ''}">${v}</b><button data-a="ctr" data-d="1">+${st}</button></div>` +
          (C.lose ? `<p class="mut small">Ab ${C.lose} ${C.n} verliert ${esc(p.name)}.</p>` : C.max ? `<p class="mut small">Maximal ${C.max}.</p>` : '');
      } else if (kind === 'cmd') {
        const q = state.players[o.qf], a = p.cmd[o.qf] || [0, 0];
        h += `<div class="qhead"><b class="dot" style="background:${q.color}"></b>${esc(q.name)} → <b class="dot" style="background:${p.color}"></b>${esc(p.name)}</div>` +
          (S.partner ? [0, 1] : [0]).map(i => `${S.partner ? `<h4>Commander ${i + 1}</h4>` : ''}` +
            `<div class="qamts">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button data-a="hit" data-i="${i}" data-d="${n}">+${n}</button>`).join('')}</div><div class="bigstep"><button data-a="cmd" data-i="${i}" data-d="-1">−1</button><b class="${(a[i] || 0) >= 21 ? 'lethal' : ''}">${a[i] || 0}</b><button data-a="cmd" data-i="${i}" data-d="1">+1</button></div>`).join('') +
          `<p class="mut small">Tödlich ab 21 von demselben Commander.${S.cmdLife ? ' Wird automatisch vom Life abgezogen.' : ''}</p>`;
      }
      const txt = docText(term);
      if (txt) h += `<h4>Regel</h4><p class="small" style="margin:0">${esc(txt)}</p>`;
      h += `<div class="row2"><button class="btn" data-a="details">Alle Details</button><button class="btn" data-a="doc">ⓘ Doku</button></div>`;
      return h;
    },
    act: {
      give: (a, e, o) => { const v = a.dataset.p; setGlobal(o.k, v === '' ? null : +v); closeSheet(o); },
      toggle: (a, e, o) => { toggleFlag(o.pid, o.k); closeSheet(o); },
      cond: (a, e, o) => toggleCond(o.pid, a.dataset.k),
      heal: (a, e, o) => {
        const p = state.players[o.pid]; snap(null); p.conds = {};
        addLog({ type: 'sys', pid: p.id, text: `${p.name}: Special Conditions geheilt` });
        hap(15); afterChange(o.pid); closeSheet(o);
      },
      ctr: (a, e, o) => changeCtr(o.pid, o.k, (+a.dataset.d) * (COUNTERS[o.k].step || 1)),
      cmd: (a, e, o) => changeCmd(o.pid, o.qf, +a.dataset.i, +a.dataset.d),
      hit: (a, e, o) => { changeCmd(o.pid, o.qf, +a.dataset.i, +a.dataset.d); closeSheet(o); },
      details: (a, e, o) => { closeSheet(o); openPlayer(o.pid); },
      doc: (a, e, o) => openDocs(null, term, o.rot)
    }
  });
}

/* ---------- Würfel ---------- */
function face(d, v) {
  if (d.k === 'coin') return v ? 'Heads' : 'Tails';
  if (d.k === 'planar') return v === 0 ? 'Planeswalk' : v === 1 ? 'Chaos' : '—';
  return String(v + 1);
}
function stageHTML(r) {
  if (!r) return '<div class="hint">Würfel unten wählen.<br><small>Danach Fläche antippen oder Handy schütteln = neu würfeln.</small></div>';
  const { d, vals } = r, numeric = d.f > 2 && d.k !== 'planar';
  const tiles = vals.map(v => {
    const f = face(d, v), crit = d.k === 'd20' && v === 19, fail = d.k === 'd20' && v === 0;
    return `<div class="dv${f.length > 3 ? ' txt' : ''}${crit ? ' crit' : ''}${fail ? ' fail' : ''}${r.rolling ? ' spin' : ''}">${f}</div>`;
  }).join('');
  return tiles + (!r.rolling && vals.length > 1 && numeric ? `<div class="sum">Summe<b>${vals.reduce((s, v) => s + v + 1, 0)}</b></div>` : '');
}
function roll(o, k) {
  if (o.rolling) return;
  const d = DICE.find(x => x.k === k); if (!d) return;
  if (S.diceLast !== k) { S.diceLast = k; saveS(); }
  const n = k === 'planar' ? 1 : S.diceN, vals = Array.from({ length: n }, () => rnd(d.f));
  o.rolling = true; renderSheet(o, true);
  const stage = o.body.querySelector('.stage');
  const iv = setInterval(() => { stage.innerHTML = stageHTML({ d, vals: vals.map(() => rnd(d.f)), rolling: true }); }, 80);
  setTimeout(() => {
    clearInterval(iv); o.rolling = false; o.res = { d, vals };
    const numeric = d.f > 2 && k !== 'planar';
    const txt = `${n > 1 ? n + '× ' : ''}${d.n}: ${vals.map(v => face(d, v)).join(', ')}${n > 1 && numeric ? ' = ' + vals.reduce((s, v) => s + v + 1, 0) : ''}`;
    state.dice.push({ t: now(), text: txt }); if (state.dice.length > 50) state.dice.shift();
    addLog({ type: 'dice', text: txt }); saveSoon(); renderSheet(o, true); hap(35);
  }, 450);
}
function openDice() {
  openSheet({
    title: 'Würfel & Münze', static: true, res: null,
    render(o) {
      return `<div class="stage" data-a="again">${stageHTML(o.res)}</div>
        <h4>Anzahl Würfel</h4><div class="seg">${[1, 2, 3, 4, 5, 6].map(n => `<button class="${S.diceN === n ? 'on' : ''}" data-a="n" data-n="${n}">${n}</button>`).join('')}</div>
        <div class="dgrid">${DICE.map(d => `<button class="die${S.diceLast === d.k ? ' sel' : ''}" data-a="roll" data-k="${d.k}">${d.n}<span>${d.s || d.k}</span></button>`).join('')}</div>
        <button class="srow" data-a="shake"><span>Schütteln zum Würfeln<small>Würfelt den zuletzt gewählten Würfel</small></span><i class="sw${S.shake ? ' on' : ''}"></i></button>
        ${state.dice.length ? `<h4>Letzte Würfe</h4><div class="log">${state.dice.slice(-8).reverse().map(r => `<div class="le"><span class="lt">${hhmm(r.t)}</span><span class="lx">${esc(r.text)}</span></div>`).join('')}</div>` : ''}`;
    },
    act: {
      again: (a, e, o) => roll(o, S.diceLast),
      n: (a, e, o) => { S.diceN = +a.dataset.n; saveS(); renderSheet(o, true); },
      roll: (a, e, o) => roll(o, a.dataset.k),
      shake: (a, e, o) => { S.shake = !S.shake; saveS(); renderSheet(o, true); }
    },
    onOpen(o) { // Bewegungssensor nur, solange der Würfeldialog offen ist
      o.motion = e => {
        if (!S.shake) return;
        const a = e.acceleration; if (!a || a.x == null) return;
        if (Math.hypot(a.x, a.y, a.z) > 14 && now() - (o.lastShake || 0) > 1200) { o.lastShake = now(); roll(o, S.diceLast); }
      };
      window.addEventListener('devicemotion', o.motion);
    },
    onClose(o) { window.removeEventListener('devicemotion', o.motion); }
  });
}

/* ---------- Wer beginnt? ---------- */
function openFirst() {
  openSheet({
    title: 'Wer beginnt?',
    render: () => `<div class="evgrid"><button class="ev tall" data-a="rand"><i>🎯</i>Zufällig<small>Ein Feld wird markiert</small></button>
      <button class="ev tall" data-a="finger"><i>✋</i>Finger-Wahl<small>Alle legen einen Finger aufs Display</small></button></div>`,
    act: { rand: () => { closeAll(); setTimeout(pickRandom, 150); }, finger: () => { closeAll(); fingerPicker(); } }
  });
}
let picking = false;
function pickRandom() {
  if (picking) return;
  const alive = state.players.filter(p => !status(p).out).map(p => p.id);
  if (alive.length < 2) { toast('Mindestens 2 Spieler nötig'); return; }
  picking = true;
  const L = alive.length, K = L * 2 + rnd(L); let i = 0;
  const step = () => {
    $$('.panel.pick', board).forEach(el => el.classList.remove('pick'));
    const pid = alive[i % L], el = board.querySelector(`.panel[data-pid="${pid}"]`);
    el.classList.add('pick'); hap(i === K ? 120 : 6);
    if (i === K) {
      picking = false; state.turnNo = 1; setActive(pid, false);
      addLog({ type: 'sys', pid, text: `${state.players[pid].name} beginnt` });
      toast(`${esc(state.players[pid].name)} beginnt!`, { rot: rotOf(pid), ms: 2000 });
      setTimeout(() => el.classList.remove('pick'), 1500);
      return;
    }
    const t = i / K; i++;
    setTimeout(step, 70 + 330 * t * t * t);
  };
  step();
}
let picker = null;
function closePicker() { if (picker) { picker.remove(); picker = null; } }
function fingerPicker() {
  const fp = document.createElement('div'); fp.className = 'fp';
  fp.innerHTML = '<div class="fp-hint">Alle legen einen Finger aufs Display.<br><small>Nach 2 Sekunden wird zufällig gewählt.</small></div><button class="fp-x" aria-label="Schließen">✕</button>';
  document.body.appendChild(fp); picker = fp;
  const dots = new Map(), hint = fp.firstElementChild;
  let timer = 0, done = false, doneAt = 0, ci = 0;
  const arm = () => {
    clearTimeout(timer); if (done) return;
    hint.style.visibility = dots.size ? 'hidden' : 'visible';
    if (dots.size >= 2) timer = setTimeout(choose, 2000);
  };
  const choose = () => {
    done = true; doneAt = now();
    const ids = [...dots.keys()], w = ids[rnd(ids.length)];
    dots.forEach((d, id) => d.classList.add(id === w ? 'win' : 'lose'));
    hap(150);
    setTimeout(() => { if (picker === fp) { hint.textContent = 'Tippen zum Schließen'; hint.style.visibility = 'visible'; } }, 1500);
  };
  fp.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('fp-x')) { closePicker(); return; }
    if (done) { if (now() - doneAt > 900 && dots.size === 0) closePicker(); return; }
    const d = document.createElement('div'); d.className = 'fp-dot';
    d.style.setProperty('--c', COLORS[ci++ % COLORS.length]);
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    fp.appendChild(d); dots.set(e.pointerId, d); hap(10); arm();
  });
  fp.addEventListener('pointermove', e => {
    const d = dots.get(e.pointerId);
    if (d && !done) { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }
  });
  const up = e => {
    const d = dots.get(e.pointerId); if (!d) return;
    dots.delete(e.pointerId);
    if (!done) { d.remove(); arm(); }
  };
  fp.addEventListener('pointerup', up); fp.addEventListener('pointercancel', up);
}

/* ---------- Ereignisse ---------- */
function logEvent(o, t) {
  snap(null);
  addLog({ type: 'event', pid: o.pid, text: t }); saveSoon(); hap(15);
  toast('⚑ ' + esc(t), { rot: o.rot, ms: 1000 }); renderSheet(o, true);
}
function openEvent(pid, rot) {
  openSheet({
    title: 'Ereignis notieren', rot: rot || 0, pid: pid == null ? null : pid,
    render(o) {
      const P = preset(), list = EV[P.ev] || EV.gen, custom = S.events[P.ev] || [];
      const recent = state.log.filter(e => e.type === 'event').slice(-5).reverse();
      return `<h4>Wer?</h4><div class="pchips">${pchips(o.pid, 'Allgemein')}</div>
        <h4>Was?</h4><div class="evgrid">${list.concat(custom).map((t, i) => `<button class="ev${i >= list.length ? ' custom' : ''}" data-a="ev" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <h4>Eigene Notiz</h4><div class="inrow"><input data-in="note" placeholder="Was ist passiert?" maxlength="120"><button class="btn pri" data-a="note">✓</button></div>
        <button class="lnk" data-a="save">+ Als Button speichern</button>${custom.length ? '<button class="lnk" data-a="clr">Eigene Buttons löschen</button>' : ''}
        ${recent.length ? `<h4>Zuletzt</h4><div class="log">${recent.map(logRow).join('')}</div>` : ''}`;
    },
    act: {
      selp,
      ev: (a, e, o) => logEvent(o, a.dataset.t),
      note: (a, e, o) => { const i = o.body.querySelector('[data-in="note"]'), t = i.value.trim(); if (t) { i.value = ''; logEvent(o, t); } },
      save: (a, e, o) => {
        const i = o.body.querySelector('[data-in="note"]'), t = i.value.trim(), P = preset();
        if (!t) { toast('Erst Text eingeben', { rot: o.rot }); return; }
        (S.events[P.ev] = S.events[P.ev] || []).push(t); saveS(); i.value = ''; renderSheet(o, true);
      },
      clr: (a, e, o) => { S.events[preset().ev] = []; saveS(); renderSheet(o, true); }
    },
    enter: (el, o) => { const t = el.value.trim(); if (t) { el.value = ''; el.blur(); logEvent(o, t); } }
  });
}

/* ---------- Merker ---------- */
function addRem(o) {
  const inp = o.body.querySelector('[data-in="rem"]'), t = inp.value.trim(); if (!t) return;
  state.reminders.push({ id: uid(), text: t, pid: o.pid, onTurn: o.onTurn });
  inp.value = ''; inp.blur(); saveSoon(); updateHub(); renderSheet(o, true); hap(10);
}
function openRem(pid, rot) {
  openSheet({
    title: 'Merker', rot: rot || 0, pid: pid == null ? null : pid, onTurn: true,
    render(o) {
      const ps = state.players;
      return `<p class="mut small" style="margin-top:4px">Erinnerungen wie Upkeep-Trigger oder „Rhystic Study – 1 zahlen?“. Mit 🔔 erscheinen sie automatisch, wenn der Spieler am Zug ist.</p>
        <div class="inrow"><input data-in="rem" placeholder="Neuer Merker" maxlength="90"><button class="btn pri" data-a="add">＋</button></div>
        <h4>Für</h4><div class="pchips">${pchips(o.pid, 'Alle')}<button class="pchip${o.onTurn ? ' on' : ''}" data-a="bell">🔔 bei Zugbeginn</button></div>
        <h4>Aktiv (${state.reminders.length})</h4>
        ${state.reminders.map(r => `<div class="rem"><div class="rt">${esc(r.text)}<small>${r.pid == null ? 'Alle' : esc(ps[r.pid] ? ps[r.pid].name : '?')}${r.onTurn ? ' · 🔔 bei Zugbeginn' : ''}</small></div>
          <button class="ib" data-a="rbell" data-id="${r.id}" aria-label="Glocke">${r.onTurn ? '🔔' : '🔕'}</button><button class="ib" data-a="rdel" data-id="${r.id}" aria-label="Löschen">✕</button></div>`).join('') || '<p class="mut small">Keine Merker.</p>'}`;
    },
    act: {
      selp, add: (a, e, o) => addRem(o),
      bell: (a, e, o) => { o.onTurn = !o.onTurn; renderSheet(o, true); },
      rbell: (a, e, o) => { const r = state.reminders.find(x => x.id === a.dataset.id); if (r) { r.onTurn = !r.onTurn; saveSoon(); renderSheet(o, true); } },
      rdel: (a, e, o) => { state.reminders = state.reminders.filter(x => x.id !== a.dataset.id); saveSoon(); updateHub(); renderSheet(o, true); hap(10); }
    },
    enter: (el, o) => addRem(o)
  });
}

/* ---------- Protokoll ---------- */
function logText(e) {
  const nm = i => esc(state.players[i] ? state.players[i].name : '?');
  switch (e.type) {
    case 'life': return `${nm(e.pid)} <b class="${e.d < 0 ? 'neg' : 'pos'}">${sgn(e.d)}</b> → ${num(e.v)}`;
    case 'ctr': { const C = COUNTERS[e.k] || { n: e.k }; return `${nm(e.pid)} · ${C.n} <b>${sgn(e.d)}</b> → ${e.v}`; }
    case 'cmd': return `${nm(e.pid)} ${e.d > 0 ? 'erhält' : 'korrigiert'} <b class="neg">${Math.abs(e.d)}</b> Commander Damage von ${nm(e.from)} (ges. ${e.v})`;
    case 'event': return `⚑ ${e.pid != null ? nm(e.pid) + ': ' : ''}${esc(e.text)}`;
    case 'turn': return `Zug ${e.turn} · ${nm(e.pid)} ist am Zug`;
    case 'dice': return `🎲 ${esc(e.text)}`;
    default: return esc(e.text);
  }
}
function logRow(e) {
  const p = e.pid != null ? state.players[e.pid] : null;
  return `<div class="le ${e.type}"><span class="lt">${hhmm(e.t)}<br><small>Z${e.turn}</small></span><span class="ld" style="background:${p ? p.color : 'transparent'}"></span><span class="lx">${logText(e)}</span></div>`;
}
function exportText() {
  const P = preset(), d = document.createElement('div');
  const lines = state.log.map(e => { d.innerHTML = logText(e); return `[${hhmm(e.t)} · Z${e.turn}] ${d.textContent}`; });
  return `${P.n} – ${new Date(state.startedAt).toLocaleString('de-DE')}\n${state.players.map(p => `${p.name}: ${p.life}`).join(' | ')}\n\n${lines.join('\n')}`;
}
function copyText(t) { try { if (NB && NB.copy) { NB.copy(t); return; } navigator.clipboard.writeText(t).catch(() => { }); } catch (e) { } }
function shareText(t) {
  if (NB && NB.share) { NB.share(t); return; }
  if (navigator.share) { navigator.share({ text: t }).catch(() => { }); return; }
  copyText(t); toast('In Zwischenablage kopiert');
}
function chartHTML() {
  const H = state.hist, ps = state.players;
  if (H.length < 2) return '<p class="mut" style="margin-top:14px">Sobald sich Werte ändern, erscheint hier der Verlauf.</p>';
  const W = 640, Hh = 300, pl = 44, pr = 14, pt = 16, pb = 22;
  let mn = 0, mx = 1;
  for (const h of H) for (const v of h.l) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const X = i => pl + (W - pl - pr) * i / (H.length - 1), Y = v => pt + (Hh - pt - pb) * (1 - (v - mn) / (mx - mn));
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = Math.round(mn + (mx - mn) * k / 4), y = Y(v).toFixed(1);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.08)"/><text x="${pl - 8}" y="${+y + 4}" text-anchor="end" fill="#9aa1b2" font-size="13">${v}</text>`;
  }
  const lines = ps.map((p, pi) => {
    const pts = H.map((h, i) => X(i).toFixed(1) + ',' + Y(h.l[pi] != null ? h.l[pi] : 0).toFixed(1));
    const last = pts[pts.length - 1].split(',');
    return `<polyline fill="none" stroke="${p.color}" stroke-width="3" stroke-linejoin="round" points="${pts.join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="5" fill="${p.color}"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}">${g}${lines}</svg>
    <div class="legend">${ps.map(p => `<span><b class="dot" style="background:${p.color}"></b>${esc(p.name)} · ${num(p.life)}</span>`).join('')}</div>`;
}
function statsHTML() {
  const ps = state.players, P = preset(), s = ps.map(() => ({ minus: 0, plus: 0, cmdOut: 0, cmdIn: 0 }));
  for (const e of state.log) {
    if (e.type === 'life' && s[e.pid]) { if (e.d < 0) s[e.pid].minus -= e.d; else s[e.pid].plus += e.d; }
    else if (e.type === 'cmd' && s[e.pid] && s[e.from]) { s[e.pid].cmdIn += e.d; s[e.from].cmdOut += e.d; }
  }
  const t = now();
  return `<div class="stat"><div><b>${fmtT(t - state.startedAt)}</b><span>Spieldauer</span></div><div class="clk"><b>${state.turnNo}</b><span>Züge</span></div></div>
    <table class="st"><tr><th>Spieler</th><th>${esc(P.label || 'Life')}</th><th>Σ −</th><th>Σ +</th>${P.cmd ? '<th>Cmd ausgeteilt</th>' : ''}<th>Zugzeit</th></tr>
    ${ps.map((p, i) => `<tr><td><b class="dot" style="background:${p.color}"></b> ${esc(p.name)}</td><td>${num(p.life)}</td><td>${s[i].minus + (S.cmdLife ? s[i].cmdIn : 0)}</td><td>${s[i].plus}</td>${P.cmd ? `<td>${s[i].cmdOut}</td>` : ''}<td>${fmtT(p.time + (state.active === i ? t - state.turnStart : 0))}</td></tr>`).join('')}</table>`;
}
function openLog() {
  openSheet({
    title: 'Protokoll', tab: 'list',
    render(o) {
      const tabs = `<div class="seg" style="margin-top:6px">${[['list', 'Verlauf'], ['chart', 'Grafik'], ['stats', 'Statistik']].map(([k, l]) => `<button class="${o.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${l}</button>`).join('')}</div>`;
      if (o.tab === 'chart') return tabs + chartHTML();
      if (o.tab === 'stats') return tabs + statsHTML();
      return tabs + `<div class="row2"><button class="btn" data-a="copy">Kopieren</button><button class="btn" data-a="share">Teilen</button></div>
        <div class="log">${state.log.slice(-200).reverse().map(logRow).join('') || '<p class="mut">Noch leer.</p>'}</div>`;
    },
    act: {
      tab: (a, e, o) => { o.tab = a.dataset.k; renderSheet(o, true); },
      copy: () => { copyText(exportText()); toast('Kopiert'); },
      share: () => shareText(exportText())
    }
  });
}

/* ---------- Doku ---------- */
const docItem = (k, v, src) => `<div class="doc"><b>${esc(k)}</b>${src ? ` <small class="mut">· ${esc(src)}</small>` : ''}<p>${esc(v)}</p></div>`;
function docResults(o) {
  const D = window.DOCS, q = o.q.trim().toLowerCase();
  if (q) {
    const hits = [];
    D.tabs.forEach(t => t.items.forEach(it => {
      if (it.length < 2) return;
      const inTerm = it[0].toLowerCase().includes(q);
      if (inTerm || it[1].toLowerCase().includes(q)) hits.push({ r: inTerm ? 0 : 1, it, src: t.n });
    }));
    hits.sort((a, b) => a.r - b.r);
    return hits.length ? hits.map(h => docItem(h.it[0], h.it[1], h.src)).join('') : '<p class="mut">Nichts gefunden.</p>';
  }
  const t = D.tabs.find(x => x.id === o.tab) || D.tabs[0];
  return t.items.map(it => it.length === 1 ? `<h4>${esc(it[0].replace(/^## /, ''))}</h4>` : docItem(it[0], it[1])).join('');
}
function openDocs(tab, q, rot) {
  if (!window.DOCS) { toast('Doku nicht verfügbar'); return; }
  openSheet({
    title: 'Doku & Regeln', rot: rot || 0, static: true, tab: tab || preset().doc || 'modes', q: q || '',
    render(o) {
      return `<div class="inrow" style="margin-top:6px"><input data-in="q" type="search" placeholder="Begriff suchen, z. B. Trample" value="${esc(o.q)}"></div>
        <div class="seg tabs">${window.DOCS.tabs.map(t => `<button class="${!o.q && o.tab === t.id ? 'on' : ''}" data-a="tab" data-k="${t.id}">${t.n}</button>`).join('')}</div>
        <div class="docres">${docResults(o)}</div>`;
    },
    act: { tab: (a, e, o) => { o.tab = a.dataset.k; o.q = ''; renderSheet(o, true); o.body.scrollTop = 0; } },
    input(el, o) { if (el.dataset.in === 'q') { o.q = el.value; o.body.querySelector('.docres').innerHTML = docResults(o); } },
    enter: el => el.blur()
  });
}

/* ---------- Neues Spiel ---------- */
function gameRow(g) {
  const P = PRESETS[g.preset] || { n: '?' }, d = new Date(g.t), single = g.players.filter(x => !x.o).length === 1;
  const ps = g.players.map(p => `${p.w || (!p.o && single) ? '🏆 ' : ''}${esc(p.n)} ${p.l}`).join(' · ');
  return `<div class="game"><span><b>${esc(P.n)}</b> <small>${d.toLocaleDateString('de-DE')} ${hhmm(g.t)}</small><br><small>${ps}</small></span><span class="mut">${fmtT(g.end - g.t)}<br><small>${g.turns} Züge</small></span></div>`;
}
function archive() {
  if (!state || !state.log.some(e => e.type === 'life' || e.type === 'cmd' || e.type === 'ctr')) return;
  games.unshift({
    t: state.startedAt, end: now(), preset: state.preset, turns: state.turnNo,
    players: state.players.map(p => { const s = status(p); return { n: p.name, l: p.life, o: !!s.out, w: !!s.win }; })
  });
  games = games.slice(0, 30); LS.set('lc.games', games);
}
function startGame(pk, n, start) {
  flushPending(); archive();
  state = makeGame(pk, n, start); undoStack = []; undoKey = null;
  clearBubbles(); renderBoard(); saveNow();
  toast(esc(PRESETS[pk].n) + ' · viel Spaß!'); hap(30);
}
function openNew() {
  openSheet({
    title: 'Neues Spiel', sel: state.preset, n: state.players.length, start: state.start,
    render(o) {
      const P = PRESETS[o.sel];
      return `<h4>Spiel</h4><div class="pgrid">${Object.keys(PRESETS).map(k => { const p = PRESETS[k]; return `<button class="pcard${o.sel === k ? ' on' : ''}" data-a="pre" data-k="${k}"><b>${p.n}</b><span>${p.label || 'Life'} ${p.start}${p.winAt ? ' → ' + p.winAt : ''}${p.cmd ? ' · Cmd Damage' : ''}</span></button>`; }).join('')}</div>
        <h4>Spieler</h4><div class="seg">${[1, 2, 3, 4, 5, 6].map(n => `<button class="${o.n === n ? 'on' : ''}" data-a="n" data-n="${n}">${n}</button>`).join('')}</div>
        <h4>Startwert · ${esc(P.label || 'Life')}</h4>
        <div class="startrow"><button data-a="st" data-d="-1">−</button><input type="number" inputmode="numeric" data-in="start" value="${o.start}"><button data-a="st" data-d="1">+</button></div>
        <div class="quick">${(P.quick || []).map(v => `<button class="pchip${o.start === v ? ' on' : ''}" data-a="q" data-v="${v}">${v}</button>`).join('')}</div>
        <button class="btn pri wide" data-a="go">Spiel starten</button>
        <button class="lnk" data-a="info">ⓘ Was ist ${esc(P.n)}?</button>
        ${games.length ? `<h4>Letzte Spiele</h4>${games.slice(0, 10).map(gameRow).join('')}` : ''}`;
    },
    act: {
      pre: (a, e, o) => { o.sel = a.dataset.k; const P = PRESETS[o.sel]; o.n = P.players; o.start = P.start; renderSheet(o, true); },
      n: (a, e, o) => { o.n = +a.dataset.n; renderSheet(o, true); },
      st: (a, e, o) => { o.start += (+a.dataset.d) * PRESETS[o.sel].big; renderSheet(o, true); },
      q: (a, e, o) => { o.start = +a.dataset.v; renderSheet(o, true); },
      info: (a, e, o) => openDocs('modes', PRESETS[o.sel].n.split(' /')[0]),
      go: (a, e, o) => { closeAll(); startGame(o.sel, o.n, o.start); }
    },
    input(el, o) { if (el.dataset.in === 'start') { const v = parseInt(el.value, 10); if (!isNaN(v)) o.start = v; } },
    enter: el => el.blur()
  });
}

/* ---------- Runde fortsetzen? (nach Kaltstart) ---------- */
function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  if (m < 1440) return `vor ${Math.floor(m / 60)} Std.`;
  return 'am ' + new Date(now() - ms).toLocaleDateString('de-DE');
}
function openResume(after) {
  const P = preset(), t = now(), last = state.lastSeen || t, gap = Math.max(0, t - last);
  openSheet({
    title: 'Runde fortsetzen?', done: false,
    render: () => `<div class="stat"><div><b>${esc(P.n)}</b><span>${state.players.length} Spieler · Zug ${state.turnNo}</span></div>
        <div class="clk"><b>${fmtT(last - state.startedAt)}</b><span>zuletzt ${ago(gap)}</span></div></div>
      <div class="resume">${state.players.map(p => { const s = status(p);
        return `<div class="rrow"><b class="dot" style="background:${p.color}"></b><span>${esc(p.name)}${s.out ? ' <small class="mut">☠ raus</small>' : s.win ? ' <small class="mut">🏆</small>' : ''}</span><b>${num(p.life)}</b></div>`; }).join('')}</div>
      <div class="row2"><button class="btn" data-a="new">Neues Spiel</button><button class="btn pri" data-a="go">Fortsetzen</button></div>
      <button class="lnk" data-a="restart">Gleiches Spiel neu starten</button>`,
    act: {
      go: (a, e, o) => closeSheet(o),
      new: (a, e, o) => { o.done = true; closeSheet(o); openNew(); },
      restart: (a, e, o) => { o.done = true; closeSheet(o); startGame(state.preset, state.players.length, state.start); }
    },
    onClose(o) {
      if (!o.done) { // Fortsetzen: geschlossene Zeit nicht als Spiel-/Zugzeit zählen
        state.turnStart += gap; state.startedAt += gap; saveNow(); renderPanels();
      }
      if (after) after();
    }
  });
}

/* ---------- Einstellungen ---------- */
function applySettings(k) {
  document.body.classList.toggle('nozones', !S.zones);
  if (k === 'rotate') renderBoard(); else renderPanels();
  if (k === 'awake' && NB && NB.keepAwake) NB.keepAwake(!!S.awake);
}
function openSettings() {
  const T = (k, l, d) => `<button class="srow" data-a="tg" data-k="${k}"><span>${l}<small>${d}</small></span><i class="sw${S[k] ? ' on' : ''}"></i></button>`;
  const SEG = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${S[k] === v ? 'on' : ''}" data-a="seg" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  openSheet({
    title: 'Einstellungen',
    render: () => `
      <h4>Bedienung</h4>
      ${T('haptics', 'Vibration', 'Kurzes Feedback beim Tippen')}
      ${T('zones', '+ / − anzeigen', 'Tipp-Hinweise in den Feldern')}
      <h4>Gedrückt halten</h4>${SEG('holdMode', [['big', 'Große Schritte'], ['repeat', 'Schnell zählen']])}
      <h4>Verzögerung bis „Halten“</h4>${SEG('holdMs', [[300, 'Kurz'], [450, 'Normal'], [700, 'Lang']])}
      <h4>Änderungen zusammenfassen nach</h4>${SEG('commitMs', [[1000, '1 s'], [1800, '1,8 s'], [3000, '3 s']])}
      <h4>Tisch</h4>
      ${T('rotate', 'Felder zu Spielern drehen', 'Für Spieler rund um das Handy')}
      ${T('turns', 'Zugverfolgung', 'Aktiver Spieler, „Zug beenden“, Merker bei Zugbeginn')}
      ${T('turnTimer', 'Zug-Timer', 'Laufende Zeit im aktiven Feld')}
      ${T('checks', 'Zug-Checkliste', 'z. B. Land drop, Energy, Supporter')}
      ${T('hints', 'Regel-Hinweise beim Zugwechsel', 'Monarch, Initiative, Day/Night, Rad, Pokémon Checkup')}
      ${T('awake', 'Bildschirm anlassen', 'Display geht während des Spiels nicht aus')}
      ${T('askResume', 'Beim Start nachfragen', '„Runde fortsetzen oder neues Spiel?“ nach dem Beenden der App')}
      <h4>Commander</h4>
      ${T('cmdLife', 'Commander Damage zieht Life ab', 'Automatisch vom Leben abziehen')}
      ${T('autoMonarch', 'Monarch/Initiative automatisch übergeben', 'Bei eingetragenem Commander Damage (= Combat Damage) übernimmt der Angreifer')}
      ${T('partner', 'Partner (zwei Commander)', 'Zweiter Zähler pro Gegner')}
      <h4>Updates</h4>
      ${T('updates', 'Beim Start nach Updates suchen', 'Prüft die neueste Version im GitHub-Repo')}
      <div class="row2"><button class="btn" data-a="upd">Jetzt prüfen</button><span class="mut small" style="align-self:center">Installiert: v${esc(appVersion())}</span></div>
      <h4>Daten</h4>
      <div class="row2"><button class="btn" data-a="names">Namen & Farben zurücksetzen</button><button class="btn warn" data-a="wipe">Alles löschen</button></div>
      <p class="mut small" style="margin-top:16px;text-align:center">Life Counter · keine Werbung, keine Tracker</p>`,
    act: {
      upd: () => checkUpdate(true),
      tg: (a, e, o) => { const k = a.dataset.k; S[k] = !S[k]; saveS(); applySettings(k); renderSheet(o, true); hap(8); },
      seg: (a, e, o) => { const k = a.dataset.k, v = a.dataset.v; S[k] = isNaN(+v) ? v : +v; saveS(); renderSheet(o, true); hap(8); },
      names: () => {
        S.names = []; S.colors = []; saveS();
        state.players.forEach((p, i) => { p.name = 'Spieler ' + (i + 1); p.color = COLORS[i % COLORS.length]; });
        renderPanels(); saveSoon(); toast('Zurückgesetzt');
      },
      wipe: () => confirmBox('Alle Daten (aktuelles Spiel, Verlauf, Einstellungen) löschen?', 'Löschen', () => { try { localStorage.clear(); } catch (e) { } location.reload(); })
    }
  });
}

/* ---------- Update-Check (läuft nativ, Ergebnis kommt über window.__onUpdate) ---------- */
function appVersion() { try { return NB && NB.version ? NB.version() : 'web'; } catch (e) { return '?'; } }
function checkUpdate(manual) {
  if (NB && NB.checkUpdate) NB.checkUpdate(!!manual);
  else if (manual) toast('Nur in der installierten App verfügbar');
}
window.__onUpdate = json => {
  let r; try { r = JSON.parse(json); } catch (e) { return; }
  if (r.status === 'update') {
    if (!r.manual && S.skipVer === r.latest) return;
    openSheet({
      title: 'Update verfügbar',
      render: () => `<p class="cf">Version <b>${esc(r.latest)}</b> ist verfügbar (installiert: ${esc(r.current)}).</p>
        ${r.notes ? `<h4>Neu</h4><p class="small" style="white-space:pre-wrap;margin:0">${esc(r.notes)}</p>` : ''}
        <div class="row2"><button class="btn" data-a="skip">Überspringen</button><button class="btn pri" data-a="dl">Herunterladen</button></div>
        <p class="mut small">Die APK wird im Browser geladen. Danach öffnen und „Aktualisieren“ tippen – Spielstand und Einstellungen bleiben erhalten.</p>`,
      act: {
        dl: (a, e, o) => { window.__save(); NB.openUrl(r.url); closeSheet(o); },
        skip: (a, e, o) => { S.skipVer = r.latest; saveS(); closeSheet(o); }
      }
    });
  } else if (r.manual) {
    toast(r.status === 'current' ? `Aktuell (v${esc(r.current)})` :
      r.status === 'disabled' ? 'Kein Update-Repo konfiguriert' : 'Prüfung fehlgeschlagen (offline?)');
  }
};

/* ================= Start ================= */
window.__save = () => { flushPending(); saveNow(); };
let backAt = 0;
window.__onBack = () => {
  if (picker) { closePicker(); return true; }
  if (sheets.length) { closeSheet(sheets[sheets.length - 1]); return true; }
  const t = now();
  if (t - backAt < 2000) { window.__save(); return false; }
  backAt = t; toast('Nochmal „Zurück“ zum Beenden'); return true;
};
document.addEventListener('visibilitychange', () => { if (document.hidden) window.__save(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// Sekundentakt nur für sichtbare Timer; im Hintergrund pausiert
setInterval(() => {
  if (document.hidden) return;
  const t = now();
  for (const e of document.querySelectorAll('[data-tmr]')) e.textContent = fmtT(t - state.turnStart);
  for (const e of document.querySelectorAll('[data-clock]')) e.textContent = fmtT(t - state.startedAt);
}, 1000);

let first = false;
if (!valid(state)) { state = makeGame('commander', 4, 40); first = true; }
state.reminders = state.reminders || []; state.dice = state.dice || []; state.hist = state.hist || [];
renderBoard();
if (NB && NB.keepAwake) NB.keepAwake(!!S.awake);
const afterStart = () => { if (S.updates) setTimeout(() => checkUpdate(false), 800); };
if (first) { setTimeout(openNew, 200); afterStart(); }
else if (S.askResume) openResume(afterStart); // jeder Kaltstart mit gespeichertem Spiel
else afterStart();

})();
