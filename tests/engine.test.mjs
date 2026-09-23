/* The book's lessons, written as tests.
 *
 * This file exists because the original design of this game was numerically wrong in ways nobody
 * could see by reading it: its round-1 prediction destroyed value, and its "judgment" module could
 * not produce a loss. Every lesson the game claims to teach is asserted here. If you change a
 * number in scenarios/lending.js and a test fails, you broke a lesson, not a test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32, makePrior, samplePrior, gaussian, posteriorTable, lookupPHat,
  threshold, bestAction, actionValue, roundValue, parSearch, decompose,
  valueOfInformation, freeValue, perfectInfoValue, prepareRound, simulateRound, DECLINE
} from '../engine.js';
import { facts, buildRound, segments } from '../scenarios/lending.js';

const BOARD = facts.board, DEFAULTS = facts.defaults;
const R = id => prepareRound(buildRound(id));
const netVOI = (round, key, weights = BOARD) => valueOfInformation({ round, facts, weights, segKey: key }).net;

/* ---------- engine units ---------- */

test('rng is deterministic and reproducible from a seed', () => {
  const a = Array.from({ length: 5 }, mulberry32(42));
  const b = Array.from({ length: 5 }, mulberry32(42));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, Array.from({ length: 5 }, mulberry32(43)));
  assert.ok(a.every(x => x >= 0 && x < 1));
});

test('prior mean matches its target and sampling respects it', () => {
  const prior = makePrior(0.88, 12);
  assert.ok(Math.abs(prior.mean - 0.88) < 0.002);
  const rand = mulberry32(7);
  let sum = 0; const N = 20000;
  for (let i = 0; i < N; i++) sum += samplePrior(prior, rand);
  assert.ok(Math.abs(sum / N - 0.88) < 0.01, `sampled mean ${(sum / N).toFixed(4)}`);
});

test('threshold matches the closed form, and a big enough bonus approves everyone', () => {
  const repeat = { firstTime: false }, ft = { firstTime: true };
  assert.ok(Math.abs(threshold(repeat, facts, DEFAULTS) - 30 / 33) < 1e-12);
  assert.ok(Math.abs(threshold(repeat, facts, BOARD) - 45 / 48) < 1e-12);
  assert.ok(Math.abs(threshold(ft, facts, BOARD) - 42 / 48) < 1e-12);
  assert.equal(threshold(ft, facts, { loss: 0.5, firstTime: 99 }), 0);
});

test('a sharper signal spreads predictions further from the base rate', () => {
  const prior = makePrior(0.88, 12);
  const blunt = posteriorTable(prior, 0.12), sharp = posteriorTable(prior, 0.02);
  const spread = t => Math.abs(lookupPHat(t, 0.99) - lookupPHat(t, 0.70));
  assert.ok(spread(sharp) > spread(blunt) * 2, 'sharper predictions must discriminate more');
  assert.ok(lookupPHat(blunt, 0.99) < lookupPHat(sharp, 0.99), 'blunt predictions shrink toward the base rate');
});

/* ---------- L7: predictions are calibrated ---------- */

test('L7 predictions are calibrated: each bin of predictions matches its true repay rate', () => {
  const prior = makePrior(0.88, 12), sigma = 0.06;
  const table = posteriorTable(prior, sigma);
  const rand = mulberry32(99);
  const bins = new Map();
  for (let i = 0; i < 60000; i++) {
    const p = samplePrior(prior, rand);
    const pHat = lookupPHat(table, p + gaussian(rand) * sigma);
    const b = Math.floor(pHat * 10);
    if (!bins.has(b)) bins.set(b, { n: 0, sp: 0, sh: 0 });
    const e = bins.get(b); e.n++; e.sp += p; e.sh += pHat;
  }
  let checked = 0;
  for (const [, e] of bins) {
    if (e.n < 30) continue;
    checked++;
    assert.ok(Math.abs(e.sh / e.n - e.sp / e.n) < 0.03,
      `bin of ${e.n}: predicted ${(e.sh / e.n).toFixed(3)} vs true ${(e.sp / e.n).toFixed(3)}`);
  }
  assert.ok(checked >= 2, 'expected at least two populated bins');
});

/* ---------- L1, L2, L9: the value of information ---------- */

test('L1 round 1: prediction pays on the high-stakes segment and not on the others', () => {
  const r1 = R('r1');
  assert.ok(netVOI(r1, 'restaurants') > 0, 'high stakes, wide spread: worth buying');
  assert.ok(netVOI(r1, 'established') < 0, 'tight spread, everyone approved anyway: not worth it');
  assert.ok(netVOI(r1, 'trades') < 0, 'small loans: stakes do not justify the price');
});

test('L2 round 2: the same segment goes from not worth buying to worth buying', () => {
  assert.ok(netVOI(R('r1'), 'trades') < 0, 'round 1: no');
  assert.ok(netVOI(R('r2'), 'trades') > 0, 'round 2: yes, at the lower price and sharper signal');
});

test('L9 buying everything is never the optimal purchase in round 1', () => {
  const r1 = R('r1');
  const all = new Set(r1.segments.map(s => s.key));
  assert.ok(roundValue({ round: r1, facts, weights: BOARD, bought: all }).total
    < parSearch({ round: r1, facts }).value - 1e-9);
});

/* ---------- L3: cheap prediction unlocks a new kind of decision ---------- */

test('L3 risk-based pricing beats one flat rate, and more so once predictions are sharp', () => {
  const gain = id => {
    const tiered = R(id);
    const flat = prepareRound({ ...buildRound(id), tiers: ['standard'] });
    const bought = parSearch({ round: tiered, facts }).bought;
    return roundValue({ round: tiered, facts, weights: BOARD, bought }).total
         - roundValue({ round: flat, facts, weights: BOARD, bought }).total;
  };
  assert.ok(gain('r2') > 0, 'pricing is worth something at round 2 precision');
  assert.ok(gain('r2') > gain('r1'), 'and worth more than at round 1 precision');
});

/* ---------- L6: the decomposition is exact and never blames the player unfairly ---------- */

test('L6 judgment + information = gap to par, both non-negative, on every combination', () => {
  const lossGrid = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.25];
  const ftGrid = [0, 1.5, 3, 4.5];
  for (const id of ['r1', 'r2']) {
    const round = R(id);
    const keys = round.segments.map(s => s.key);
    for (let mask = 0; mask < (1 << keys.length); mask++) {
      const bought = new Set(keys.filter((_, i) => mask & (1 << i)));
      for (const loss of lossGrid) for (const firstTime of ftGrid) {
        const d = decompose({ round, facts, weights: { loss, firstTime }, bought });
        assert.ok(d.judgment >= -1e-9, `${id} judgment ${d.judgment}`);
        assert.ok(d.information >= -1e-9, `${id} information ${d.information}`);
        assert.ok(Math.abs(d.judgment + d.information - d.gapToPar) < 1e-9, `${id} does not sum`);
        assert.ok(d.costOfUncertainty >= -1e-9, 'perfect information is never worth less than par');
      }
    }
  }
});

test('L6 perfect play reaches a gap of exactly zero', () => {
  for (const id of ['r1', 'r2']) {
    const round = R(id);
    const par = parSearch({ round, facts });
    const d = decompose({ round, facts, weights: BOARD, bought: par.bought });
    assert.ok(Math.abs(d.gapToPar) < 1e-9, `${id} gap ${d.gapToPar}`);
    assert.ok(Math.abs(d.judgment) < 1e-9 && Math.abs(d.information) < 1e-9);
  }
});

test('luck averages out: it is never held against the player', () => {
  const round = R('r2');
  const bought = parSearch({ round, facts }).bought;
  const expected = roundValue({ round, facts, weights: BOARD, bought }).total;
  let sum = 0; const N = 400;
  for (let s = 0; s < N; s++) sum += simulateRound({ round, facts, weights: BOARD, bought, seed: 1000 + s }).realized;
  const meanLuck = sum / N - expected;
  assert.ok(Math.abs(meanLuck) < 0.06 * Math.abs(expected),
    `mean luck ${meanLuck.toFixed(3)} against expected ${expected.toFixed(3)}`);
});

/* ---------- L8, L11: judgment has to matter ---------- */

test('L8 even with perfect free information, ignoring a stated goal loses points', () => {
  const round = R('r2');                       // pricing on: the tier choice is where it bites
  const par = parSearch({ round, facts }).value;
  const correct = perfectInfoValue({ round, facts, weights: BOARD });
  const ignoresFirstTime = perfectInfoValue({ round, facts, weights: { ...BOARD, firstTime: 0 } });
  assert.ok(correct - ignoresFirstTime > 0.02 * par,
    `certainty does not excuse bad weights: lost ${(correct - ignoresFirstTime).toFixed(3)}`);
});

test('L11 round 1: leaving the sliders at their defaults costs real points', () => {
  const round = R('r1');
  const par = parSearch({ round, facts });
  const d = decompose({ round, facts, weights: DEFAULTS, bought: par.bought });
  assert.ok(d.judgment > 0.05 * par.value,
    `default sliders cost ${(100 * d.judgment / par.value).toFixed(1)}% of par, want > 5%`);
});

/* ---------- the scenario itself ---------- */

test('scenario schema: every segment is playable', () => {
  for (const id of ['r1', 'r2', 'r3']) {
    const round = R(id);
    assert.ok(round.segments.length > 0);
    for (const s of round.segments) {
      assert.ok(s.n > 0, `${s.key} has no applicants`);
      assert.ok(s.size > 0 && s.prior.mean > 0 && s.prior.mean < 1);
      assert.ok(Math.abs(s.prior.mean - s.baseRate) < 0.005, `${s.key} prior mean drifted`);
    }
    assert.ok(round.price >= 0 && round.sigma > 0);
  }
});

test('the band constraint holds: no base rate sits between the default and board thresholds', () => {
  for (const id of ['r1', 'r2', 'r3']) {
    for (const s of R(id).segments) {
      const lo = Math.min(threshold(s, facts, DEFAULTS), threshold(s, facts, BOARD));
      const hi = Math.max(threshold(s, facts, DEFAULTS), threshold(s, facts, BOARD));
      for (const [label, mean] of [['true', s.prior.mean], ['model', s.modelPrior ? s.modelPrior.mean : null]]) {
        if (mean === null) continue;
        assert.ok(mean <= lo + 1e-9 || mean >= hi - 1e-9,
          `${s.key} ${label} base ${mean.toFixed(3)} sits inside the band [${lo.toFixed(3)}, ${hi.toFixed(3)}], which inverts the book's central claim`);
      }
    }
  }
});

test('prices fall and predictions sharpen across the three rounds', () => {
  const [r1, r2, r3] = ['r1', 'r2', 'r3'].map(buildRound);
  assert.ok(r1.price > r2.price && r2.price > r3.price, 'prediction must get cheaper');
  assert.ok(r1.sigma > r2.sigma && r2.sigma > r3.sigma, 'and sharper');
  assert.equal(r3.free, true, 'round 3 predictions are free and automatic');
});
