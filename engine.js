/* Threshold: the scoring engine.
 *
 * Pure: no DOM, no globals, no randomness except through an explicit seed. Everything here is
 * testable in Node, which is the point: the failures this design was rescued from were numerical.
 *
 * The one idea the whole file serves, from Prediction Machines: a decision splits into a
 * PREDICTION (the probability of each outcome) and a JUDGMENT (what each outcome is worth).
 * The player supplies judgment as weights; the engine supplies prediction; an action falls out.
 */

/* ---------- random numbers (seeded, so every session is reproducible) ---------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand) {           // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------- beliefs ----------
 * A segment's true repayment rate p is drawn from a Beta prior, represented on a fixed grid.
 * Sampling uses the SAME grid the posterior uses: a different sampler would quietly break
 * calibration (invariant L7).
 */

const GRID_N = 400;

export function makePrior(mean, concentration, gridN = GRID_N) {
  const alpha = mean * concentration, beta = (1 - mean) * concentration;
  const p = new Float64Array(gridN), logw = new Float64Array(gridN);
  for (let i = 0; i < gridN; i++) {
    p[i] = (i + 0.5) / gridN;
    logw[i] = (alpha - 1) * Math.log(p[i]) + (beta - 1) * Math.log(1 - p[i]);
  }
  let mx = -Infinity;
  for (let i = 0; i < gridN; i++) if (logw[i] > mx) mx = logw[i];
  const w = new Float64Array(gridN);
  let z = 0;
  for (let i = 0; i < gridN; i++) { w[i] = Math.exp(logw[i] - mx); z += w[i]; }
  for (let i = 0; i < gridN; i++) w[i] /= z;
  const cdf = new Float64Array(gridN);
  let c = 0;
  for (let i = 0; i < gridN; i++) { c += w[i]; cdf[i] = c; }
  let mu = 0;
  for (let i = 0; i < gridN; i++) mu += p[i] * w[i];
  return { p, w, cdf, mean: mu, alpha, beta };
}

export function samplePrior(prior, rand) {
  const u = rand(), { cdf, p } = prior;
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
  return p[lo];
}

/* A prediction is the POSTERIOR MEAN given a noisy signal, so it is calibrated by construction.
 * What the player buys is sharpness: smaller sigma spreads predictions further from the base rate.
 * Raw signals would not be calibrated, and selecting above a threshold would suffer a winner's
 * curse (measured at 0.147 versus 0.005 for posterior means).
 */
export function posteriorTable(prior, sigma, gridM = 721) {
  const lo = -4 * sigma, hi = 1 + 4 * sigma, step = (hi - lo) / (gridM - 1);
  const s = new Float64Array(gridM), pHat = new Float64Array(gridM), weight = new Float64Array(gridM);
  const { p, w } = prior, n = p.length, inv2s2 = 1 / (2 * sigma * sigma);
  let zTotal = 0;
  for (let j = 0; j < gridM; j++) {
    const sj = lo + j * step;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const d = sj - p[i];
      const lik = Math.exp(-d * d * inv2s2) * w[i];
      den += lik; num += p[i] * lik;
    }
    s[j] = sj; pHat[j] = den > 0 ? num / den : prior.mean; weight[j] = den; zTotal += den;
  }
  for (let j = 0; j < gridM; j++) weight[j] /= zTotal;   // marginal density of the signal
  return { s, pHat, weight, sigma, lo, step, gridM };
}

export function lookupPHat(table, s) {
  let j = Math.round((s - table.lo) / table.step);
  if (j < 0) j = 0; if (j >= table.gridM) j = table.gridM - 1;
  return table.pHat[j];
}

/* ---------- the decision ----------
 * Scoring is LINEAR and per applicant. An earlier draft used portfolio-level penalties inside
 * max(), which made the best cutoff depend on the whole pool: the threshold shown on screen was
 * then not the one the score rewarded, and convexity biased "luck" negative.
 */

export const DECLINE = 'decline';

export function actionValue(p, action, seg, facts, weights) {
  if (action === DECLINE) return 0;
  const t = facts.tiers[action];
  const size = seg.size === undefined ? 1 : seg.size;     // stakes: bigger loans, more at risk
  const perLoan = p * t.m * size - (1 - p) * facts.L * size * weights.loss;
  // The first-time bonus is flat: the board values the relationship, not the loan size.
  return t.a * (perLoan + (seg.firstTime ? weights.firstTime : 0));
}

export function bestAction(p, seg, facts, weights, allowedTiers) {
  let best = DECLINE, bestV = 0;
  for (const tier of allowedTiers) {
    const v = actionValue(p, tier, seg, facts, weights);
    if (v > bestV + 1e-12) { bestV = v; best = tier; }
  }
  return best;
}

/* The threshold the values screen shows: the repay probability above which this player approves.
 * Acceptance cancels, so it is a property of the weights alone. */
export function threshold(seg, facts, weights, tier = 'standard') {
  const size = seg.size === undefined ? 1 : seg.size;
  const m = facts.tiers[tier].m * size, lw = facts.L * size * weights.loss;
  const b = seg.firstTime ? weights.firstTime : 0;
  return Math.min(1, Math.max(0, (lw - b) / (m + lw)));
}

/* ---------- value ----------
 * V is an EXPECTED score under the true process, minus what the information cost.
 *
 * Rounds 1-2: every player choice (weights, purchases) happens before any prediction is seen, so V
 * is the full ex-ante expectation, computed by integrating over the signal distribution with each
 * contribution evaluated at the POSTERIOR MEAN. Because contribution is linear in p,
 * E[contribution | signal] equals the contribution at pHat, so this is the same expectation with
 * zero sampling error. Monte Carlo at the sampled true p is NOT equivalent: it made judgment error
 * come out negative on 9 of 20 runs during review.
 *
 * A segment carries two beliefs. They are identical everywhere except the round 3 segment whose
 * risk has shifted: there the model still predicts from a stale prior (decisions use it) while the
 * world has moved (scoring uses the truth).
 */

export function segmentTables(seg, sigma) {
  const truth = posteriorTable(seg.prior, sigma);
  const model = seg.modelPrior ? posteriorTable(seg.modelPrior, sigma) : truth;
  return { truth, model };
}

export function segmentValuePerApplicant({ seg, round, facts, weights, bought }) {
  const board = facts.board;
  if (!bought) {
    // No prediction: every applicant in the segment looks like the segment, so all get one action.
    const believed = (seg.modelPrior || seg.prior).mean;
    const act = bestAction(believed, seg, facts, weights, round.tiers);
    return actionValue(seg.prior.mean, act, seg, facts, board);
  }
  const { truth, model } = seg._tables;
  let acc = 0;
  for (let j = 0; j < truth.gridM; j++) {
    const decideAt = model.pHat[j];              // what the player's model says
    const scoreAt = truth.pHat[j];               // what is actually true, in expectation
    const act = bestAction(decideAt, seg, facts, weights, round.tiers);
    acc += truth.weight[j] * actionValue(scoreAt, act, seg, facts, board);
  }
  return acc - round.price;
}

export function roundValue({ round, facts, weights, bought }) {
  let total = 0;
  const perSegment = {};
  for (const seg of round.segments) {
    const isBought = round.free || bought.has(seg.key);
    const per = segmentValuePerApplicant({ seg, round, facts, weights, bought: isBought });
    perSegment[seg.key] = per * seg.n;
    total += per * seg.n;
  }
  return { total, perSegment };
}

/* What the round would be worth if every risk were known, for free. Not achievable: reported
 * separately as "the price of not knowing", never charged to the player. */
export function freeValue({ round, facts }) {
  let total = 0;
  for (const seg of round.segments) {
    const { p, w } = seg.prior;
    let acc = 0;
    for (let i = 0; i < p.length; i++) {
      const act = bestAction(p[i], seg, facts, facts.board, round.tiers);
      acc += w[i] * actionValue(p[i], act, seg, facts, facts.board);
    }
    total += acc * seg.n;
  }
  return total;
}

/* I*: the best information choices under the BOARD's weights and this round's real prices.
 * Par uses the round's actual constraints, so a perfect player can reach a gap of exactly zero. */
export function parSearch({ round, facts }) {
  if (round.free) return { bought: new Set(round.segments.map(s => s.key)), value: roundValue({ round, facts, weights: facts.board, bought: new Set() }).total };
  const keys = round.segments.map(s => s.key);
  let best = null;
  for (let mask = 0; mask < (1 << keys.length); mask++) {
    const bought = new Set(keys.filter((_, i) => mask & (1 << i)));
    const v = roundValue({ round, facts, weights: facts.board, bought }).total;
    if (!best || v > best.value + 1e-12) best = { bought, value: v };
  }
  return best;
}

/* The debrief's arithmetic. Each term is a proper optimality gap, so both are non-negative in
 * rounds 1-2 and they sum to the gap exactly. Judgment is measured first, at the player's own
 * information; information is the remainder. */
export function decompose({ round, facts, weights, bought }) {
  const par = parSearch({ round, facts });
  const vAct = roundValue({ round, facts, weights, bought }).total;
  const vBoardOnPlayerInfo = roundValue({ round, facts, weights: facts.board, bought }).total;
  const vFree = freeValue({ round, facts });
  return {
    vAct, vPar: par.value, vFree,
    judgment: vBoardOnPlayerInfo - vAct,
    information: par.value - vBoardOnPlayerInfo,
    gapToPar: par.value - vAct,
    costOfUncertainty: vFree - par.value,
    parBought: par.bought
  };
}

/* Value of information, shown only AFTER a purchase so it teaches instead of giving the answer. */
export function valueOfInformation({ round, facts, weights, segKey }) {
  const seg = round.segments.find(s => s.key === segKey);
  const withIt = segmentValuePerApplicant({ seg, round, facts, weights, bought: true });
  const without = segmentValuePerApplicant({ seg, round, facts, weights, bought: false });
  return { net: (withIt - without) * seg.n, gross: (withIt + round.price - without) * seg.n, price: round.price * seg.n };
}

/* One actual draw. Only ever used for the "what actually happened" line; the decomposition never
 * uses it, so a player is never blamed for bad luck. */
export function simulateRound({ round, facts, weights, bought, seed }) {
  const rand = mulberry32(seed);
  let realized = 0;
  const applicants = [];
  for (const seg of round.segments) {
    const isBought = round.free || bought.has(seg.key);
    const { truth, model } = seg._tables;
    for (let i = 0; i < seg.n; i++) {
      const p = samplePrior(seg.prior, rand);
      const s = p + gaussian(rand) * truth.sigma;
      const believed = isBought ? lookupPHat(model, s) : (seg.modelPrior || seg.prior).mean;
      const act = bestAction(believed, seg, facts, weights, round.tiers);
      let points = 0;
      if (act !== DECLINE) {
        const t = facts.tiers[act], size = seg.size === undefined ? 1 : seg.size;
        if (rand() < t.a) {                                   // did they accept the offer?
          points = (rand() < p ? t.m * size : -facts.L * size * facts.board.loss)
                 + (seg.firstTime ? facts.board.firstTime : 0);
        }
      }
      realized += points;
      applicants.push({ seg: seg.key, firstTime: seg.firstTime, p, believed, action: act, points });
    }
    if (isBought && !round.free) realized -= round.price * seg.n;
  }
  return { realized, applicants };
}

/* Attach the posterior tables once per round. */
export function prepareRound(round) {
  for (const seg of round.segments) seg._tables = segmentTables(seg, round.sigma);
  return round;
}

/* Value when every risk is known for free, but the player still acts on their own weights.
 * Used by invariant L8: even under certainty, judgment changes the action through the price tier. */
export function perfectInfoValue({ round, facts, weights }) {
  let total = 0;
  for (const seg of round.segments) {
    const { p, w } = seg.prior;
    let acc = 0;
    for (let i = 0; i < p.length; i++) {
      const act = bestAction(p[i], seg, facts, weights, round.tiers);
      acc += w[i] * actionValue(p[i], act, seg, facts, facts.board);
    }
    total += acc * seg.n;
  }
  return total;
}

/* ---------- round 3: the world moves under the model ----------
 * A new segment's true risk has shifted well below what the model's prior assumes. The model keeps
 * predicting from the stale prior, so DECISIONS use the model's belief while SCORING uses the
 * truth. This is the one place judgment error may come out negative, and deliberately so: a player
 * whose weights were over-cautious is protected from a shift nobody could see.
 *
 * Round 3's choices (which applicants to refer) happen AFTER predictions are on screen, so round 3
 * conditions on the session rather than integrating over it, exactly as the spec requires.
 */

export function posteriorDist(prior, sigma, s) {
  const { p, w } = prior, n = p.length, inv2s2 = 1 / (2 * sigma * sigma);
  const out = new Float64Array(n);
  let z = 0;
  for (let i = 0; i < n; i++) { const d = s - p[i]; const l = Math.exp(-d * d * inv2s2) * w[i]; out[i] = l; z += l; }
  for (let i = 0; i < n; i++) out[i] /= z;
  return { p, w: out };
}

export function buildSession({ round, seed }) {
  const rand = mulberry32(seed);
  const applicants = [];
  for (const seg of round.segments) {
    const { truth, model } = seg._tables;
    for (let i = 0; i < seg.n; i++) {
      const p = samplePrior(seg.prior, rand);
      const s = p + gaussian(rand) * round.sigma;
      applicants.push({
        seg, key: seg.key, p, s,
        // A stale model does not merely hold an old average: it systematically OVER-RATES the
        // shifted borrowers, because it maps signals to probabilities using relationships that no
        // longer hold. That bias, not the prior, is what misleads when signals are sharp.
        pHatModel: Math.min(0.999, lookupPHat(model, s) + (seg.modelBias || 0)),
        pHatTrue: lookupPHat(truth, s),      // what it is worth, in expectation
        flagged: !!seg.flagged               // set only when the feedback loop has noticed
      });
    }
  }
  return { applicants, round };
}

export function sessionValue({ session, facts, weights, referred = new Set(), loopCost = 0 }) {
  const { round } = session;
  let total = -loopCost;
  session.applicants.forEach((a, i) => {
    const isReferred = referred.has(i);
    const decideAt = isReferred ? a.p : a.pHatModel;       // review reveals the truth
    const scoreAt = isReferred ? a.p : a.pHatTrue;
    const act = bestAction(decideAt, a.seg, facts, weights, round.tiers);
    total += actionValue(scoreAt, act, a.seg, facts, facts.board);
  });
  return total;
}

/* What a review is worth, judged ONLY by what the player can see. Par must not be able to peek at
 * the truth, or the unknown unknown would be charged to the player as an information error. */
export function expectedReviewGain({ applicant: a, round, facts, weights }) {
  const prior = a.seg.modelPrior || a.seg.prior;
  // A flagged applicant is one the feedback loop has taught the model to be unsure about, so the
  // model reports wider error bars. That uncertainty is exactly what makes a review worth an hour.
  const effSigma = round.sigma * (a.seg.modelUncertainty || 1);
  const dist = posteriorDist(prior, effSigma, a.s);
  const bias = a.seg.modelBias || 0;
  let informed = 0;
  for (let i = 0; i < dist.p.length; i++) {
    const believed = Math.min(0.999, dist.p[i] + bias);     // stay inside the model's own world view
    const act = bestAction(believed, a.seg, facts, weights, round.tiers);
    informed += dist.w[i] * actionValue(believed, act, a.seg, facts, weights);
  }
  const blind = actionValue(a.pHatModel, bestAction(a.pHatModel, a.seg, facts, weights, round.tiers),
                            a.seg, facts, weights);
  return Math.max(0, informed - blind);
}

export function bestReferrals({ session, facts, weights, hours }) {
  const ranked = session.applicants
    .map((a, i) => ({ i, gain: expectedReviewGain({ applicant: a, round: session.round, facts, weights }) }))
    .sort((x, y) => y.gain - x.gain);
  return { referred: new Set(ranked.slice(0, hours).map(r => r.i)), ranked };
}

export function round3Decompose({ facts, weights, seed, hours, buildR3, loopCost, playerLoop = false }) {
  const board = facts.board;
  const withLoop = prepareRound(buildR3({ loop: true })), withoutLoop = prepareRound(buildR3({ loop: false }));
  const best = [{ loop: true, round: withLoop, cost: loopCost }, { loop: false, round: withoutLoop, cost: 0 }]
    .map(o => {
      const session = buildSession({ round: o.round, seed });
      const { referred } = bestReferrals({ session, facts, weights: board, hours });
      return { ...o, session, referred, value: sessionValue({ session, facts, weights: board, referred, loopCost: o.cost }) };
    })
    .sort((a, b) => b.value - a.value)[0];

  const playerRound = prepareRound(buildR3({ loop: playerLoop }));
  const playerSession = buildSession({ round: playerRound, seed });
  const playerReferred = bestReferrals({ session: playerSession, facts, weights, hours }).referred;
  const pc = playerLoop ? loopCost : 0;
  const vAct = sessionValue({ session: playerSession, facts, weights, referred: playerReferred, loopCost: pc });
  const vBoardOnPlayerInfo = sessionValue({ session: playerSession, facts, weights: board, referred: playerReferred, loopCost: pc });
  return {
    vAct, vPar: best.value, parLoop: best.loop,
    judgment: vBoardOnPlayerInfo - vAct,
    information: best.value - vBoardOnPlayerInfo,
    gapToPar: best.value - vAct
  };
}

/* One actual draw for a round-3 session. Same rule as simulateRound: used only for the
 * "what actually happened" line, never for the decomposition. */
export function simulateSession({ session, facts, weights, referred = new Set(), seed, loopCost = 0 }) {
  const rand = mulberry32(seed);
  let realized = -loopCost;
  const outcomes = [];
  session.applicants.forEach((a, i) => {
    const decideAt = referred.has(i) ? a.p : a.pHatModel;
    const act = bestAction(decideAt, a.seg, facts, weights, session.round.tiers);
    let points = 0, accepted = false, repaid = false;
    if (act !== DECLINE) {
      const t = facts.tiers[act], size = a.seg.size === undefined ? 1 : a.seg.size;
      accepted = rand() < t.a;
      if (accepted) {
        repaid = rand() < a.p;
        points = (repaid ? t.m * size : -facts.L * size * facts.board.loss)
               + (a.seg.firstTime ? facts.board.firstTime : 0);
      }
    }
    realized += points;
    outcomes.push({ i, action: act, accepted, repaid, points });
  });
  return { realized, outcomes };
}
