/* Round 3: the world moves under the model.
 * Here prediction is free, so what is left to decide is judgment, where to spend scarce review
 * hours, and whether to have bought a feedback loop.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareRound, buildSession, bestReferrals, sessionValue, expectedReviewGain,
  round3Decompose, mulberry32, threshold, parSearch, roundValue, bestAction
} from '../engine.js';
import { facts, buildRound, segments, LOOP_COST, SHIFT } from '../scenarios/lending.js';

const BOARD = facts.board, DEFAULTS = facts.defaults;
const SEEDS = 30, HOURS = 5;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

function evR3({ loop, hours = HOURS, weights = BOARD, mode = 'targeted' }) {
  const out = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const round = prepareRound(buildRound('r3', { loop }));
    const session = buildSession({ round, seed });
    let referred;
    if (mode === 'random') {
      const rand = mulberry32(seed * 77);
      referred = new Set([...session.applicants.keys()].sort(() => rand() - 0.5).slice(0, hours));
    } else {
      referred = bestReferrals({ session, facts, weights, hours }).referred;
    }
    out.push(sessionValue({ session, facts, weights, referred, loopCost: loop ? LOOP_COST : 0 }));
  }
  return mean(out);
}

test('the stale model systematically over-rates the shifted segment', () => {
  const round = prepareRound(buildRound('r3', { loop: false }));
  const shifted = buildSession({ round, seed: 3 }).applicants.filter(a => a.key === 'franchise');
  assert.ok(shifted.length > 0);
  const believed = mean(shifted.map(a => a.pHatModel)), truth = mean(shifted.map(a => a.p));
  assert.ok(believed - truth > 0.1, `model believes ${believed.toFixed(3)} vs truth ${truth.toFixed(3)}`);
});

test('the shifted segment is a repeat segment, so caution is what protects the player', () => {
  const shifted = buildRound('r3', {}).segments.find(s => s.key === 'franchise');
  assert.equal(shifted.firstTime, false,
    'a first-time shifted segment inverts the lesson: the board bonus makes the board more lenient, ' +
    'so naive sliders would accidentally beat careful ones against an inflated prediction');
  assert.ok(threshold(shifted, facts, BOARD) > threshold(shifted, facts, DEFAULTS),
    'the board must be the more cautious of the two here');
});

test('L5 the feedback loop pays for itself, and it is what makes review worth spending', () => {
  const withLoop = evR3({ loop: true }), withoutLoop = evR3({ loop: false });
  assert.ok(withLoop > withoutLoop,
    `loop ${withLoop.toFixed(2)} vs no loop ${withoutLoop.toFixed(2)}, net of its ${LOOP_COST}-point cost`);
  const targeted = withLoop, random = evR3({ loop: true, mode: 'random' });
  assert.ok(targeted > random,
    `targeted review ${targeted.toFixed(2)} must beat random review ${random.toFixed(2)}: the flags have to be worth following`);
});

test('L12 the review budget binds: a sixth hour would still be worth having', () => {
  const five = evR3({ loop: true, hours: 5 }), six = evR3({ loop: true, hours: 6 });
  assert.ok(six > five, `a 6th hour adds ${(six - five).toFixed(3)}: scarce judgment must actually be scarce`);
});

test('L4 in round 3 the outcome depends more on judgment than on prediction quality', () => {
  const grid = [];
  for (const loss of [0.75, 1.5, 2.25]) for (const firstTime of [1.5, 3, 4.5]) grid.push({ loss, firstTime });
  const byJudgment = grid.map(w => evR3({ loop: true, weights: w }));
  const byPrecision = [0.06, 0.03, 0.02].map(sigma => {
    const out = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const round = prepareRound({ ...buildRound('r3', { loop: true }), sigma });
      const session = buildSession({ round, seed });
      const referred = bestReferrals({ session, facts, weights: BOARD, hours: HOURS }).referred;
      out.push(sessionValue({ session, facts, weights: BOARD, referred, loopCost: LOOP_COST }));
    }
    return mean(out);
  });
  const spread = a => Math.max(...a) - Math.min(...a);
  assert.ok(spread(byJudgment) > spread(byPrecision),
    `judgment spread ${spread(byJudgment).toFixed(2)} must exceed precision spread ${spread(byPrecision).toFixed(2)}`);
});

test('round 3 judgment error is positive on average: careful weights are rewarded', () => {
  const je = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    je.push(round3Decompose({
      facts, weights: DEFAULTS, seed, hours: HOURS,
      buildR3: o => buildRound('r3', o), loopCost: LOOP_COST, playerLoop: true
    }).judgment);
  }
  assert.ok(mean(je) > 0, `mean judgment error ${mean(je).toFixed(2)} must be positive`);
});

test('a review is only ever worth a non-negative amount, judged on what the player can see', () => {
  const round = prepareRound(buildRound('r3', { loop: true }));
  const session = buildSession({ round, seed: 5 });
  for (const a of session.applicants) {
    assert.ok(expectedReviewGain({ applicant: a, round, facts, weights: BOARD }) >= 0);
  }
});

/* L10: the book's central claim, and the hardest invariant here.
 *
 * It failed on the first attempt, three different ways, and the cause was structural rather than a
 * matter of tuning. With a FIXED pool of applicants, a segment with no prediction gets one bulk
 * action, so moving a slider flips every applicant in it at once; cheap prediction then moves
 * judgment to the margin and SHRINKS its influence. Gentle price tiers smoothed it further.
 *
 * The scenario now does what the book actually describes: cheap prediction gets used in places it
 * was not worth using before, so the number of live decisions grows (purchases 1 -> 3 -> 4,
 * predicted exposure about 9 -> 15.9 -> 29.9), and judgment's influence grows with it.
 */
test('L10 judgment matters more as prediction gets cheaper', () => {
  const grid = [];
  for (const loss of [0.75, 1.5, 2.25]) for (const firstTime of [1.5, 3, 4.5]) grid.push({ loss, firstTime });
  const spread = a => Math.max(...a) - Math.min(...a);

  const flatRound = id => {
    const round = prepareRound(buildRound(id));
    const bought = parSearch({ round, facts }).bought;
    return spread(grid.map(w => roundValue({ round, facts, weights: w, bought }).total));
  };
  const r3Spread = spread(grid.map(w => {
    const out = [];
    for (let seed = 1; seed <= 12; seed++) {
      const round = prepareRound(buildRound('r3', { loop: true }));
      const session = buildSession({ round, seed });
      const referred = bestReferrals({ session, facts, weights: w, hours: HOURS }).referred;
      out.push(sessionValue({ session, facts, weights: w, referred, loopCost: LOOP_COST }));
    }
    return mean(out);
  }));

  const [s1, s2, s3] = [flatRound('r1'), flatRound('r2'), r3Spread];
  assert.ok(s1 < s2, `round 1 ${s1.toFixed(2)} must matter less than round 2 ${s2.toFixed(2)}`);
  assert.ok(s2 < s3, `round 2 ${s2.toFixed(2)} must matter less than round 3 ${s3.toFixed(2)}`);
});

test('L10 mechanism: the number of live decisions grows as prediction gets cheaper', () => {
  const exposure = id => {
    const round = prepareRound(buildRound(id, { loop: true }));
    const bought = round.free
      ? new Set(round.segments.map(s => s.key))
      : parSearch({ round, facts }).bought;
    return {
      segments: bought.size,
      weighted: round.segments.filter(s => bought.has(s.key)).reduce((t, s) => t + s.n * s.size, 0)
    };
  };
  const [e1, e2, e3] = ['r1', 'r2', 'r3'].map(exposure);
  assert.ok(e1.segments < e2.segments && e2.segments < e3.segments,
    `segments under prediction must grow: ${e1.segments} -> ${e2.segments} -> ${e3.segments}`);
  assert.ok(e1.weighted < e2.weighted && e2.weighted < e3.weighted,
    `predicted exposure must grow: ${e1.weighted.toFixed(1)} -> ${e2.weighted.toFixed(1)} -> ${e3.weighted.toFixed(1)}`);
});

test('an unpredicted segment gives the same bulk call to every reasonable weight setting', () => {
  // This is what stops judgment from looking MORE influential in the early rounds than the late
  // ones: without it, one slider nudge flips a whole segment and the book's claim inverts.
  const round = prepareRound(buildRound('r2'));
  const bought = parSearch({ round, facts }).bought;
  for (const seg of round.segments) {
    if (bought.has(seg.key)) continue;
    const calls = new Set();
    for (const loss of [0.75, 1.5, 2.25]) for (const firstTime of [1.5, 3, 4.5]) {
      calls.add(bestAction(seg.prior.mean, seg, facts, { loss, firstTime }, round.tiers));
    }
    assert.equal(calls.size, 1, `${seg.key} flips in bulk across the slider grid: ${[...calls].join('/')}`);
  }
});
