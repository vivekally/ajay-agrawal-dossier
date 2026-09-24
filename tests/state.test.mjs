import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS, SAVE_VERSION, initialState, stepAt, next, back, canGoBack, goTo,
  setWeights, toggleBuy, toggleRefer, setLoop, resolveRound, isResolved,
  serialize, deserialize, makeStorage, progressLabel
} from '../state.js';

const at = (s, id, round) => goTo(s, id, round);

test('the flow is 19 screens and every round has its four steps', () => {
  assert.equal(STEPS.length, 19);
  for (const r of ['r1', 'r2']) {
    const ids = STEPS.filter(s => s.round === r).map(s => s.id);
    assert.deepEqual(ids, ['example', 'values', 'info', 'debrief']);
  }
  assert.deepEqual(STEPS.filter(s => s.round === 'r3').map(s => s.id),
    ['example', 'values', 'referrals', 'debrief'], 'round 3 swaps buying for reviewing');
});

test('back works inside a round before you run it, and never after', () => {
  let s = at(initialState(), 'info', 'r1');
  assert.ok(canGoBack(s), 'from information back to your values');
  assert.equal(stepAt(back(s)).id, 'values');
  s = resolveRound(s, 'r1', { gapToPar: 0 });
  assert.equal(canGoBack(s), false, 'a resolved round cannot be re-entered');
  assert.equal(back(s).step, s.step, 'back is a no-op there');
  assert.equal(canGoBack(at(initialState(), 'example', 'r1')), false, 'never back past a worked example');
  assert.equal(canGoBack(initialState()), false);
});

test('resolving a round is idempotent, so a double-click cannot re-roll it', () => {
  let s = at(initialState(), 'info', 'r1');
  s = resolveRound(s, 'r1', { realized: 10 });
  s = resolveRound(s, 'r1', { realized: 999 });
  assert.equal(s.results.r1.realized, 10);
  assert.ok(isResolved(s, 'r1'));
});

test('values and purchases lock once the round is resolved', () => {
  let s = at(initialState(), 'values', 'r1');
  s = setWeights(s, { loss: 1.5 });
  assert.equal(s.weights.loss, 1.5);
  s = toggleBuy(s, 'r1', 'restaurants');
  assert.deepEqual(s.bought.r1, ['restaurants']);
  s = toggleBuy(s, 'r1', 'restaurants');
  assert.deepEqual(s.bought.r1, [], 'toggles off');
  s = resolveRound(s, 'r1', {});
  assert.equal(setWeights(s, { loss: 2.25 }).weights.loss, 1.5, 'weights frozen after the round runs');
  assert.deepEqual(toggleBuy(s, 'r1', 'workshops').bought.r1, [], 'purchases frozen too');
});

test('the review budget binds: a sixth referral is refused', () => {
  let s = at(initialState(), 'referrals', 'r3');
  for (const i of [0, 1, 2, 3, 4]) s = toggleRefer(s, i, 5);
  assert.equal(s.referred.length, 5);
  s = toggleRefer(s, 9, 5);
  assert.equal(s.referred.length, 5, 'the 6th is refused');
  s = toggleRefer(s, 0, 5);
  assert.equal(s.referred.length, 4, 'but you can free an hour back up');
});

test('a save round-trips, and a stale or corrupt one is discarded rather than migrated', () => {
  let s = initialState(7);
  s = setWeights(s, { loss: 1.75, firstTime: 3 });
  s = setLoop(s, true);
  s = resolveRound(s, 'r1', { gapToPar: 4.2 });
  const back = deserialize(serialize(s));
  assert.equal(back.reason, null);
  assert.deepEqual(back.state.weights, { loss: 1.75, firstTime: 3 });
  assert.equal(back.state.results.r1.gapToPar, 4.2);
  assert.equal(deserialize(JSON.stringify({ ...s, v: SAVE_VERSION - 1 })).reason, 'version');
  assert.equal(deserialize('{not json').reason, 'corrupt');
  assert.equal(deserialize(JSON.stringify({ v: SAVE_VERSION, step: 99 })).reason, 'corrupt');
  assert.equal(deserialize('').reason, 'empty');
});

test('storage that throws never breaks the game', () => {
  const hostile = { setItem() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const st = makeStorage(hostile);
  assert.equal(st.save(initialState()), false, 'reports failure instead of throwing');
  assert.equal(st.load().state, null);
  st.clear();
  const none = makeStorage(null);
  assert.equal(none.available, false);
});

test('a real storage round-trips through the wrapper', () => {
  const mem = new Map();
  const st = makeStorage({ setItem: (k, v) => mem.set(k, v), getItem: k => mem.get(k) ?? null, removeItem: k => mem.delete(k) });
  const s = setWeights(initialState(3), { loss: 2 });
  assert.equal(st.save(s), true);
  assert.equal(st.load().state.weights.loss, 2);
  st.clear();
  assert.equal(st.load().reason, 'empty');
});

test('the progress label always says where you are', () => {
  const s = at(initialState(), 'values', 'r2');
  assert.deepEqual(progressLabel(s), { round: 'Round 2 of 3', name: 'Your values' });
  assert.equal(progressLabel(at(initialState(), 'canvas')).round, '');
});

test('walking the whole flow forward never falls off either end', () => {
  let s = initialState();
  for (let i = 0; i < 40; i++) s = next(s);
  assert.equal(s.step, STEPS.length - 1);
  assert.equal(stepAt(s).id, 'end');
  assert.equal(back(initialState()).step, 0);
});
