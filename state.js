/* Threshold: screen flow and saved progress.
 *
 * Pure. No DOM, no engine, no randomness. Everything here is a plain transition on a plain object,
 * so the rules that matter (you cannot re-roll a round you already ran; you cannot act before
 * setting your values) are testable in Node instead of by clicking.
 */

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'threshold-save';

/* 19 screens. Each round runs: worked example, your values, your information, debrief.
 * Round 3 swaps the information step for referrals, because predictions are free by then. */
export const STEPS = [
  { id: 'start' },
  { id: 'precheck' },
  { id: 'example',   round: 'r1' },
  { id: 'values',    round: 'r1' },
  { id: 'info',      round: 'r1' },
  { id: 'debrief',   round: 'r1' },
  { id: 'example',   round: 'r2' },
  { id: 'values',    round: 'r2' },
  { id: 'info',      round: 'r2' },
  { id: 'debrief',   round: 'r2' },
  { id: 'loop' },
  { id: 'example',   round: 'r3' },
  { id: 'values',    round: 'r3' },
  { id: 'referrals', round: 'r3' },
  { id: 'debrief',   round: 'r3' },
  { id: 'summary' },
  { id: 'postcheck' },
  { id: 'canvas' },
  { id: 'end' }
];

export const ROUND_IDS = ['r1', 'r2', 'r3'];

export function initialState(seed = 1, defaults = { loss: 1.0, firstTime: 0 }) {
  return {
    v: SAVE_VERSION,
    seed,
    step: 0,
    weights: { ...defaults },
    bought: { r1: [], r2: [], r3: [] },
    loop: null,                 // null until the player is asked
    referred: [],
    results: {},                // roundId -> numbers only, never functions
    precheck: {},
    postcheck: {},
    canvas: {},
    startedAt: null
  };
}

export const stepAt = s => STEPS[s.step];
export const isResolved = (s, roundId) => Object.prototype.hasOwnProperty.call(s.results, roundId);

/* Back is allowed inside a round until you run it, and never afterwards: letting a player return
 * to a resolved round would let them re-roll the outcome until they liked it, which would teach
 * them to fish rather than to decide. */
export function canGoBack(s) {
  const step = stepAt(s);
  if (!step || s.step === 0) return false;
  if (!step.round) return false;
  if (step.id === 'example') return false;
  if (isResolved(s, step.round)) return false;
  const prev = STEPS[s.step - 1];
  return !!prev && prev.round === step.round && prev.id !== 'example';
}

export function next(s) {
  if (s.step >= STEPS.length - 1) return s;
  return { ...s, step: s.step + 1 };
}

export function back(s) {
  if (!canGoBack(s)) return s;
  return { ...s, step: s.step - 1 };
}

export function goTo(s, stepId, roundId) {
  const i = STEPS.findIndex(x => x.id === stepId && (roundId ? x.round === roundId : true));
  return i < 0 ? s : { ...s, step: i };
}

export function setWeights(s, weights) {
  const step = stepAt(s);
  if (step && step.round && isResolved(s, step.round)) return s;   // locked once the round is run
  return { ...s, weights: { ...s.weights, ...weights } };
}

export function toggleBuy(s, roundId, segKey) {
  if (isResolved(s, roundId)) return s;
  const cur = s.bought[roundId] || [];
  const nextList = cur.includes(segKey) ? cur.filter(k => k !== segKey) : cur.concat(segKey);
  return { ...s, bought: { ...s.bought, [roundId]: nextList } };
}

export function setLoop(s, value) {
  return { ...s, loop: !!value };
}

export function toggleRefer(s, index, hours) {
  if (isResolved(s, 'r3')) return s;
  const has = s.referred.includes(index);
  if (!has && s.referred.length >= hours) return s;                // the budget is the lesson
  return { ...s, referred: has ? s.referred.filter(i => i !== index) : s.referred.concat(index) };
}

/* Resolving is idempotent per round: a double-click cannot draw a second set of outcomes. */
export function resolveRound(s, roundId, result) {
  if (isResolved(s, roundId)) return s;
  return { ...s, results: { ...s.results, [roundId]: result } };
}

export function setAnswer(s, phase, questionId, choice) {
  return { ...s, [phase]: { ...s[phase], [questionId]: choice } };
}

export function setCanvas(s, cellId, text) {
  return { ...s, canvas: { ...s.canvas, [cellId]: text } };
}

export function serialize(s) { return JSON.stringify(s); }

/* A save from an older build is discarded rather than migrated: the numbers behind the lessons
 * move between builds, and a half-old session would show a debrief that no longer adds up. */
export function deserialize(raw) {
  if (!raw) return { state: null, reason: 'empty' };
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return { state: null, reason: 'corrupt' }; }
  if (!parsed || typeof parsed !== 'object') return { state: null, reason: 'corrupt' };
  if (parsed.v !== SAVE_VERSION) return { state: null, reason: 'version' };
  if (typeof parsed.step !== 'number' || parsed.step < 0 || parsed.step >= STEPS.length)
    return { state: null, reason: 'corrupt' };
  return { state: parsed, reason: null };
}

/* localStorage throws in a private window and can be blocked outright, so every call is guarded
 * and the game plays on without persistence. */
export function makeStorage(backing) {
  const store = backing === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : backing;
  return {
    available: !!store,
    save(s) { try { store.setItem(SAVE_KEY, serialize(s)); return true; } catch (e) { return false; } },
    load() { try { return deserialize(store.getItem(SAVE_KEY)); } catch (e) { return { state: null, reason: 'blocked' }; } },
    clear() { try { store.removeItem(SAVE_KEY); } catch (e) { /* nothing to do */ } }
  };
}

export function progressLabel(s) {
  const step = stepAt(s);
  if (!step) return '';
  const names = { start: 'Start', precheck: 'Three quick calls', example: 'How this works',
    values: 'Your values', info: 'Your information', referrals: 'Who to review',
    debrief: 'Where your points went', loop: 'Before round 3', summary: 'Across three rounds',
    postcheck: 'Your calls, revisited', canvas: 'Your organization', end: 'Done' };
  const round = step.round ? `Round ${ROUND_IDS.indexOf(step.round) + 1} of 3` : '';
  return { round, name: names[step.id] || step.id };
}
