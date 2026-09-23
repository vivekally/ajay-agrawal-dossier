/* Scenario: small-business lending at a regional bank.
 *
 * Every number here is tuned so the round lessons are TRUE, and each is locked by an invariant in
 * tests/engine.test.mjs. Change a number and a lesson test will tell you which lesson you broke.
 *
 * THE BAND CONSTRAINT (invariant L10, the book's central claim):
 * A segment's base rate must never sit between the default-slider threshold and the board's. Inside
 * that band, a player with naive weights is already wrong about the WHOLE segment before buying any
 * prediction, so getting judgment wrong costs MORE without prediction than with it, which is the
 * opposite of the book. Outside the band, both weight settings agree until a prediction arrives, so
 * the cost of bad judgment grows as prediction gets cheaper. Repeat band: 0.909 to 0.938.
 * First-time band: 0.875 to 0.909.
 */

import { makePrior } from '../engine.js';

/* Concentration sets how much applicants differ WITHIN a segment. It has to be loose enough that a
 * prediction can tell them apart: if the prior is tighter than the signal noise, the posterior
 * barely moves and every prediction is worthless (measured: gross VOI ~0 at concentration 60). */

export const facts = {
  L: 30,                                   // points lost when a loan defaults
  tiers: {
    // Acceptance falls steeply with the rate, so choosing the wrong tier costs real money. A
    // gentler spread let a weight change shift a tier instead of flipping approve to decline,
    // which SMOOTHED judgment's influence away in round 2 and broke invariant L10.
    low:      { m: 2.0, a: 0.98, label: 'Low rate' },
    standard: { m: 3.0, a: 0.88, label: 'Standard rate' },
    high:     { m: 5.0, a: 0.50, label: 'High rate' }
  },
  board:    { loss: 1.5, firstTime: 3 },   // what the brief states in words
  defaults: { loss: 1.0, firstTime: 0 }    // the naive starting sliders
};

const seg = (key, label, mean, conc, n, firstTime, size, modelMean) => ({
  key, label, n, firstTime, size,
  prior: makePrior(mean, conc),
  modelPrior: modelMean === undefined ? null : makePrior(modelMean, conc),
  baseRate: mean, concentration: conc
});
/* size scales both the margin and the loss: it is the STAKES of a decision in this segment, and
 * it is what makes a prediction worth buying in one segment and not another (invariant L1). */

export const segments = {
  /* INVARIANT L10, the book's central claim, is a property of this segment list, not of tuning.
   * Judgment's influence grows only if the number of LIVE decisions grows as prediction gets
   * cheaper. Two rules make that happen:
   *   1. Every base rate is robust across the whole slider grid (repeat: below 0.882 or above
   *      0.957; first-time at size 0.6: above 0.922). An unpredicted segment then gets the same
   *      bulk action from every reasonable weight setting, so it contributes no judgment influence.
   *   2. Prices are set so purchases grow 1 -> 3 -> 4 across the rounds. Judgment goes live on a
   *      segment only once a prediction is bought for it.
   * Predicted exposure (applicants x stakes) therefore runs about 9 -> 15.9 -> 29.9. */
  // mean, concentration, n, firstTime, size[, model mean]
  established: () => seg('established', 'Established retailers', 0.970, 45, 5, false, 1.0),
  restaurants: () => seg('restaurants', 'New restaurants',       0.860, 12, 6, false, 1.5),
  workshops:   () => seg('workshops',   'Repair workshops',      0.845, 14, 5, false, 0.9),
  trades:      () => seg('trades',      'First-time trades',     0.940, 20, 4, true,  0.6),
  /* THE SHIFTED SEGMENT MUST BE A REPEAT SEGMENT (invariant L10, found numerically).
   * The stale model over-rates these borrowers. For a FIRST-TIME segment the board's bonus makes
   * the board more lenient than the naive sliders, so against an inflated prediction the naive
   * player's higher cutoff accidentally protects them and judgment error goes NEGATIVE: the game
   * would reward never touching the sliders. For a repeat segment the board is the more cautious
   * of the two, so careful judgment is what protects you, which is the lesson. */
  franchise:   () => seg('franchise',   'Franchise expansions',  0.740, 12, 6, false, 1.5, 0.950)
};

export const rounds = {
  r1: { id: 'r1', tiers: ['standard'],              price: 0.06, sigma: 0.060, free: false },
  r2: { id: 'r2', tiers: ['low','standard','high'], price: 0.02, sigma: 0.030, free: false },
  r3: { id: 'r3', tiers: ['low','standard','high'], price: 0.00, sigma: 0.020, free: true  }
};

/* The feedback-data loop does not buy a bigger history: it buys a FASTER one. Early defaults have
 * been seen, so the model's prior for the shifted segment moves halfway to the truth and its
 * applicants get flagged "unfamiliar". Without it the shift is an unknown unknown; with it, a
 * known one, which is what tells the player where to spend scarce review hours. */
export const LOOP_COST = 6;
export const SHIFT = { modelBelief: 0.950, truth: 0.740 };
const halfway = (SHIFT.modelBelief + SHIFT.truth) / 2;

export function buildRound(id, opts = {}) {
  const base = { ...rounds[id] };
  if (id !== 'r3') {
    base.segments = [segments.established(), segments.restaurants(), segments.workshops(), segments.trades()];
    return base;
  }
  const shifted = segments.franchise();
  shifted.modelBias = SHIFT.modelBelief - SHIFT.truth;    // the model over-rates them by this much
  shifted.modelUncertainty = 1;                           // and is confident about it
  if (opts.loop) {
    shifted.modelPrior = makePrior(halfway, shifted.concentration);
    shifted.modelBias = (SHIFT.modelBelief - SHIFT.truth) / 2; // early defaults corrected it halfway
    shifted.modelUncertainty = 3;                              // and widened its error bars
    shifted.flagged = true;
  }
  base.segments = [segments.established(), segments.restaurants(), segments.workshops(),
                   segments.trades(), shifted];
  return base;
}
