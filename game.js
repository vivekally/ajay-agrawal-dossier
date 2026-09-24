/* Threshold: the interface.
 *
 * Rendering only. Every number on screen comes from engine.js; every transition from state.js.
 * One rule worth restating because the whole lesson rests on it: the values screen NEVER shows a
 * score. If it did, a player could nudge the sliders until the number peaked and discover the
 * board's weights without ever translating the brief, which is the thing being taught.
 */
import * as E from './engine.js';
import * as S from './state.js';
import { facts, buildRound, LOOP_COST, SHIFT } from './scenarios/lending.js';

const T = window.AATheme;
const BOARD = facts.board;
const HOURS = 5;
const ROUND_LABEL = { r1: 'Round 1', r2: 'Round 2', r3: 'Round 3' };

/* ---------- tiny DOM helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];          // player text never touches innerHTML
    else if (k === 'html') n.innerHTML = attrs[k];            // authored copy only
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
  }
  (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}
const pts = v => (v >= 0 ? '' : '-') + Math.abs(v).toFixed(1);
const pct = p => (p * 100).toFixed(1) + '%';

/* ---------- session parameters ---------- */
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const sessionCode = (params.get('session') || '').trim();
function seedFrom(code) {
  if (!code) return Math.floor(Math.random() * 1e9);
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- rounds, prepared once ---------- */
const ROUNDS = { r1: E.prepareRound(buildRound('r1')), r2: E.prepareRound(buildRound('r2')) };
const r3For = loop => E.prepareRound(buildRound('r3', { loop: !!loop }));

/* ---------- the shared visual anchor ---------- */
const AX = { min: 0.5, max: 1.0, W: 720, H: 120, padL: 34, padR: 24, baseY: 64 };
const ax = p => AX.padL + ((Math.min(AX.max, Math.max(AX.min, p)) - AX.min) / (AX.max - AX.min)) * (AX.W - AX.padL - AX.padR);

/* One horizontal probability axis carries the whole game: threshold ticks while you set values,
 * tier bands once pricing exists, and the round's applicants as dots in the debrief. */
function axis({ marks = [], dots = [], bands = [], caption = 'chance the applicant repays', height = AX.H }) {
  AX.W = window.innerWidth < 620 ? 430 : 720;      // keeps axis labels legible on a phone
  const C = T.C, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${AX.W} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-hidden', 'true');          // the sentence readout is the accessible form
  const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
  bands.forEach(b => add('rect', { x: ax(b.from), y: AX.baseY - 9, width: Math.max(1, ax(b.to) - ax(b.from)), height: 18, fill: b.color, opacity: b.opacity || 0.22 }));
  add('line', { x1: AX.padL, y1: AX.baseY, x2: AX.W - AX.padR, y2: AX.baseY, stroke: C.ruleS, 'stroke-width': 2 });
  [0.5, 0.625, 0.75, 0.875, 1].forEach(p => {
    add('line', { x1: ax(p), y1: AX.baseY, x2: ax(p), y2: AX.baseY + 5, stroke: C.ruleS, 'stroke-width': 1 });
    const t = add('text', { x: ax(p), y: AX.baseY + 19, 'text-anchor': 'middle', fill: C.faint, 'font-size': 10, 'font-family': 'JetBrains Mono, monospace' });
    t.textContent = pct(p).replace('.0', '');
  });
  const cap = add('text', { x: (AX.padL + AX.W - AX.padR) / 2, y: AX.baseY + 36, 'text-anchor': 'middle', fill: C.faint, 'font-size': 10, 'font-family': 'Plus Jakarta Sans, sans-serif' });
  cap.textContent = caption;
  dots.forEach(d => add('circle', { cx: ax(d.p), cy: AX.baseY, r: 5.5, fill: d.color, stroke: C.raised, 'stroke-width': 1.5, opacity: d.opacity || 1 }));
  marks.forEach((m, i) => {
    const x = ax(m.p), up = i % 2 === 0;                       // stagger so close ticks stay legible
    add('line', { x1: x, y1: AX.baseY - 18, x2: x, y2: AX.baseY + 8, stroke: m.color, 'stroke-width': m.dashed ? 2 : 3, 'stroke-dasharray': m.dashed ? '4 3' : null });
    const t = add('text', { x, y: up ? AX.baseY - 24 : AX.baseY + 34, 'text-anchor': 'middle', fill: m.color, 'font-size': 11, 'font-weight': 700, 'font-family': 'Plus Jakarta Sans, sans-serif' });
    t.textContent = m.label;
  });
  return svg;
}

/* Where each action takes over as the repay probability rises. Computed by scanning, so it stays
 * correct whatever the tier table says. */
function cutPoints(seg, weights, round) {
  const out = [];
  let prev = E.bestAction(AX.min, seg, facts, weights, round.tiers);
  for (let p = AX.min; p <= AX.max; p += 0.001) {
    const a = E.bestAction(p, seg, facts, weights, round.tiers);
    if (a !== prev) { out.push({ p, from: prev, to: a }); prev = a; }
  }
  return out;
}

/* ---------- state ---------- */
const storage = S.makeStorage();
let state = S.initialState(seedFrom(sessionCode));
let storageNote = null;

function persist() { if (storage.available && !storage.save(state)) storageNote = 'blocked'; }
function setState(next) { state = next; persist(); render(); }

/* ---------- screens ---------- */
const screens = {};

screens.start = () => {
  const box = el('div', { class: 'screen' });
  box.append(
    el('h1', { text: 'Threshold' }),
    el('p', { class: 'lede-g', text: 'You run small-business lending at a regional bank. Over three rounds, predicting who will repay gets cheaper and sharper. What you will find is that the hard part moves somewhere else.' }),
    el('p', { class: 'viz-note', html: 'About 25 minutes. Based on the ideas in <em>Prediction Machines</em> by Ajay Agrawal, Joshua Gans and Avi Goldfarb. Not affiliated with the authors or their publisher.' })
  );
  const resume = storage.available ? storage.load() : { state: null, reason: 'empty' };
  const acts = el('div', { class: 'actions' });
  if (resume.state && resume.state.step > 1) {
    acts.append(
      el('button', { class: 'btn', onclick: () => setState(resume.state) }, 'Resume where you left off'),
      el('button', { class: 'btn ghost', onclick: () => { storage.clear(); setState({ ...S.initialState(seedFrom(sessionCode)), step: 1, startedAt: Date.now() }); } }, 'Start over')
    );
  } else {
    acts.append(el('button', { class: 'btn', onclick: () => setState({ ...state, step: 1, startedAt: Date.now() }) }, 'Start'));
  }
  box.append(acts);
  if (resume.reason === 'version') box.append(el('p', { class: 'viz-note', text: 'The game was updated since your last visit, so that session was cleared.' }));
  if (!storage.available || storageNote) box.append(el('p', { class: 'viz-note', text: 'Your browser is blocking saved data, so progress will not survive a refresh. Everything else works.' }));
  if (sessionCode) box.append(el('p', { class: 'viz-note', text: 'Session ' + sessionCode + ': everyone using this link sees the identical applicants.' }));
  return box;
};

const QUESTIONS = [
  { id: 'q1', q: 'When prediction gets much cheaper, what becomes more valuable?',
    options: ['People who are good at forecasting', 'Judgment about what each outcome is worth', 'Nothing much changes', 'The company selling the predictions'], right: 1 },
  { id: 'q2', q: 'A model says this applicant has a 90% chance of repaying. Should you approve?',
    options: ['Yes, 90% is high', 'It depends what a default costs against what a good loan earns', 'No, a 10% risk is too much', 'Only if the model is 90% accurate'], right: 1 },
  { id: 'q3', q: 'Your model has been reliable for years. A new kind of applicant appears. What protects you most?',
    options: ['A bigger history to train on', 'Early outcome data, plus human review of the unfamiliar cases', 'The model’s track record', 'A more complicated model'], right: 1 }
];
function shuffled(q, seed) {
  const rand = E.mulberry32(seed + q.id.charCodeAt(1));
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

function checkScreen(phase) {
  const box = el('div', { class: 'screen' });
  const isPre = phase === 'precheck';
  box.append(el('h1', { text: isPre ? 'Three quick calls' : 'Your calls, revisited' }));
  box.append(el('p', { class: 'lede-g', text: isPre ? 'No feedback yet. We will come back to these at the end.' : 'What you said before you played, what you say now, and what the book argues.' }));
  QUESTIONS.forEach(q => {
    const card = el('div', { class: 'qcard' });
    card.append(el('h3', { text: q.q }));
    shuffled(q, state.seed).forEach(oi => {
      const chosenNow = state[phase][q.id] === oi;
      const chosenPre = state.precheck[q.id] === oi;
      const cls = ['opt'];
      if (!isPre && oi === q.right) cls.push('is-right');
      if (chosenNow) cls.push('is-chosen');
      const row = el('label', { class: cls.join(' ') });
      row.append(el('input', { type: 'radio', name: phase + q.id, ...(chosenNow ? { checked: 'checked' } : {}),
        onchange: () => {
          /* Update in place. A full re-render here would detach the other questions' inputs
             mid-answer and throw away focus. */
          state = S.setAnswer(state, phase, q.id, oi); persist();
          card.querySelectorAll('.opt').forEach(o => o.classList.remove('is-chosen'));
          row.classList.add('is-chosen');
          refreshNext();
        } }));
      row.append(el('span', { text: q.options[oi] }));
      if (!isPre) {
        const tags = [];
        if (chosenPre) tags.push('you said this before');
        if (oi === q.right) tags.push('the book’s answer');
        if (tags.length) row.append(el('span', { class: 'flagchip', text: tags.join(' · ') }));
      }
      card.append(row);
    });
    box.append(card);
  });
  const nextBtn = el('button', { class: 'btn', onclick: () => setState(S.next(state)) },
    isPre ? 'Start round 1' : 'One last thing');
  function refreshNext() {
    const done = QUESTIONS.every(q => state[phase][q.id] !== undefined);
    if (done) nextBtn.removeAttribute('disabled'); else nextBtn.setAttribute('disabled', 'disabled');
  }
  refreshNext();
  box.append(el('div', { class: 'actions' }, [nextBtn]));
  return box;
}
screens.precheck = () => checkScreen('precheck');
screens.postcheck = () => checkScreen('postcheck');

const EXAMPLES = {
  r1: { title: 'How a decision splits in two',
        steps: ['A prediction tells you the chance this borrower repays. That is all it does.',
                'What a default costs you, against what a good loan earns, decides how high that chance has to be. That line is your threshold.',
                'Move your values and the line moves. The prediction has not changed at all.'] },
  r2: { title: 'You can now price, not just approve',
        steps: ['Prediction is cheaper and sharper this round, so it is worth buying in more places.',
                'You also have three rates. A higher rate earns more per loan but fewer borrowers accept it.',
                'Your values now choose a rate as well as a cutoff, so the axis has bands instead of one line.'] },
  r3: { title: 'Prediction is free. Something else is scarce',
        steps: ['Every applicant now comes with a sharp prediction, at no cost.',
                'A new kind of borrower has appeared, and the model has never seen one behave badly.',
                'You get five hours of human review. Where you spend them is the whole round.'] }
};
screens.example = step => {
  const ex = EXAMPLES[step.round];
  const box = el('div', { class: 'screen' });
  box.append(el('p', { class: 'eyebrow', text: ROUND_LABEL[step.round] }), el('h1', { text: ex.title }));
  const seg = { firstTime: false, size: 1 };
  const round = step.round === 'r3' ? r3For(state.loop) : ROUNDS[step.round];
  const marks = [{ p: E.threshold(seg, facts, state.weights), label: 'your line', color: T.C.pm }];
  box.append(el('div', { class: 'viz' }, [axis({ marks, caption: 'chance the applicant repays' })]));
  const list = el('ol', { class: 'bul' });
  ex.steps.forEach(t => list.append(el('li', { text: t })));
  box.append(list);
  box.append(el('div', { class: 'actions' }, [el('button', { class: 'btn', onclick: () => setState(S.next(state)) }, 'Got it')]));
  return box;
};

/* ---------- values: the judgment screen ---------- */
const BRIEF = [
  'Regulators have warned us about losses. <b>The board says a dollar lost hurts one and a half times as much as a dollar earned.</b>',
  'Our charter commits us to first-time borrowers. <b>The board values each first-time approval at about the profit on a standard loan.</b>'
];
screens.values = step => {
  const round = step.round === 'r3' ? r3For(state.loop) : ROUNDS[step.round];
  const box = el('div', { class: 'screen' });
  box.append(el('p', { class: 'eyebrow', text: ROUND_LABEL[step.round] }), el('h1', { text: 'What does the board care about?' }));
  const brief = el('div', { class: 'brief' });
  BRIEF.forEach(t => brief.append(el('p', { html: t })));
  if (step.round === 'r3') brief.append(el('p', { html: 'New this round: <b>franchise expansions</b>, a kind of borrower the bank has only just started serving.' }));
  box.append(brief);

  const repeat = { firstTime: false, size: 1 };
  const firstTime = round.segments.find(s => s.firstTime) || { firstTime: true, size: 0.6 };
  const vizHost = el('div', { class: 'viz' });
  const readout = el('p', { class: 'saysline', 'aria-live': 'polite' });

  function paint() {
    const marks = [
      { p: E.threshold(repeat, facts, state.weights), label: 'repeat', color: T.C.pm },
      { p: E.threshold(firstTime, facts, state.weights), label: 'first-time', color: T.C.pm, dashed: true }
    ];
    const bands = [];
    if (round.tiers.length > 1) {
      const cuts = cutPoints(repeat, state.weights, round);
      const edges = [AX.min].concat(cuts.map(c => c.p)).concat([AX.max]);
      const order = [E.bestAction(AX.min, repeat, facts, state.weights, round.tiers)].concat(cuts.map(c => c.to));
      const colour = { decline: T.C.faint, high: T.C.brass, standard: T.C.pm, low: T.C.ok };
      for (let i = 0; i < order.length; i++) bands.push({ from: edges[i], to: edges[i + 1], color: colour[order[i]] || T.C.faint, opacity: 0.2 });
    }
    vizHost.innerHTML = '';
    vizHost.append(axis({ marks, bands }));
    const tRepeat = E.threshold(repeat, facts, state.weights), tFirst = E.threshold(firstTime, facts, state.weights);
    readout.innerHTML = '';
    readout.append(document.createTextNode('With these values you approve '), el('b', { text: 'repeat' }),
      document.createTextNode(' borrowers above '), el('b', { text: pct(tRepeat) }),
      document.createTextNode(' and '), el('b', { text: 'first-time' }),
      document.createTextNode(' borrowers above '), el('b', { text: pct(tFirst) }), document.createTextNode('.'));
    if (round.tiers.length > 1) readout.append(el('span', { class: 'hint', text: ' The bands show which rate you would offer.' }));
  }

  const mk = (key, label, min, max, stepSize, unit) => {
    const row = el('div', { class: 'sliderrow' });
    const val = el('span', { class: 'val', text: fmtWeight(key, state.weights[key]) + unit });
    const input = el('input', { type: 'range', min, max, step: stepSize, value: state.weights[key],
      'aria-label': label,
      oninput: e => { const w = {}; w[key] = parseFloat(e.target.value); state = S.setWeights(state, w); val.textContent = fmtWeight(key, state.weights[key]) + unit; paint(); },
      onchange: () => persist() });
    row.append(el('label', {}, [el('span', { text: label }), val]), input);
    return row;
  };
  box.append(mk('loss', 'How much does a lost dollar hurt?', 0.5, 2.5, 0.25, '×'));
  box.append(mk('firstTime', 'What is a first-time approval worth?', 0, 5, 0.5, ' loan profits'));
  box.append(vizHost, readout);
  box.append(el('div', { class: 'actions' }, [
    el('button', { class: 'btn', onclick: () => setState(S.next(state)) }, 'Lock my values')
  ]));
  box.append(el('p', { class: 'viz-note', text: 'No score on this screen, on purpose. You are here to read the board, not to hunt for a number.' }));
  paint();
  return box;
};
function fmtWeight(key, v) { return key === 'loss' ? v.toFixed(2) : String(v); }

/* ---------- information: what to buy ---------- */
screens.info = step => {
  const round = ROUNDS[step.round];
  const bought = new Set(state.bought[step.round]);
  const box = el('div', { class: 'screen' });
  box.append(el('p', { class: 'eyebrow', text: ROUND_LABEL[step.round] }), el('h1', { text: 'What will you pay to know?' }));
  box.append(el('p', { class: 'lede-g', text: 'A prediction costs ' + round.price.toFixed(2) + ' points per applicant in this round, and tells you each borrower’s chance of repaying instead of only the group average.' }));
  const wrap = el('div', { class: 'tw' });
  const table = el('table', { class: 'game' });
  table.append(el('thead', {}, [el('tr', {}, [
    el('th', { text: 'Who' }), el('th', { text: 'Applicants' }), el('th', { text: 'Typical loan' }),
    el('th', { text: 'Group average repay' }), el('th', { text: 'Cost to predict' }), el('th', { text: 'Buy?' })
  ])]));
  const body = el('tbody');
  round.segments.forEach(seg => {
    const cost = (round.price * seg.n);
    const tag = el('span', { text: bought.has(seg.key) ? 'Buying' : 'Skip' });
    const cb = el('input', { type: 'checkbox', ...(bought.has(seg.key) ? { checked: 'checked' } : {}),
      onchange: e => {
        state = S.toggleBuy(state, step.round, seg.key); persist();
        tag.textContent = e.target.checked ? 'Buying' : 'Skip';
      } });
    body.append(el('tr', {}, [
      el('td', {}, [el('strong', { text: seg.label })]),
      el('td', { class: 'num', text: String(seg.n) }),
      el('td', { class: 'num', text: seg.size < 1 ? 'small' : seg.size > 1.2 ? 'large' : 'standard' }),
      el('td', { class: 'num', text: pct(seg.prior.mean) }),
      el('td', { class: 'num', text: cost.toFixed(2) }),
      el('td', {}, [el('label', { class: 'chk' }, [cb, tag])])
    ]));
  });
  table.append(body); wrap.append(table); box.append(wrap);
  box.append(el('p', { class: 'viz-note', text: 'Buying nothing is allowed. Without a prediction every applicant in a group looks the same, so they all get the same answer.' }));
  box.append(el('div', { class: 'actions' }, [
    el('button', { class: 'btn', onclick: () => runRound(step.round) }, 'Run the round')
  ]));
  return box;
};

/* ---------- referrals: where to spend scarce human attention ---------- */
let r3cache = null;
function r3Session() {
  if (!r3cache || r3cache.loop !== state.loop) {
    const round = r3For(state.loop);
    r3cache = { loop: state.loop, round, session: E.buildSession({ round, seed: state.seed + 3 }) };
  }
  return r3cache;
}
screens.referrals = () => {
  const { round, session } = r3Session();
  const box = el('div', { class: 'screen' });
  const used = state.referred.length;
  box.append(el('p', { class: 'eyebrow', text: 'Round 3' }), el('h1', { text: 'Five hours of human review' }));
  box.append(el('p', { class: 'lede-g', text: 'Every applicant already has a sharp prediction, free. Reviewing one by hand tells you what is actually true about that borrower, and you have five hours.' }));
  const hoursTag = el('span', { class: 'hours', text: '' });
  box.append(el('p', {}, [hoursTag]));
  const boxes = [];
  function refreshHours() {
    const left = HOURS - state.referred.length;
    hoursTag.textContent = left + ' of ' + HOURS + ' hours left';
    hoursTag.className = 'hours' + (left === 0 ? ' spent' : '');
    boxes.forEach(({ cb, i, tag }) => {
      const on = state.referred.includes(i);
      tag.textContent = on ? 'Reviewing' : '';
      if (!on && left === 0) cb.setAttribute('disabled', 'disabled'); else cb.removeAttribute('disabled');
    });
  }
  const order = session.applicants.map((a, i) => ({ a, i }))
    .sort((x, y) => Math.abs(x.a.pHatModel - E.threshold(x.a.seg, facts, state.weights)) - Math.abs(y.a.pHatModel - E.threshold(y.a.seg, facts, state.weights)));
  const wrap = el('div', { class: 'tw' });
  const table = el('table', { class: 'game' });
  table.append(el('thead', {}, [el('tr', {}, [el('th', { text: 'Who' }), el('th', { text: 'Model says' }), el('th', { text: 'Note' }), el('th', { text: 'Review?' })])]));
  const body = el('tbody');
  order.forEach(({ a, i }) => {
    const on = state.referred.includes(i);
    const tag = el('span', { text: on ? 'Reviewing' : '' });
    const cb = el('input', { type: 'checkbox', ...(on ? { checked: 'checked' } : {}),
      onchange: e => {
        const before = state.referred.length;
        state = S.toggleRefer(state, i, HOURS); persist();
        if (state.referred.length === before) e.target.checked = false;   // budget refused it
        refreshHours();
      } });
    boxes.push({ cb, i, tag });
    body.append(el('tr', {}, [
      el('td', { text: a.seg.label }),
      el('td', { class: 'num', text: pct(a.pHatModel) }),
      el('td', {}, a.flagged ? [el('span', { class: 'flagchip', text: 'unfamiliar' })] : []),
      el('td', {}, [el('label', { class: 'chk' }, [cb, tag])])
    ]));
  });
  table.append(body); wrap.append(table); box.append(wrap);
  refreshHours();
  box.append(el('p', { class: 'viz-note', text: 'Sorted by how close each one sits to your threshold, because those are the calls your values are least sure about.' }));
  box.append(el('div', { class: 'actions' }, [el('button', { class: 'btn', onclick: () => runRound('r3') }, 'Run the round')]));
  return box;
};

/* ---------- the feedback loop decision ---------- */
screens.loop = () => {
  const box = el('div', { class: 'screen' });
  box.append(el('p', { class: 'eyebrow', text: 'Before round 3' }), el('h1', { text: 'Buy a feedback loop?' }));
  box.append(el('p', { class: 'lede-g', text: 'For ' + LOOP_COST + ' points you can wire up early repayment data: the model starts watching how new loans behave in their first months, instead of waiting for the year to end.' }));
  box.append(el('div', { class: 'brief' }, [
    el('p', { html: 'It does not give the model a <b>bigger</b> history. It gives it a <b>faster</b> one.' }),
    el('p', { html: 'If a kind of borrower starts behaving differently from the past, the loop notices and flags them as <b>unfamiliar</b> rather than predicting confidently from old patterns.' })
  ]));
  box.append(el('div', { class: 'actions' }, [
    el('button', { class: 'btn', onclick: () => setState(S.next(S.setLoop(state, true))) }, 'Invest ' + LOOP_COST + ' points'),
    el('button', { class: 'btn ghost', onclick: () => setState(S.next(S.setLoop(state, false))) }, 'Skip it')
  ]));
  return box;
};

/* ---------- running a round ----------
 * Every figure in a debrief is an EXPECTED value. The realized draw is shown beside it and named
 * luck, and it never counts against the player.
 */
const WGRID = [];
for (const loss of [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25]) for (const firstTime of [1.5, 2.25, 3, 3.75, 4.5]) WGRID.push({ loss, firstTime });

function outcomeOf(points, action) { return action === 'decline' ? 'none' : points > 0 ? 'repaid' : points < 0 ? 'default' : 'none'; }

function runRound(roundId) {
  if (S.isResolved(state, roundId)) { setState(S.next(state)); return; }
  const result = roundId === 'r3' ? resolveR3() : resolveFlat(roundId);
  setState(S.next(S.resolveRound(state, roundId, result)));
}

function resolveFlat(roundId) {
  const round = ROUNDS[roundId];
  const bought = new Set(state.bought[roundId]);
  const d = E.decompose({ round, facts, weights: state.weights, bought });
  const sim = E.simulateRound({ round, facts, weights: state.weights, bought, seed: state.seed + roundId.charCodeAt(1) });
  const atStake = Math.max(...WGRID.map(w => E.roundValue({ round, facts, weights: BOARD, bought }).total - E.roundValue({ round, facts, weights: w, bought }).total));
  const voi = [...bought].map(k => {
    const v = E.valueOfInformation({ round, facts, weights: state.weights, segKey: k });
    return { label: round.segments.find(s => s.key === k).label, net: v.net, price: v.price };
  });
  return {
    vAct: d.vAct, vPar: d.vPar, vFree: d.vFree, judgment: d.judgment, information: d.information,
    gapToPar: d.gapToPar, costOfUncertainty: d.costOfUncertainty, realized: sim.realized, atStake,
    bought: [...bought], voi,
    dots: sim.applicants.map(a => ({ p: a.p, outcome: outcomeOf(a.points, a.action) })),
    you: E.threshold({ firstTime: false, size: 1 }, facts, state.weights),
    board: E.threshold({ firstTime: false, size: 1 }, facts, BOARD)
  };
}

function resolveR3() {
  const { round, session } = r3Session();
  const referred = new Set(state.referred);
  const cost = state.loop ? LOOP_COST : 0;
  const vAct = E.sessionValue({ session, facts, weights: state.weights, referred, loopCost: cost });
  const vBoardOnPlayerInfo = E.sessionValue({ session, facts, weights: BOARD, referred, loopCost: cost });
  /* Par may not peek at the truth: its referrals are chosen from what the player could see. */
  const par = [true, false].map(loop => {
    const r = r3For(loop), s = E.buildSession({ round: r, seed: state.seed + 3 });
    const best = E.bestReferrals({ session: s, facts, weights: BOARD, hours: HOURS }).referred;
    return { loop, value: E.sessionValue({ session: s, facts, weights: BOARD, referred: best, loopCost: loop ? LOOP_COST : 0 }) };
  }).sort((a, b) => b.value - a.value)[0];
  const sim = E.simulateSession({ session, facts, weights: state.weights, referred, seed: state.seed + 33, loopCost: cost });
  const atStake = Math.max(...WGRID.map(w => vBoardOnPlayerInfo - E.sessionValue({ session, facts, weights: w, referred, loopCost: cost })));
  return {
    vAct, vPar: par.value, vFree: E.freeValue({ round, facts }),
    judgment: vBoardOnPlayerInfo - vAct, information: par.value - vBoardOnPlayerInfo,
    gapToPar: par.value - vAct, costOfUncertainty: E.freeValue({ round, facts }) - par.value,
    realized: sim.realized, atStake, parLoop: par.loop, loop: state.loop, referred: [...referred],
    voi: [], bought: [],
    dots: session.applicants.map((a, i) => ({ p: a.p, outcome: outcomeOf(sim.outcomes[i].points, sim.outcomes[i].action) })),
    you: E.threshold({ firstTime: false, size: 1 }, facts, state.weights),
    board: E.threshold({ firstTime: false, size: 1 }, facts, BOARD)
  };
}

/* ---------- debrief ---------- */
function bridgeRow(label, sub, cls, from, to, amount, lo, hi) {
  const span = hi - lo || 1;
  const a = Math.min(from, to), b = Math.max(from, to);
  const row = el('div', { class: 'bridge' });
  row.append(el('div', { class: 'lbl' }, [el('b', { text: label }), sub ? el('i', { text: sub }) : document.createTextNode('')]));
  const track = el('div', { class: 'btrack' });
  track.append(el('div', { class: 'bseg ' + cls, style: `left:${((a - lo) / span) * 100}%;width:${Math.max(0.6, ((b - a) / span) * 100)}%` }));
  row.append(track, el('div', { class: 'amt', text: amount }));
  return row;
}

screens.debrief = step => {
  const r = state.results[step.round];
  const box = el('div', { class: 'screen' });
  box.append(el('p', { class: 'eyebrow', text: ROUND_LABEL[step.round] }), el('h1', { text: 'Where your points went' }));

  const head = el('p', { class: 'headline' });
  if (r.gapToPar < 0.05 && r.gapToPar > -0.05) head.textContent = 'You matched the best play available. Nothing was left on the table.';
  else if (r.gapToPar < 0) {
    head.textContent = 'You finished ' + pts(-r.gapToPar) + ' points ahead of par. Your caution guarded against a shift the model could not see.';
  } else {
    head.append(document.createTextNode('You left '), el('span', { class: 'num', text: pts(r.gapToPar) }),
      document.createTextNode(' points on the table: '), el('span', { class: 'num', text: pts(r.judgment) }),
      document.createTextNode(' from how you weighed outcomes, '), el('span', { class: 'num', text: pts(r.information) }),
      document.createTextNode(' from what you chose to learn.'));
  }
  box.append(head);

  const lo = Math.min(0, r.vAct, r.realized), hi = Math.max(r.vFree, r.realized, r.vPar);
  const vBoardInfo = r.vAct + r.judgment;
  const bridge = el('div', {});
  bridge.append(bridgeRow('If every risk were known', 'free, and impossible', 'soft', lo, r.vFree, pts(r.vFree), lo, hi));
  bridge.append(bridgeRow('Price of not knowing', 'not your fault', 'grey', r.vPar, r.vFree, pts(-(r.costOfUncertainty)), lo, hi));
  bridge.append(bridgeRow('Par', 'the best play available to you', 'soft', lo, r.vPar, pts(r.vPar), lo, hi));
  bridge.append(bridgeRow('Judgment', 'how you weighed outcomes', 'loss', r.vAct, vBoardInfo, pts(-r.judgment), lo, hi));
  bridge.append(bridgeRow('Information', 'what you chose to learn', 'loss', vBoardInfo, r.vPar, pts(-r.information), lo, hi));
  bridge.append(bridgeRow('Your decisions', 'were worth', 'gain', lo, r.vAct, pts(r.vAct), lo, hi));
  bridge.append(bridgeRow('Luck', 'never counted against you', r.realized >= r.vAct ? 'luck' : 'loss', r.vAct, r.realized, (r.realized >= r.vAct ? '+' : '') + pts(r.realized - r.vAct), lo, hi));
  box.append(bridge);

  const C = T.C;
  const dots = r.dots.map(d => ({ p: d.p, color: d.outcome === 'repaid' ? C.ok : d.outcome === 'default' ? C.ink : C.faint, opacity: d.outcome === 'none' ? 0.35 : 1 }));
  const marks = [{ p: r.you, label: 'your line', color: C.pm }, { p: r.board, label: 'the board’s', color: C.faint, dashed: true }];
  box.append(el('div', { class: 'viz' }, [axis({ dots, marks, caption: 'this round’s applicants, by what they turned out to be' })]));
  box.append(el('p', { class: 'viz-note', text: 'Green repaid, dark defaulted, faint were declined or turned you down. The applicants between your line and the board’s are where your judgment differed. The figures above are averages over every way the round could have gone, not a count of these dots.' }));

  const defaults = r.dots.filter(d => d.outcome === 'default').length;
  const luck = r.realized - r.vAct;
  const luckLine = Math.abs(luck) < 0.05 * Math.max(1, Math.abs(r.vAct))
    ? 'This round landed close to what your decisions were worth.'
    : (luck < 0
        ? 'This round went badly: ' + defaults + (defaults === 1 ? ' loan defaulted' : ' loans defaulted') +
          '. At these stakes a single default costs about fifteen repayments, so one unlucky borrower swamps a round. That is variance, not a verdict on your decisions, which is why the figures above are averages.'
        : 'This round went well: ' + (defaults === 0 ? 'nothing defaulted' : 'only ' + defaults + ' defaulted') +
          '. Pleasant, but it says as little about your decisions as a bad round would.');
  box.append(el('p', { class: 'saysline' }, [
    document.createTextNode('What actually happened: '), el('b', { text: pts(r.realized) }),
    document.createTextNode(' points. Your decisions were worth '), el('b', { text: pts(r.vAct) }),
    document.createTextNode('. ' + luckLine)
  ]));

  if (r.voi && r.voi.length) {
    const ul = el('ul', { class: 'bul' });
    r.voi.forEach(v => ul.append(el('li', { text: v.label + ': the prediction was worth ' + pts(v.net + v.price) + ' and cost ' + v.price.toFixed(2) + ', so buying it ' + (v.net >= 0 ? 'gained you ' : 'cost you ') + pts(Math.abs(v.net)) + '.' })));
    box.append(el('h2', { text: 'What you paid to know' }), ul);
  } else if (step.round !== 'r3') {
    box.append(el('p', { class: 'viz-note', text: 'You bought no predictions this round, so every applicant in a group got the same answer.' }));
  }
  if (step.round === 'r3') {
    box.append(el('p', { class: 'viz-note', text: state.loop
      ? 'Your feedback loop flagged the unfamiliar borrowers, which is what made five hours of review worth spending.'
      : 'Without a feedback loop the model kept predicting from old patterns, so nothing told you which borrowers had changed.' }));
  }

  const det = el('details');
  det.append(el('summary', { text: 'How this is calculated' }));
  det.append(el('p', { html: 'Judgment is what the round would have been worth with the board’s weights on <em>your</em> information, minus what it was worth with yours. Information is par minus that same figure. Both are expected values, so luck never enters them. They add to the gap exactly.' }));
  box.append(det);
  box.append(el('div', { class: 'actions' }, [el('button', { class: 'btn', onclick: () => setState(S.next(state)) }, step.round === 'r3' ? 'See all three rounds' : 'Next round')]));
  return box;
};

/* ---------- across three rounds: the book's central claim, in the player's own numbers ---------- */
screens.summary = () => {
  const box = el('div', { class: 'screen' });
  box.append(el('h1', { text: 'What got scarce' }));
  box.append(el('p', { class: 'lede-g', text: 'Prediction got cheaper and sharper every round. Here is how much was riding on your judgment each time, and how much of it you left behind.' }));
  const rows = S.ROUND_IDS.map(id => ({ id, r: state.results[id] })).filter(x => x.r);
  const hi = Math.max(...rows.map(x => x.r.atStake), 1);
  const chart = el('div', {});
  rows.forEach(({ id, r }, i) => {
    const row = el('div', { class: 'bridge' });
    row.append(el('div', { class: 'lbl' }, [el('b', { text: ROUND_LABEL[id] }), el('i', { text: ['one prediction bought', 'three bought, pricing added', 'free for everyone'][i] })]));
    const track = el('div', { class: 'btrack' });
    track.append(el('div', { class: 'bseg soft', style: `left:0;width:${(r.atStake / hi) * 100}%` }));
    track.append(el('div', { class: 'bseg loss', style: `left:0;width:${(Math.max(0, r.judgment) / hi) * 100}%` }));
    row.append(track, el('div', { class: 'amt', text: pts(r.atStake) }));
    chart.append(row);
  });
  box.append(chart);
  box.append(el('p', { class: 'viz-note', text: 'The pale bar is how much your values could have swung the result that round. The hatched part is what your values actually cost you. The pale bar grows because cheap prediction is used in more places, and every one of those places needs someone to say what the outcomes are worth.' }));
  const quality = rows.reduce((t, x) => t + x.r.vAct, 0);
  const realized = rows.reduce((t, x) => t + x.r.realized, 0);
  const lost = rows.reduce((t, x) => t + Math.max(0, x.r.judgment), 0);
  box.append(el('p', { class: 'saysline' }, [
    document.createTextNode('Across three rounds your decisions were worth '), el('b', { text: pts(quality) }),
    document.createTextNode(' points, of which '), el('b', { text: pts(lost) }),
    document.createTextNode(' went to judgment. The draw itself landed on '), el('b', { text: pts(realized) }),
    document.createTextNode(', but that is the part you did not control.')
  ]));
  box.append(el('div', { class: 'actions' }, [el('button', { class: 'btn', onclick: () => setState(S.next(state)) }, 'Back to your three calls')]));
  return box;
};

/* ---------- the transfer task ---------- */
const CANVAS_CELLS = [
  { id: 'action', label: 'Action', hint: 'What are you actually trying to decide?' },
  { id: 'prediction', label: 'Prediction', hint: 'What would you need to know to make it well?' },
  { id: 'judgment', label: 'Judgment', hint: 'What is each outcome worth, and to whom?' },
  { id: 'outcome', label: 'Outcome', hint: 'How would you know it went well?' },
  { id: 'training', label: 'Training data', hint: 'What would you learn the pattern from?' },
  { id: 'input', label: 'Input data', hint: 'What would you need at the moment of deciding?' },
  { id: 'feedback', label: 'Feedback data', hint: 'What would tell you the world had changed?' }
];
screens.canvas = () => {
  const box = el('div', { class: 'screen' });
  box.append(el('h1', { text: 'One decision in your own organization' }));
  box.append(el('p', { class: 'lede-g', text: 'Pick a real decision your team makes over and over. Split it the way you just split lending. The two cells that usually cause the argument are prediction and judgment.' }));
  const form = el('div', { class: 'canvasform' });
  CANVAS_CELLS.forEach((c, i) => {
    const cell = el('div', { class: 'ccell' + (i === 0 ? ' cell3' : '') });
    const id = 'canvas-' + c.id;
    cell.append(el('label', { for: id, text: c.label }), el('span', { class: 'hint', text: c.hint }));
    cell.append(el('textarea', { id, maxlength: '600', value: state.canvas[c.id] || '',
      oninput: e => { state = S.setCanvas(state, c.id, e.target.value); },
      onchange: () => persist() }));
    form.append(cell);
  });
  box.append(form);
  box.append(el('p', { class: 'viz-note', text: 'This stays in your browser. Nothing here is uploaded, and the game has no analytics of any kind. Print it if you want to keep it.' }));
  box.append(el('div', { class: 'actions' }, [
    el('button', { class: 'btn ghost', onclick: () => window.print() }, 'Print'),
    el('button', { class: 'btn', onclick: () => setState(S.next(state)) }, 'Finish')
  ]));
  return box;
};

screens.end = () => {
  const box = el('div', { class: 'screen' });
  box.append(el('h1', { text: 'In this game the board handed you its goals' }));
  box.append(el('p', { class: 'lede-g', text: 'In your organization, someone has to write them. No model will do that for you, and as prediction keeps getting cheaper it is the part that keeps mattering more.' }));
  box.append(el('div', { class: 'actions' }, [
    el('a', { class: 'btn', href: 'index.html#pm' }, 'Read the ideas behind it'),
    el('button', { class: 'btn ghost', onclick: () => { storage.clear(); state = S.initialState(seedFrom(sessionCode)); render(); } }, 'Play again')
  ]));
  return box;
};

/* ---------- render ---------- */
function render() {
  const step = S.stepAt(state);
  const label = S.progressLabel(state);
  $('#bar-round').textContent = label.round;
  $('#bar-step').textContent = label.name;
  const host = $('#screen');
  host.innerHTML = '';
  const view = (screens[step.id] || screens.start)(step);
  if (S.canGoBack(state)) {
    const acts = view.querySelector('.actions');
    if (acts) acts.append(el('button', { class: 'btn ghost', onclick: () => setState(S.back(state)) }, 'Back'));
  }
  host.append(view);
  if (DEBUG) host.append(debugPanel(step));
  host.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function debugPanel(step) {
  const panel = el('div', { class: 'debugpanel' });
  const round = step.round === 'r3' ? r3For(state.loop) : ROUNDS[step.round || 'r1'];
  const bought = new Set(state.bought[step.round] || []);
  const lines = [
    'seed ' + state.seed + '   step ' + state.step + ' (' + step.id + (step.round ? ' ' + step.round : '') + ')',
    'weights ' + JSON.stringify(state.weights) + '   loop ' + state.loop,
    'your threshold repeat ' + pct(E.threshold({ firstTime: false, size: 1 }, facts, state.weights)) +
      '   board ' + pct(E.threshold({ firstTime: false, size: 1 }, facts, BOARD))
  ];
  if (step.round && step.round !== 'r3') {
    const par = E.parSearch({ round, facts });
    lines.push('par ' + par.value.toFixed(2) + ' buying [' + [...par.bought].join(',') + ']');
    lines.push('you  ' + E.roundValue({ round, facts, weights: state.weights, bought }).total.toFixed(2) + ' buying [' + [...bought].join(',') + ']');
    round.segments.forEach(s => lines.push('  ' + s.key.padEnd(12) + ' base ' + pct(s.prior.mean) +
      '  net VOI(board) ' + E.valueOfInformation({ round, facts, weights: BOARD, segKey: s.key }).net.toFixed(2)));
  }
  const r = state.results[step.round];
  if (r) lines.push('result ' + JSON.stringify({ vAct: +r.vAct.toFixed(2), vPar: +r.vPar.toFixed(2), judgment: +r.judgment.toFixed(2), information: +r.information.toFixed(2), realized: +r.realized.toFixed(2), atStake: +r.atStake.toFixed(2) }));
  panel.append(el('pre', { text: lines.join('\n') }));
  return panel;
}

/* Charts bake colours into markup, so a theme change has to rebuild the screen. */
T.onRedraw(render);
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 180); });

const restored = storage.available ? storage.load() : { state: null, reason: 'empty' };
if (restored.state) state = restored.state;
render();
