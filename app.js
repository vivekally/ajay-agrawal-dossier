/* Ajay Agrawal Dossier - interactive infographics. No dependencies. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  var NS = "http://www.w3.org/2000/svg";
  /* Chart colours are read from the stylesheet rather than hard-coded, so the same
     render function produces a light or a dark chart. Re-read on every theme change. */
  var C = {};
  var COLOR_MAP = { pm: "--pm", pp: "--pp", brass: "--flag", ok: "--ok", ink: "--ink",
    soft: "--ink-soft", faint: "--ink-faint", rule: "--rule", ruleS: "--rule-strong",
    sunk: "--paper-sunk", raised: "--paper-raised" };
  var FALLBACK = { pm: "#1F5F7A", pp: "#A8451F", brass: "#7F631B", ok: "#3F6B45", ink: "#17171A",
    soft: "#55555F", faint: "#6A6A75", rule: "#E2DED4", ruleS: "#CFC9BC", sunk: "#F0EDE5", raised: "#FFFDF8" };
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    Object.keys(COLOR_MAP).forEach(function (k) {
      C[k] = (cs.getPropertyValue(COLOR_MAP[k]) || "").trim() || FALLBACK[k];
    });
  }
  readColors();

  /* Every chart that bakes a colour into markup registers a redraw here. */
  var REDRAW = [];
  function redrawAll() { readColors(); REDRAW.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ---------------- Tabs ---------------- */
  var tabs = $$(".tab"), panels = $$(".panel");
  function showTab(id, push) {
    var found = false;
    tabs.forEach(function (t) {
      var on = t.id === "tab-" + id;
      if (on) found = true;
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (!found) return false;
    panels.forEach(function (p) { p.classList.toggle("is-active", p.id === "p-" + id); });
    if (push && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    window.scrollTo(0, 0);
    return true;
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () { showTab(t.id.replace("tab-", ""), true); });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-goto]");
    if (a) { e.preventDefault(); showTab(a.getAttribute("data-goto"), true); }
  });
  // deep links: #pm, or #pm-canvas (tab + section)
  function routeFromHash() {
    var h = (location.hash || "").replace("#", "");
    if (!h) return;
    if (showTab(h, false)) return;
    var el = document.getElementById(h);
    if (el) {
      var panel = el.closest(".panel");
      if (panel) {
        showTab(panel.id.replace("p-", ""), false);
        setTimeout(function () { el.scrollIntoView(); }, 30);
      }
    }
  }
  window.addEventListener("hashchange", routeFromHash);

  /* ---------------- Segmented control helper ---------------- */
  function seg(rootSel, attr, onPick) {
    var root = $(rootSel); if (!root) return;
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $$("button", root).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      onPick(b.getAttribute(attr));
    });
  }

  /* ---------------- 01.4 Salary chart ---------------- */
  var SALARY = [
    { y: "2014", v: 316029.54, b: 1366.00 }, { y: "2015", v: 322544.52, b: 0 },
    { y: "2016", v: 401553.48, b: 1631.92 }, { y: "2017", v: 427093.98, b: 988.52 },
    { y: "2018", v: 433188.42, b: 1061.48 }, { y: "2019", v: 419279.46, b: 180.26 },
    { y: "2020", v: 424182.96, b: 151.08 }, { y: "recent", v: 492964.94, b: null, q: true }
  ];
  function money(n) { return "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  (function salary() {
    var host = $("#viz-salary"), det = $("#salary-detail"); if (!host) return;
    var cur = 7;
    function draw() {
    var W = 760, H = 260, pad = { t: 14, r: 12, b: 34, l: 56 };
    var max = 520000, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var bw = iw / SALARY.length, s = "";
    [0, 100000, 200000, 300000, 400000, 500000].forEach(function (g) {
      var y = pad.t + ih - (g / max) * ih;
      s += '<line class="gridline" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>';
      s += '<text class="lab-s" x="' + (pad.l - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">' + (g / 1000) + 'K</text>';
    });
    SALARY.forEach(function (d, i) {
      var h = (d.v / max) * ih, x = pad.l + i * bw + bw * 0.16, y = pad.t + ih - h, w = bw * 0.68;
      s += '<rect class="hot sal-bar" data-i="' + i + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
        '" rx="2" fill="' + (d.q ? C.brass : C.pm) + '" opacity="' + (d.q ? ".55" : ".88") + '"/>';
      s += '<text class="lab-s" x="' + (x + w / 2) + '" y="' + (H - 12) + '" text-anchor="middle">' + d.y + '</text>';
    });
    s += '<line class="axis" x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '"/>';
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Salary by year">' + s + '</svg>';
    pick(cur);
    }
    function pick(i) {
      cur = i;
      var d = SALARY[i];
      $$(".sal-bar", host).forEach(function (r, j) { r.setAttribute("opacity", j === i ? "1" : (SALARY[j].q ? ".4" : ".55")); });
      det.innerHTML = '<h4>' + (d.q ? "Most recent disclosure, year unstated" : d.y) + '</h4>' +
        '<p><span class="num" style="font-size:1.25rem;font-weight:600;color:var(--accent)">' + money(d.v) + '</span></p>' +
        '<p>' + (d.b === null ? "Taxable benefits not captured for this record."
          : "Taxable benefits: <span class=\"num\">" + money(d.b) + "</span>.") +
        (d.q ? " This figure appears on opengovca.com without a stated disclosure year, so it is plotted last rather than at a known position. Confirm against the official ontario.ca dataset before citing."
             : " Disclosed under the title Professor of Strategic Management, University of Toronto.") + '</p>' +
        '<span class="who">Ontario Public Sector Salary Disclosure</span>';
    }
    host.addEventListener("click", function (e) { var r = e.target.closest(".sal-bar"); if (r) pick(+r.dataset.i); });
    host.addEventListener("mouseover", function (e) { var r = e.target.closest(".sal-bar"); if (r) pick(+r.dataset.i); });
    draw();
    REDRAW.push(draw);
  })();

  /* ---------------- 03.2 Price change engine ---------------- */
  var ENGINE = [
    { k: "Machine prediction used", rel: "inv", col: "pm", note: "quantity demanded" },
    { k: "Value of human forecasting", rel: "dir", col: "faint", note: "substitute" },
    { k: "Value of human judgment", rel: "inv", col: "ok", note: "complement" },
    { k: "Value of data", rel: "inv", col: "ok", note: "complement" },
    { k: "Value of action / execution", rel: "inv", col: "ok", note: "complement" }
  ];
  (function engine() {
    var sl = $("#pm-cost"), out = $("#pm-cost-out"), host = $("#pm-bars"), vd = $("#pm-engine-verdict");
    if (!sl) return;
    host.innerHTML = ENGINE.map(function (d, i) {
      return '<div class="barrow"><span class="bl">' + d.k + '</span>' +
        '<span class="bartrack"><span class="barfill" id="ef' + i + '"></span></span>' +
        '<span class="bv" id="ev' + i + '"></span></div>';
    }).join("");
    var STATES = [
      { at: 100, t: "Prediction is expensive, so we ration it", d: "Forecasting is a specialist job. You predict only where the stakes justify the cost, and most decisions are made by rule of thumb instead." },
      { at: 60, t: "Prediction gets used where it was too costly before", d: "New applications appear, not because prediction got better at what it already did, but because it got cheap enough to try on problems nobody would have paid for." },
      { at: 30, t: "The complements become the bottleneck", d: "Prediction is no longer scarce. What is scarce is knowing what the outcomes are worth, and holding data nobody else has. Judgment and data are now the expensive inputs." },
      { at: 0, t: "Prediction is effectively free", d: "The strategic question stops being what can we predict and becomes what would we do differently if we knew. That question is judgment, and it does not get cheaper on its own." }
    ];
    function render() {
      var c = +sl.value, cheap = (100 - c) / 100;
      out.textContent = c > 75 ? "High" : c > 45 ? "Falling" : c > 18 ? "Low" : "Near zero";
      ENGINE.forEach(function (d, i) {
        var v = d.rel === "inv" ? (12 + cheap * 88) : (95 - cheap * 72);
        if (d.k === "Machine prediction used") v = 3 + Math.pow(cheap, 1.55) * 97;
        var fill = $("#ef" + i);
        fill.style.width = v.toFixed(1) + "%";
        fill.style.background = C[d.col];
        var el = $("#ev" + i);
        el.textContent = (d.rel === "inv" ? "+" : "") + Math.round(v);
        el.style.color = d.rel === "inv" ? C[d.col] : C.faint;
      });
      var st = c > 75 ? STATES[0] : c > 45 ? STATES[1] : c > 18 ? STATES[2] : STATES[3];
      vd.innerHTML = '<span class="vt">Where we are</span><span class="vb">' + st.t + '</span><p class="vd">' + st.d + '</p>';
    }
    sl.addEventListener("input", render); render();
    REDRAW.push(render);
  })();

  /* ---------------- 03.3 Anatomy of a decision ---------------- */
  var ANATOMY = {
    prediction: { t: "Prediction", who: "Machine, increasingly", d: "<p>Taking information you have to generate information you don't have. It outputs the probability of each possible outcome, and nothing else.</p><p><strong>This is the only box that got cheap.</strong> Every other consequence in the book is downstream of that one price change.</p>" },
    judgment: { t: "Judgment", who: "Human", d: "<p>Assigning value to each outcome. The prediction tells you there is a 12% chance of X; judgment tells you how bad X is and what it is worth to avoid.</p><p>Value <strong>rises</strong> as prediction gets cheap, because judgment is its complement. Specifying these payoffs formally is what the authors call reward function engineering.</p>" },
    action: { t: "Action", who: "Human or machine", d: "<p>What you actually do, given the prediction and the judgment. Automation of the action is a separate question from automation of the prediction, and the two are routinely confused.</p>" },
    outcome: { t: "Outcome", who: "The world", d: "<p>What actually happened. It closes the loop, and it is the only honest test of the whole chain. An outcome you never observe is an outcome you can never learn from.</p>" },
    input: { t: "Input data", who: "Operational", d: "<p>The data fed to the model at the moment of prediction. Usually the easiest to get and the most often taken for granted. If it will not be available in production at the moment the decision is made, the model is not deployable no matter how accurate.</p>" },
    training: { t: "Training data", who: "Historical", d: "<p>The data used to build the model. Usually the hardest and most expensive to acquire, and the most common reason an AI project stalls.</p>" },
    feedback: { t: "Feedback data", who: "Generated by use", d: "<p>Data produced by running the system, used to improve it. The compounding asset: the source of the flywheel, and the reason first movers accumulate durable advantage.</p>" }
  };
  (function anatomy() {
    var host = $("#viz-anatomy"), det = $("#anatomy-detail"); if (!host) return;
    var cur = "prediction";
    function draw() {
    var W = 760, H = 290;
    function box(id, x, y, w, h, label, fill, stroke, tcol) {
      return '<g class="hot anat" data-k="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
        '" rx="3" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
        '<text class="lab-b" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) + '" text-anchor="middle" fill="' + tcol + '">' + label + '</text></g>';
    }
    function arrow(x1, y1, x2, y2) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + C.ruleS + '" stroke-width="1.5" marker-end="url(#ah)"/>';
    }
    var s = '<defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">' +
      '<path d="M0,0 L8,4 L0,8 z" fill="' + C.ruleS + '"/></marker></defs>';
    s += '<text class="lab-s" x="14" y="26">THE DECISION</text>';
    var bw = 148, bh = 54, by = 44, gap = 42, x0 = 40;
    s += box("prediction", x0, by, bw, bh, "Prediction", C.pm, C.pm, C.raised);
    s += arrow(x0 + bw + 5, by + bh / 2, x0 + bw + gap - 6, by + bh / 2);
    s += box("judgment", x0 + bw + gap, by, bw, bh, "Judgment", C.raised, C.ok, C.ink);
    s += arrow(x0 + 2 * bw + gap + 5, by + bh / 2, x0 + 2 * bw + 2 * gap - 6, by + bh / 2);
    s += box("action", x0 + 2 * (bw + gap), by, bw, bh, "Action", C.raised, C.ruleS, C.ink);
    s += arrow(x0 + 3 * bw + 2 * gap + 5, by + bh / 2, x0 + 3 * bw + 3 * gap - 6, by + bh / 2);
    s += box("outcome", x0 + 3 * (bw + gap), by, bw, bh, "Outcome", C.raised, C.ruleS, C.ink);
    // feedback loop
    var lx = x0 + 3 * (bw + gap) + bw / 2, ry = by + bh + 16;
    s += '<path d="M' + lx + ',' + ry + ' L' + lx + ',' + (ry + 22) + ' L' + (x0 + bw / 2) + ',' + (ry + 22) + ' L' + (x0 + bw / 2) + ',' + (by + bh + 6) +
      '" fill="none" stroke="' + C.ruleS + '" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ah)"/>';
    s += '<text class="lab-s" x="' + (W / 2) + '" y="' + (ry + 18) + '" text-anchor="middle">learning loop</text>';
    s += '<text class="lab-s" x="14" y="200">THE DATA</text>';
    var dw = 200, dy = 214, dgap = 26, dx0 = 40;
    ["input", "training", "feedback"].forEach(function (k, i) {
      var x = dx0 + i * (dw + dgap);
      s += box(k, x, dy, dw, 46, ANATOMY[k].t, C.sunk, C.ruleS, C.soft);
      s += '<line x1="' + (x + dw / 2) + '" y1="' + dy + '" x2="' + (x + dw / 2) + '" y2="' + (dy - 12) + '" stroke="' + C.ruleS + '" stroke-width="1" stroke-dasharray="3 3"/>';
    });
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Anatomy of a decision">' + s + '</svg>';
    pick(cur);
    }
    function pick(k) {
      var d = ANATOMY[k]; if (!d) return;
      cur = k;
      $$(".anat", host).forEach(function (g) { g.style.opacity = g.dataset.k === k ? "1" : ".45"; });
      det.innerHTML = "<h4>" + d.t + "</h4>" + d.d + '<span class="who">Supplied by: ' + d.who + "</span>";
    }
    host.addEventListener("click", function (e) { var g = e.target.closest(".anat"); if (g) pick(g.dataset.k); });
    draw();
    REDRAW.push(draw);
  })();

  /* ---------------- 03.4 AI Canvas ---------------- */
  var CANVAS_CELLS = [
    { k: "prediction", n: "Prediction", q: "What do you need to know to make the decision?" },
    { k: "judgment", n: "Judgment", q: "How do you value different outcomes and errors?" },
    { k: "action", n: "Action", q: "What are you trying to do?" },
    { k: "outcome", n: "Outcome", q: "What are your success metrics?" },
    { k: "training", n: "Training data", q: "What data do you need to train the algorithm?" },
    { k: "input", n: "Input data", q: "What data do you need to run the algorithm live?" },
    { k: "feedback", n: "Feedback", q: "How can you use the outcomes to improve it?" }
  ];
  var CASES = {
    radiology: {
      label: "Radiology triage",
      prediction: "Probability that this scan contains a finding requiring urgent review, and where in the image it is.",
      judgment: "What a missed urgent finding costs versus what a false alarm costs. These are wildly asymmetric in medicine, and the ratio is a clinical and legal decision, not a technical one.",
      action: "Reorder the radiologist's worklist so likely-urgent scans surface first. Note that the action is triage, not diagnosis. Choosing the narrower action is what makes the project shippable.",
      outcome: "Time from scan to report for genuinely urgent cases. Not model accuracy, which is an input to the outcome rather than the outcome.",
      training: "Historic scans paired with the confirmed final diagnosis, not the initial read. This is the expensive part and it is why the project is hard.",
      input: "The scan itself, plus the patient's presenting complaint and history at the moment it is taken.",
      feedback: "The radiologist's eventual report and the confirmed clinical outcome, fed back so the ranking improves."
    },
    fraud: {
      label: "Card fraud",
      prediction: "Probability that this transaction, right now, is fraudulent.",
      judgment: "The cost of declining a legitimate customer versus the cost of approving a fraudulent charge. A false decline damages a relationship; a missed fraud is a bounded dollar loss. The ratio is a business decision.",
      action: "Approve, decline, or step up to additional verification. The three-way action is what makes cheap prediction valuable here.",
      outcome: "Net fraud losses plus the value lost to false declines, measured together rather than separately.",
      training: "Years of labelled transactions where the fraud outcome is ultimately known through chargebacks.",
      input: "Transaction amount, merchant, location, device, and the cardholder's behavioural history, all within milliseconds.",
      feedback: "Chargebacks and customer disputes, which arrive with a lag of weeks. The lag is the hard part of the design."
    },
    churn: {
      label: "Customer churn",
      prediction: "Probability this customer cancels within the next 90 days.",
      judgment: "What retaining this specific customer is worth, against the cost of the retention offer, including the cost of discounting customers who were never going to leave.",
      action: "Trigger a retention intervention, and choose which one. Prediction without a menu of actions produces a dashboard rather than a decision.",
      outcome: "Retained revenue net of the cost of the offers, including the ones wasted on customers who would have stayed anyway.",
      training: "Historic customer records including everyone who left, with behaviour in the window before they left.",
      input: "Current usage, support contacts, billing events, and engagement trend.",
      feedback: "Whether the intervened customer stayed, and ideally a holdout group that received no intervention."
    },
    lending: {
      label: "Small business lending",
      prediction: "Probability of default over the term of the loan, and expected loss given default.",
      judgment: "The lender's risk appetite, plus the regulatory and fairness constraints on which variables may be used at all. This is where policy enters the decision, and it is not derivable from data.",
      action: "Approve, decline, or price the loan differently. Pricing is the action that makes prediction most valuable, since it does not require a binary cut.",
      outcome: "Risk-adjusted return on the portfolio, and the rate of approved loans that perform.",
      training: "Historic loan books with realised repayment outcomes. Beware the selection problem: you only observe outcomes for loans that were approved.",
      input: "Applicant financials, transaction history, sector, and the macro conditions at application.",
      feedback: "Realised repayment, which arrives over the whole loan term, making the feedback loop slow and the flywheel weak."
    }
  };
  (function canvas() {
    var top = $("#canvas-top"), bot = $("#canvas-bot"), det = $("#canvas-detail");
    if (!top) return;
    var cur = "radiology", sel = "prediction";
    function cell(c) {
      return '<button class="cell cv-cell" data-k="' + c.k + '" aria-pressed="false">' +
        '<span class="cn">' + c.n + '</span><span class="cq">' + c.q + '</span></button>';
    }
    top.innerHTML = CANVAS_CELLS.slice(0, 4).map(cell).join("");
    bot.innerHTML = CANVAS_CELLS.slice(4).map(cell).join("");
    function render() {
      $$(".cv-cell").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === sel ? "true" : "false"); });
      var c = CANVAS_CELLS.filter(function (x) { return x.k === sel; })[0];
      det.innerHTML = "<h4>" + c.n + "</h4><p><em>" + c.q + "</em></p><p>" + CASES[cur][sel] + "</p>" +
        '<span class="who">Worked example: ' + CASES[cur].label + "</span>";
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".cv-cell"); if (!b) return;
      sel = b.dataset.k; render();
    });
    seg("#canvas-picker", "data-case", function (v) { cur = v; render(); });
    render();
  })();

  /* ---------------- 03.5 Amazon dial ---------------- */
  (function amazon() {
    var sl = $("#pm-acc"), out = $("#pm-acc-out"), host = $("#viz-amazon"), vd = $("#amazon-verdict");
    if (!sl) return;
    var W = 760, H = 210, pad = { t: 22, r: 16, b: 38, l: 52 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, THRESH = 72;
    function render() {
      var a = +sl.value, ret = Math.max(2, Math.round(100 - a));
      out.textContent = a + "%";
      var s = "";
      [0, 25, 50, 75, 100].forEach(function (g) {
        var y = pad.t + ih - (g / 100) * ih;
        s += '<line class="gridline" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>';
        s += '<text class="lab-s" x="' + (pad.l - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">' + g + '%</text>';
      });
      var tx = pad.l + (THRESH / 100) * iw;
      s += '<rect x="' + tx + '" y="' + pad.t + '" width="' + (W - pad.r - tx) + '" height="' + ih + '" fill="' + C.ok + '" opacity=".07"/>';
      s += '<line x1="' + tx + '" y1="' + pad.t + '" x2="' + tx + '" y2="' + (pad.t + ih) + '" stroke="' + C.ok + '" stroke-width="1.5" stroke-dasharray="5 4"/>';
      s += '<text class="lab-s" x="' + (tx + 7) + '" y="' + (pad.t + 12) + '" fill="' + C.ok + '">model flips here</text>';
      // returns line
      var pts = [];
      for (var x = 1; x <= 99; x += 2) pts.push((pad.l + (x / 100) * iw) + "," + (pad.t + ih - ((100 - x) / 100) * ih));
      s += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + C.pm + '" stroke-width="2" opacity=".35"/>';
      var cx = pad.l + (a / 100) * iw, cy = pad.t + ih - (ret / 100) * ih;
      s += '<line x1="' + cx + '" y1="' + pad.t + '" x2="' + cx + '" y2="' + (pad.t + ih) + '" stroke="' + C.ruleS + '" stroke-width="1"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="' + (a >= THRESH ? C.ok : C.pm) + '"/>';
      // Near the top of the plot the value label would sit on the axis caption, so drop it below the dot.
      var labY = ret > 82 ? cy + 20 : cy - 12;
      s += '<text class="lab-b" x="' + (cx + (a > 62 ? -12 : 12)) + '" y="' + labY + '" text-anchor="' + (a > 62 ? "end" : "start") + '" fill="' + (a >= THRESH ? C.ok : C.pm) + '">' + ret + '% returned</text>';
      s += '<line class="axis" x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '"/>';
      s += '<text class="lab-s" x="' + pad.l + '" y="' + (H - 12) + '">low accuracy</text>';
      s += '<text class="lab-s" x="' + (W - pad.r) + '" y="' + (H - 12) + '" text-anchor="end">near-perfect accuracy</text>';
      s += '<text class="lab" x="' + (pad.l - 40) + '" y="' + (pad.t - 8) + '">share of shipped items returned</text>';
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Amazon accuracy dial">' + s + '</svg>';
      var t, d;
      if (a < 40) {
        t = "Shopping, then shipping";
        d = "Returns would run at roughly " + ret + "%. Shipping first destroys value, so prediction is used only to rank recommendations inside the existing model. This is where Amazon actually is.";
      } else if (a < THRESH) {
        t = "Still shopping, then shipping";
        d = "Better recommendations, higher conversion, more revenue per visit. Real money, but the same business. Accuracy is rising and the model has not changed at all, which is the point of the experiment.";
      } else if (a < 92) {
        t = "Shipping, then shopping becomes viable";
        d = "At roughly " + ret + "% returns, shipping before the order starts to pay. But it only works if the whole system changes with it: a returns-pickup fleet, different warehousing, and probably vertical integration into logistics.";
      } else {
        t = "Shipping, then shopping, and a different company";
        d = "At roughly " + ret + "% returns Amazon stops being a store and becomes a supply chain that delivers what you were going to want. The moat is no longer selection or price. It is the prediction itself.";
      }
      vd.innerHTML = '<span class="vt">Business model</span><span class="vb">' + t + '</span><p class="vd">' + d + '</p>';
      vd.style.borderColor = a >= THRESH ? C.ok : "";
    }
    sl.addEventListener("input", render); render();
    REDRAW.push(render);
  })();

  /* ---------------- Chapter maps ---------------- */
  var PM_PARTS = [
    { p: "Framing", c: ["Introduction: Machine Intelligence", "Cheap Changes Everything"], n: 1 },
    { p: "Part One", t: "Prediction", c: ["Prediction Machine Magic", "Why It's Called Intelligence", "Data Is the New Oil", "The New Division of Labor"], n: 3 },
    { p: "Part Two", t: "Decision Making", c: ["Unpacking Decisions", "The Value of Judgment", "Predicting Judgment", "Taming Complexity", "Fully Automated Decision Making"], n: 7 },
    { p: "Part Three", t: "Tools", c: ["Deconstructing Work Flows", "Decomposing Decisions", "Job Redesign"], n: 12 },
    { p: "Part Four", t: "Strategy", c: ["AI in the C-Suite", "When AI Transforms Your Business", "Your Learning Strategy", "Managing AI Risk"], n: 15 },
    { p: "Part Five", t: "Society", c: ["Beyond Business"], n: 19 }
  ];
  var PP_PARTS = [
    { p: "Part One", t: "The Between Times", c: ["A Parable of Three Entrepreneurs", "AI's System Future", "AI Is Prediction Technology"], n: 1 },
    { p: "Part Two", t: "Rules", c: ["To Decide or Not to Decide", "Hidden Uncertainty", "Rules Are Glue"], n: 4 },
    { p: "Part Three", t: "Systems", c: ["Glued versus Oiled Systems", "The System Mindset", "The Greatest System of All"], n: 7 },
    { p: "Part Four", t: "Power", c: ["Disruption and Power", "Do Machines Have Power?", "Accumulating Power"], n: 10 },
    { p: "Part Five", t: "How AI Disrupts", c: ["A Great Decoupling", "Thinking Probabilistically", "The New Judges"], n: 13 },
    { p: "Part Six", t: "Envisaging New Systems", c: ["Designing Reliable Systems", "The Blank Slate", "Anticipating System Change"], n: 16 },
    { p: "Epilogue", c: ["AI Bias and Systems"], n: null }
  ];
  function chapters(sel, parts) {
    var host = $(sel); if (!host) return;
    host.innerHTML = parts.map(function (g) {
      var items = g.c.map(function (c, i) {
        return g.n === null ? "<li style='list-style:none;margin-left:-16px'>" + c + "</li>"
          : '<li value="' + (g.n + i) + '">' + c + "</li>";
      }).join("");
      return '<div class="chapgroup"><div class="ch"><span class="pnum">' + g.p.toUpperCase() + '</span>' +
        (g.t ? g.t : "") + '</div><ol>' + items + "</ol></div>";
    }).join("");
  }
  chapters("#pm-chapters", PM_PARTS);
  chapters("#pp-chapters", PP_PARTS);

  /* ---------------- 04.2 Point / Application / System ---------------- */
  var LEVELS = {
    point: {
      n: "Point solution", roi: 18, disrupt: 6, resist: 8,
      test: "Independent. Adopt it on Monday and nothing else has to change.",
      what: "<p>Improves an existing procedure in place. The system around it is untouched, which is exactly why it is easy to sell and easy to approve.</p><p><strong>Electricity version:</strong> swap the steam engine for an electric motor, keep the line shaft, keep the building. You save on fuel. Nothing else moves.</p><p><strong>AI version:</strong> a recommendation engine inside an existing store, a churn model feeding an existing retention team, a copilot inside an existing workflow.</p>",
      who: "Threatens nobody, so nobody blocks it. This is the reason almost all deployed AI is here.",
      catch: "The ceiling is low by construction. If the surrounding system was designed for expensive prediction, a better prediction mostly cannot be acted on."
    },
    app: {
      n: "Application solution", roi: 42, disrupt: 30, resist: 32,
      test: "Independent, but new. It enables a procedure that did not exist before, and still does not require the system to change.",
      what: "<p>A genuinely new stand-alone capability that can be adopted without rebuilding anything around it. More valuable than a point solution, and still bounded by the system it sits inside.</p><p><strong>Electricity version:</strong> portable power tools. Not a better version of something you had; a thing you could not do at all with a line shaft. But the factory layout stays.</p><p><strong>AI version:</strong> a researcher using a language model to draft and analyse interview guides. New work, same organisation.</p>",
      who: "Threatens specific roles rather than structures, so resistance is local and usually loses.",
      catch: "Often mistaken for transformation. It creates real new value and still leaves the underlying system, and therefore the power structure, intact."
    },
    system: {
      n: "System solution", roi: 100, disrupt: 100, resist: 100,
      test: "Dependent. The value of the improved decision requires other parts of the system to change too, so nothing pays until several things move together.",
      what: "<p>Redesign of the whole interdependent set of decisions. This is where the returns are, and it is why the returns are so hard to capture: no single change pays for itself, so there is no incremental path in.</p><p><strong>Electricity version:</strong> Ford's redesigned factory. Drop the line shaft entirely, put a motor on each machine, and arrange machines in the order the work flows rather than the order the shaft dictated. That is the assembly line, and it took about forty years to arrive.</p><p><strong>AI version:</strong> the insurer that stops transferring risk and starts reducing it. The hospital that moves care home because prediction happens continuously rather than at a visit.</p>",
      who: "Threatens whoever the current system makes powerful, which is usually whoever must approve the redesign. This is the whole thesis of the book.",
      catch: "Requires changing rules, roles, incentives, and decision rights at once, usually against the interests of the people who hold them. Slow, contested, and frequently easier for an entrant than an incumbent."
    }
  };
  (function levels() {
    var host = $("#viz-levels"), det = $("#levels-detail"); if (!host) return;
    var cur = "point";
    host.innerHTML = ["roi", "disrupt", "resist"].map(function (k, i) {
      var lab = ["Potential return", "Disruption to the system", "Resistance you should expect"][i];
      return '<div class="barrow"><span class="bl">' + lab + '</span>' +
        '<span class="bartrack"><span class="barfill" id="lv-' + k + '"></span></span>' +
        '<span class="bv" id="lvv-' + k + '"></span></div>';
    }).join("");
    function pick(v) {
      cur = v;
      var d = LEVELS[v];
      ["roi", "disrupt", "resist"].forEach(function (k) {
        $("#lv-" + k).style.width = d[k] + "%";
        $("#lv-" + k).style.background = C.pp;
        $("#lvv-" + k).textContent = d[k] < 25 ? "Low" : d[k] < 60 ? "Medium" : "High";
      });
      det.innerHTML = "<h4>" + d.n + "</h4>" +
        "<p><strong>Independence test:</strong> " + d.test + "</p>" + d.what +
        "<p><strong>Who it threatens:</strong> " + d.who + "</p>" +
        "<p><strong>The catch:</strong> " + d.catch + "</p>" +
        '<span class="who">Parable of three entrepreneurs, Power and Prediction ch. 1</span>';
    }
    seg("#level-picker", "data-lvl", pick);
    pick("point");
    REDRAW.push(function () { pick(cur); });
  })();

  /* ---------------- 04.3 The Between Times ---------------- */
  var ELEC = [
    { x: 17, y: 4, l: "1899", n: "4% of US manufacturing primary horsepower capacity drew on electric power. Seventeen years after Pearl Street, electricity was a curiosity in the factory." },
    { x: 27, y: 21, l: "1909", n: "21%. Adoption is accelerating, but most of it is still point-solution substitution: electric motors driving the same old line shafts." },
    { x: 37, y: 50, l: "1919", n: "50%. The crossover. This is roughly when the redesigned factory, with a motor on each machine and machines arranged by workflow, starts to be built rather than retrofitted." },
    { x: 47, y: 75, l: "1929", n: "75%. The system solution has won. The productivity gains economists spent decades looking for show up here, roughly forty years after the technology was proven." }
  ];
  var AIS = [
    { x: 11.7, y: 3.7, l: "Sep 2023", n: "3.7% of US firms reported using AI to produce goods or services, in the first BTOS collection." },
    { x: 12.2, y: 5.4, l: "Feb 2024", n: "5.4%. The rate roughly doubles in five months off a very small base." },
    { x: 13.9, y: 17, l: "Dec 2025", n: "Around 17%. The survey has been redesigned to ask about AI in any business function, which is part of why the level jumps." },
    { x: 14.1, y: 18, l: "Jan 2026", n: "18% of firms, rising to 32% when weighted by employment. Large firms adopt far earlier: 37% of firms with 250+ employees, under 20% of firms with four or fewer." },
    { x: 14.4, y: 20, l: "May 2026", n: "Between 17% and 20%, with 20% to 23% of firms expecting to use AI within six months. The curve is steep and the base is still small." }
  ];
  (function between() {
    var host = $("#viz-between"), det = $("#between-detail"); if (!host) return;
    var mode = "both";
    var W = 760, H = 320, pad = { t: 20, r: 20, b: 46, l: 52 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, XMAX = 50, YMAX = 80;
    var X = function (v) { return pad.l + (v / XMAX) * iw; };
    var Y = function (v) { return pad.t + ih - (v / YMAX) * ih; };
    function render() {
      var s = "";
      [0, 20, 40, 60, 80].forEach(function (g) {
        s += '<line class="gridline" x1="' + pad.l + '" y1="' + Y(g) + '" x2="' + (W - pad.r) + '" y2="' + Y(g) + '"/>';
        s += '<text class="lab-s" x="' + (pad.l - 8) + '" y="' + (Y(g) + 3.5) + '" text-anchor="end">' + g + '%</text>';
      });
      for (var t = 0; t <= XMAX; t += 10) {
        s += '<text class="lab-s" x="' + X(t) + '" y="' + (H - 24) + '" text-anchor="middle">' + t + '</text>';
      }
      s += '<text class="lab" x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle">years since the technology was demonstrably available (1882 / 2012)</text>';
      function series(data, col, show, key) {
        if (!show) return "";
        var o = '<polyline points="' + data.map(function (d) { return X(d.x) + "," + Y(d.y); }).join(" ") +
          '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round"/>';
        data.forEach(function (d, i) {
          o += '<circle class="hot bt-pt" data-s="' + key + '" data-i="' + i + '" cx="' + X(d.x) + '" cy="' + Y(d.y) +
            '" r="6" fill="' + col + '" stroke="' + C.raised + '" stroke-width="2"/>';
        });
        return o;
      }
      s += series(ELEC, C.brass, mode !== "ai", "e");
      s += series(AIS, C.pp, mode !== "elec", "a");
      if (mode !== "ai") {
        s += '<text class="lab-s" x="' + X(47) + '" y="' + (Y(75) - 14) + '" text-anchor="end" fill="' + C.brass + '">electrification</text>';
      }
      if (mode !== "elec") {
        s += '<text class="lab-s" x="' + X(14.4) + '" y="' + (Y(20) - 14) + '" text-anchor="middle" fill="' + C.pp + '">AI</text>';
      }
      s += '<line class="axis" x1="' + pad.l + '" y1="' + Y(0) + '" x2="' + (W - pad.r) + '" y2="' + Y(0) + '"/>';
      s += '<line class="axis" x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + Y(0) + '"/>';
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Electrification and AI adoption curves">' + s + '</svg>';
    }
    function pick(key, i) {
      var d = (key === "e" ? ELEC : AIS)[i];
      det.innerHTML = "<h4>" + d.l + " · " + d.y + "% · year " + d.x.toFixed(1) + "</h4><p>" + d.n + "</p>" +
        '<span class="who">' + (key === "e" ? "Devine 1983, from the US Census of Manufactures" : "US Census Bureau, Business Trends and Outlook Survey") + "</span>";
    }
    host.addEventListener("mouseover", function (e) { var c = e.target.closest(".bt-pt"); if (c) pick(c.dataset.s, +c.dataset.i); });
    host.addEventListener("click", function (e) { var c = e.target.closest(".bt-pt"); if (c) pick(c.dataset.s, +c.dataset.i); });
    seg("#between-picker", "data-series", function (v) { mode = v; render(); });
    render();
    REDRAW.push(render);
    det.innerHTML = "<h4>What the overlay actually shows</h4>" +
      "<p>At the same elapsed time, around year 14, electricity was powering under 5% of American manufacturing. AI is at 17% to 20% of American firms. On this measure AI is diffusing faster than electrification did, not slower.</p>" +
      "<p>That cuts slightly against the patient reading of the analogy. The book's defence is that adoption is not the same as transformation: firms using AI are overwhelmingly using it as a point solution, exactly as factories first used electric motors to turn the old line shaft. The forty-year lag was never about how many factories had electricity. It was about how long it took to stop building factories around a shaft that was no longer there.</p>" +
      '<span class="who">Hover any point for the underlying figure</span>';
  })();

  /* ---------------- 04.4 Glued vs oiled ---------------- */
  var GLUE = {
    glued: {
      n: "Glued system", rule: "Teach to the age-based curriculum",
      d: "<p>A rule sits at the centre, and the whole system has been built to make that rule work. The book calls the surrounding structure <strong>scaffolding</strong>: expensive apparatus whose only purpose is to hide the uncertainty that made the rule necessary in the first place.</p><p><strong>Education:</strong> children are grouped by age and taught a fixed sequence, because we could not measure what each child was ready for. Classrooms, timetables, teacher training, textbooks, standardised tests, and grade progression are all scaffolding for that rule.</p><p>Now drop in an AI that knows exactly what each child is ready to learn next. It is a genuinely excellent prediction, and it changes almost nothing, because the child still has to be in room 4B at 10am with thirty peers following a fixed sequence. The prediction has nowhere to go.</p><p><strong>Airports</strong> are the other example: the rule is 'arrive early', and the terminal, with its shops, lounges, and seating, is the scaffolding built around the uncertainty that rule conceals.</p>",
      verdict: "A powerful prediction dropped into a glued system yields a point solution, no matter how good the prediction is.",
      bars: { value: 15, change: 8, resist: 85 }
    },
    oiled: {
      n: "Oiled system", rule: "No fixed rule; decide on current information",
      d: "<p>An oiled system has no rigid rule at its centre, so it can absorb new information and act on it immediately. New prediction goes straight into a changed decision.</p><p><strong>COVID-19 is the book's cleanest case.</strong> Blanket distancing rules existed because we could not tell who was infectious. That is a rule standing in for missing information, and everything built around it, the closures, the capacity limits, the plexiglass, was scaffolding.</p><p>Roughly twelve companies replaced the rule with information: rapid antigen testing, and then a decision per person per day rather than a rule for everyone. The protocol was later adopted by more than 2,000 organisations. Same virus, same uncertainty, a system that could act on the answer.</p><p>Note what actually changed. Not the prediction, which was just a test. The system's willingness to make a decision at the point the information arrived.</p>",
      verdict: "The same prediction in an oiled system produces a system solution, because the decision it feeds is actually allowed to move.",
      bars: { value: 88, change: 82, resist: 30 }
    }
  };
  (function glue() {
    var host = $("#viz-glue"), det = $("#glue-detail"); if (!host) return;
    host.innerHTML = ["value", "change", "resist"].map(function (k, i) {
      var lab = ["Value the AI actually delivers", "How much the system changes", "Institutional resistance"][i];
      return '<div class="barrow"><span class="bl">' + lab + '</span><span class="bartrack">' +
        '<span class="barfill" id="gl-' + k + '" style="background:' + C.pp + '"></span></span>' +
        '<span class="bv" id="glv-' + k + '"></span></div>';
    }).join("");
    var cur = "glued";
    function pick(v) {
      cur = v;
      var d = GLUE[v];
      Object.keys(d.bars).forEach(function (k) {
        $("#gl-" + k).style.width = d.bars[k] + "%";
        $("#gl-" + k).style.background = (k === "resist" ? C.brass : C.pp);
        $("#glv-" + k).textContent = d.bars[k] < 25 ? "Low" : d.bars[k] < 60 ? "Medium" : "High";
      });
      det.innerHTML = "<h4>" + d.n + "</h4><p><strong>The rule at the centre:</strong> " + d.rule + "</p>" + d.d +
        '<p style="color:var(--ink);font-weight:600">' + d.verdict + "</p>" +
        '<span class="who">Power and Prediction, chapters 4 to 7</span>';
    }
    seg("#glue-picker", "data-glue", pick);
    pick("glued");
    REDRAW.push(function () { pick(cur); });
  })();

  /* ---------------- 04.5 Flint ---------------- */
  var FLINT = [
    { t: "The problem", hit: null, n: "<p>Flint, Michigan needed to find and replace lead service lines. Nobody knew which homes had them: the records were incomplete, wrong, or missing entirely. Digging up a home to check costs real money, and digging up the wrong home costs the same as digging up the right one.</p><p>This is a prediction problem wearing the clothes of an infrastructure problem. The scarce resource is not excavators. It is knowing where to dig.</p>", who: "Prediction and judgment are bundled, and neither is any good" },
    { t: "The prediction", hit: 80, n: "<p>University of Michigan researchers Eric Schwartz and Jacob Abernethy built a model predicting which homes had lead pipes, from property records, age, location, and the results of digs already completed.</p><p>When the model chose the homes, roughly <strong>80%</strong> of excavations found lead. The decoupling has happened: prediction now comes from a model built by researchers who are not in Flint, while judgment about what to do with it stays with the city.</p>", who: "Prediction: model. Judgment: city officials" },
    { t: "The override", hit: 15, n: "<p>Local politicians replaced the model's ranking with a district-by-district sweep, which was described as the more systematic and equitable approach. Every street in a district gets dug, in order.</p><p>The hit rate collapsed to roughly <strong>15%</strong>. Five in six excavations found nothing, and the money that bought them was gone.</p><p>The book's point is that this is not stupidity. The model took something away from the officials: the ability to decide which streets got attention and when. That is a real loss of power, and it was defended the way real losses of power usually are, in the language of fairness.</p>", who: "Prediction: discarded. Judgment and decision rights: reclaimed" },
    { t: "The court", hit: 80, n: "<p>A judge ordered the city to use the model's predictions again.</p><p>Note what it took: not a better model, not more accuracy, not a stronger business case. A court order. The technical problem had been solved at stage two and stayed solved throughout. What was contested was who got to decide.</p><p>This is the argument of the entire book in one case. The obstacle to AI's value is rarely the prediction. It is that acting on the prediction reallocates power, and the people losing it are usually the ones who must approve the change.</p>", who: "Decision rights: reassigned by an outside authority" }
  ];
  (function flint() {
    var host = $("#viz-flint"), det = $("#flint-detail"); if (!host) return;
    var W = 760, H = 150, pad = { l: 52, r: 20, t: 26, b: 34 };
    function render(stage) {
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, s = "";
      [0, 25, 50, 75, 100].forEach(function (g) {
        var y = pad.t + ih - (g / 100) * ih;
        s += '<line class="gridline" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>';
        s += '<text class="lab-s" x="' + (pad.l - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">' + g + '%</text>';
      });
      var bw = iw / FLINT.length;
      FLINT.forEach(function (d, i) {
        var x = pad.l + i * bw + bw * 0.22, w = bw * 0.56;
        var active = i <= stage;
        if (d.hit !== null && active) {
          var h = (d.hit / 100) * ih;
          s += '<rect x="' + x + '" y="' + (pad.t + ih - h) + '" width="' + w + '" height="' + h + '" rx="2" fill="' +
            (d.hit >= 50 ? C.ok : C.pp) + '" opacity="' + (i === stage ? ".92" : ".3") + '"/>';
          s += '<text class="lab-b" x="' + (x + w / 2) + '" y="' + (pad.t + ih - h - 7) + '" text-anchor="middle" fill="' +
            (d.hit >= 50 ? C.ok : C.pp) + '" opacity="' + (i === stage ? "1" : ".4") + '">' + d.hit + '%</text>';
        } else if (active) {
          s += '<text class="lab-s" x="' + (x + w / 2) + '" y="' + (pad.t + ih - 10) + '" text-anchor="middle">no model</text>';
        }
        s += '<text class="lab-s" x="' + (x + w / 2) + '" y="' + (H - 12) + '" text-anchor="middle" opacity="' + (active ? "1" : ".35") + '">' + (i + 1) + '. ' + d.t + '</text>';
      });
      s += '<text class="lab" x="' + (pad.l - 40) + '" y="' + (pad.t - 10) + '">excavations that found lead pipe</text>';
      s += '<line class="axis" x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '"/>';
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Flint hit rate by stage">' + s + '</svg>';
      var d = FLINT[stage];
      det.innerHTML = "<h4>" + (stage + 1) + ". " + d.t + "</h4>" + d.n + '<span class="who">' + d.who + "</span>";
    }
    var cur = 0;
    seg("#flint-picker", "data-stage", function (v) { cur = +v; render(cur); });
    render(0);
    REDRAW.push(function () { render(cur); });
  })();

  /* ---------------- 04.6 AI Systems Discovery Canvas ---------------- */
  var BLANK = [
    { n: "1. Articulate the mission", q: "What is this organisation actually for?",
      d: "<p>Not the strategy, not the product, not the current business model. The mission, stated so plainly that it survives the rest of the exercise.</p><p><strong>Home insurance:</strong> the mission is not to sell policies. It is to protect people from the financial consequences of damage to their home.</p><p>The step looks trivial and is not. Almost every organisation states its mission in terms of what it currently does, which smuggles the existing system back in before step two has a chance to remove it.</p>" },
    { n: "2. Reduce to the fewest decisions", q: "Assuming AI is unimaginably powerful, what is the minimum set of decisions needed to achieve the mission?",
      d: "<p>This is the blank slate. Throw away the departments, the processes, and the roles. Assume prediction is free and perfect. What decisions remain?</p><p><strong>Home insurance reduces to three:</strong> who to market to, who to underwrite and at what price, and how to handle claims. Everything else in a modern insurer is scaffolding around the uncertainty those three decisions used to carry.</p><p>Do this honestly and the list is always shorter than expected, which is the point. Every decision you removed was something the old system needed only because prediction was expensive.</p>" },
    { n: "3. Specify prediction and judgment for each",
      q: "For each surviving decision, what is the prediction and what is the judgment?",
      d: "<p>Only now do you ask what a model would do. Naming the judgment separately is what stops you from building a model nobody can act on.</p><p><strong>Where the insurance example lands:</strong> once prediction is cheap and continuous rather than annual, the most valuable thing an insurer can predict is not who will file a claim. It is which pipe is about to fail.</p><p>And that changes the business. The winning insurer stops merely transferring risk and starts reducing it: monitoring the home, spotting the leak, and fixing it before there is a claim at all. That is a system solution, and you cannot reach it from inside the existing underwriting department.</p>" }
  ];
  (function blank() {
    var host = $("#viz-blank"), det = $("#blank-detail"); if (!host) return;
    host.innerHTML = '<div class="canvasgrid cg3">' + BLANK.map(function (b, i) {
      return '<button class="cell bl-cell" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' +
        '<span class="cn">' + b.n + '</span><span class="cq">' + b.q + '</span></button>';
    }).join("") + "</div>";
    function pick(i) {
      $$(".bl-cell", host).forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
      det.innerHTML = "<h4>" + BLANK[i].n + "</h4>" + BLANK[i].d +
        '<span class="who">AI Systems Discovery Canvas, Power and Prediction ch. 17</span>';
    }
    host.addEventListener("click", function (e) { var b = e.target.closest(".bl-cell"); if (b) pick(+b.dataset.i); });
    pick(0);
  })();

  /* ---------------- 05.1 Research arc ---------------- */
  var THEMES = {
    knowledge: { n: "Knowledge transfer", ck: "pm", row: 0 },
    geography: { n: "Geography & mobility", ck: "ok", row: 1 },
    entre: { n: "Entrepreneurship & finance", ck: "brass", row: 2 },
    ai: { n: "Economics of AI", ck: "pp", row: 3 }
  };
  var PAPERS = [
    { y: 2001, th: "knowledge", t: "University-to-industry knowledge transfer: literature review and unanswered questions", v: "Int. J. Management Reviews 3(4)", n: "Framed the research agenda for the whole field." },
    { y: 2002, th: "knowledge", t: "Putting Patents in Context: Exploring Knowledge Transfer from MIT", v: "Management Science 48(1), with Rebecca Henderson", n: "The landmark result: patents capture only about 6 to 10% of knowledge transferred out of a university. Most of it moves through people." },
    { y: 2003, th: "geography", t: "The Anchor Tenant Hypothesis", v: "Int. J. Industrial Organization 21(9), with Iain Cockburn", n: "Introduced 'anchor tenant' to the regional innovation literature: a large, local, R&D-intensive firm makes a whole cluster more productive." },
    { y: 2006, th: "knowledge", t: "Engaging the Inventor: Licensing Strategies for University Inventions", v: "Strategic Management Journal 27(1)", n: "Why licensing deals work better when the inventor stays involved." },
    { y: 2006, th: "geography", t: "Gone But Not Forgotten: Knowledge Flows, Labor Mobility, and Enduring Social Relationships", v: "J. Economic Geography 6(5)", n: "Knowledge keeps flowing along personal ties after the person has physically left." },
    { y: 2008, th: "knowledge", t: "Restructuring Research: Communication Costs and the Democratization of University Innovation", v: "American Economic Review 98(4)", n: "Used Bitnet adoption as a natural experiment: cheaper communication let mid-tier universities collaborate with elite ones." },
    { y: 2008, th: "geography", t: "How Do Spatial and Social Proximity Influence Knowledge Flows?", v: "J. Urban Economics 64", n: "Separates being near someone from knowing someone." },
    { y: 2008, th: "geography", t: "International Labor Mobility and Knowledge Flow Externalities", v: "J. International Business Studies 39", n: "" },
    { y: 2009, th: "knowledge", t: "Have University Knowledge Flows Narrowed? Evidence from Patent Data", v: "Research Policy 38(1)", n: "" },
    { y: 2010, th: "geography", t: "Not Invented Here? Innovation in Company Towns", v: "J. Urban Economics 67(1)", n: "" },
    { y: 2011, th: "geography", t: "Brain Drain or Brain Bank? Skilled Emigration and Poor-Country Innovation", v: "J. Urban Economics 69(1)", n: "Emigration can raise innovation at home, because the diaspora becomes a knowledge channel." },
    { y: 2011, th: "knowledge", t: "Recruiting for Ideas: How Firms Exploit the Prior Inventions of New Hires", v: "Management Science 57(1), with Jasjit Singh", n: "Firms hire inventors partly to acquire access to what they already invented elsewhere." },
    { y: 2014, th: "entre", t: "Some Simple Economics of Crowdfunding", v: "Innovation Policy and the Economy 14", n: "His second most cited work. Applied transaction-cost and market-design economics to explain crowdfunding, and set the field's agenda." },
    { y: 2014, th: "geography", t: "Why Are Some Regions More Innovative than Others? Firm Size Diversity", v: "J. Urban Economics 81", n: "" },
    { y: 2015, th: "entre", t: "Crowdfunding: Geography, Social Networks, and the Timing of Investment Decisions", v: "J. Economics & Management Strategy 24(2)", n: "" },
    { y: 2015, th: "entre", t: "Deals Not Done: Sources of Failure in the Market for Ideas", v: "Strategic Management Journal 36(7)", n: "" },
    { y: 2016, th: "knowledge", t: "Understanding the Changing Structure of Scientific Inquiry", v: "AEJ: Applied Economics 8(1)", n: "" },
    { y: 2016, th: "ai", t: "The Simple Economics of Machine Intelligence", v: "Harvard Business Review", n: "The pivot. Six pages in HBR that became a book, then two more, then a subfield." },
    { y: 2017, th: "geography", t: "Roads and Innovation", v: "Review of Economics and Statistics", n: "" },
    { y: 2017, th: "knowledge", t: "How Stars Matter: Recruiting and Peer Effects in Evolutionary Biology", v: "Research Policy", n: "" },
    { y: 2018, th: "ai", t: "Prediction Machines (book)", v: "Harvard Business Review Press", n: "His single most cited work." },
    { y: 2018, th: "ai", t: "Human Judgment and AI Pricing", v: "AEA Papers and Proceedings 108", n: "" },
    { y: 2018, th: "entre", t: "Slack Time and Innovation", v: "Organization Science 29(6)", n: "" },
    { y: 2019, th: "ai", t: "The Economics of Artificial Intelligence: An Agenda (edited)", v: "Univ. Chicago Press / NBER", n: "The agenda-setting volume for the subfield he was building." },
    { y: 2019, th: "ai", t: "Exploring the Impact of AI: Prediction versus Judgment", v: "Information Economics and Policy 47", n: "The formal model behind the popular argument." },
    { y: 2019, th: "ai", t: "Prediction, Judgment, and Complexity", v: "Chapter, The Economics of AI", n: "" },
    { y: 2019, th: "ai", t: "AI: The Ambiguous Labor Market Impact of Automating Prediction", v: "J. Economic Perspectives 33(2)", n: "The careful version of the jobs argument, and notably more hedged than the trade books." },
    { y: 2020, th: "entre", t: "Tax Credits and Small Firm R&D Spending", v: "AEJ: Economic Policy 12(2)", n: "" },
    { y: 2021, th: "entre", t: "Enabling Entrepreneurial Choice", v: "Management Science 67(9), with Gans and Scott Stern", n: "The theoretical root of what later became the Bayesian Entrepreneurship volume." },
    { y: 2022, th: "ai", t: "Power and Prediction (book)", v: "Harvard Business Review Press", n: "The sequel, arguing that the bottleneck is system redesign rather than technology." },
    { y: 2025, th: "ai", t: "Genius on Demand: The Value of Transformative AI", v: "NBER Working Paper 34316", n: "Distinguishes routine knowledge workers from 'genius' workers who generate novel insight, and asks what happens when genius itself is on tap. Routine workers face displacement if AI efficiency matches human genius." }
  ];
  (function arc() {
    var host = $("#viz-arc"), det = $("#arc-detail"); if (!host) return;
    var filter = "all";
    var W = 760, H = 250, pad = { l: 40, r: 24, t: 24, b: 40 };
    var Y0 = 2000, Y1 = 2026;
    function render() {
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, s = "";
      var X = function (y) { return pad.l + ((y - Y0) / (Y1 - Y0)) * iw; };
      var ROWY = function (r) { return pad.t + 16 + r * ((ih - 30) / 3); };
      Object.keys(THEMES).forEach(function (k) {
        var th = THEMES[k], on = (filter === "all" || filter === k);
        s += '<line x1="' + pad.l + '" y1="' + ROWY(th.row) + '" x2="' + (W - pad.r) + '" y2="' + ROWY(th.row) +
          '" stroke="' + C.rule + '" stroke-width="1" opacity="' + (on ? "1" : ".4") + '"/>';
        s += '<text class="lab-s" x="' + pad.l + '" y="' + (ROWY(th.row) - 8) + '" fill="' + C[th.ck] + '" opacity="' + (on ? "1" : ".3") + '">' + th.n.toUpperCase() + '</text>';
      });
      for (var y = 2000; y <= 2025; y += 5) {
        s += '<line class="gridline" x1="' + X(y) + '" y1="' + pad.t + '" x2="' + X(y) + '" y2="' + (H - pad.b + 6) + '"/>';
        s += '<text class="lab-s" x="' + X(y) + '" y="' + (H - 20) + '" text-anchor="middle">' + y + '</text>';
      }
      // jitter same-year same-theme dots
      var seen = {};
      PAPERS.forEach(function (p, i) {
        var key = p.y + p.th; seen[key] = (seen[key] || 0) + 1;
        var off = (seen[key] - 1) * 9;
        var th = THEMES[p.th], on = (filter === "all" || filter === p.th);
        s += '<circle class="hot arc-pt" data-i="' + i + '" cx="' + (X(p.y) + off) + '" cy="' + ROWY(th.row) +
          '" r="6.5" fill="' + C[th.ck] + '" opacity="' + (on ? ".85" : ".13") + '" stroke="' + C.raised + '" stroke-width="1.5"/>';
      });
      s += '<line x1="' + X(2016) + '" y1="' + (pad.t - 6) + '" x2="' + X(2016) + '" y2="' + (H - pad.b + 6) +
        '" stroke="' + C.pp + '" stroke-width="1.5" stroke-dasharray="4 4" opacity=".6"/>';
      s += '<text class="lab-s" x="' + (X(2016) + 6) + '" y="' + (pad.t - 8) + '" fill="' + C.pp + '">the pivot to AI</text>';
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Research papers by year and theme">' + s + '</svg>';
    }
    function pick(i) {
      var p = PAPERS[i];
      det.innerHTML = "<h4>" + esc(p.t) + "</h4><p><strong>" + p.y + "</strong> · " + esc(p.v) + "</p>" +
        (p.n ? "<p>" + p.n + "</p>" : "") + '<span class="who">' + THEMES[p.th].n + "</span>";
    }
    host.addEventListener("mouseover", function (e) { var c = e.target.closest(".arc-pt"); if (c) pick(+c.dataset.i); });
    host.addEventListener("click", function (e) { var c = e.target.closest(".arc-pt"); if (c) pick(+c.dataset.i); });
    seg("#arc-picker", "data-theme", function (v) { filter = v; render(); });
    render();
    REDRAW.push(render);
  })();

  /* ---------------- 06.1 CDL equity value ---------------- */
  var CDLV = [
    { y: "2012 goal", v: 0.05, n: "The founding target, stated on CDL's own About page: generate $50 million in equity value from graduates within five years. Shown here for scale, and it is almost invisible against what followed." },
    { y: "2023", v: 28, n: "CAD $28 billion reported cumulative equity value across all CDL alumni." },
    { y: "interim", v: 51, n: "CAD $51 billion, an interim figure between the 2023 and 2024/25 reports." },
    { y: "2024/25", v: 56, n: "CAD $56 billion, from the 2024/25 graduate companies page. 630+ companies, 13 locations. This is the figure the source dossier used." },
    { y: "2025/26", v: 64, n: "Over CAD $64 billion, from the 2025/26 graduate companies page, verified during this build. 670+ companies hosted, 240+ graduating, 17 locations, 24 streams.", cur: true }
  ];
  (function cdl() {
    var host = $("#viz-cdl"), det = $("#cdl-detail"); if (!host) return;
    var cur = 4;
    function draw() {
    var W = 760, H = 240, pad = { t: 18, r: 14, b: 36, l: 50 }, MAX = 70;
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / CDLV.length, s = "";
    [0, 20, 40, 60].forEach(function (g) {
      var y = pad.t + ih - (g / MAX) * ih;
      s += '<line class="gridline" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>';
      s += '<text class="lab-s" x="' + (pad.l - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">$' + g + 'B</text>';
    });
    CDLV.forEach(function (d, i) {
      var h = Math.max(1.5, (d.v / MAX) * ih), x = pad.l + i * bw + bw * 0.2, w = bw * 0.6;
      s += '<rect class="hot cdl-bar" data-i="' + i + '" x="' + x + '" y="' + (pad.t + ih - h) + '" width="' + w +
        '" height="' + h + '" rx="2" fill="' + (d.cur ? C.ok : C.pm) + '" opacity="' + (d.cur ? ".9" : ".6") + '"/>';
      s += '<text class="lab-s" x="' + (x + w / 2) + '" y="' + (H - 12) + '" text-anchor="middle">' + d.y + '</text>';
    });
    s += '<line class="axis" x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '"/>';
    s += '<text class="lab" x="' + (pad.l - 38) + '" y="' + (pad.t - 4) + '">CAD equity value, cumulative, as reported</text>';
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="CDL reported equity value">' + s + '</svg>';
    pick(cur);
    }
    function pick(i) {
      cur = i;
      var d = CDLV[i];
      $$(".cdl-bar", host).forEach(function (r, j) { r.setAttribute("opacity", j === i ? "1" : ".45"); });
      det.innerHTML = "<h4>" + d.y + "</h4><p><span class=\"num\" style=\"font-size:1.25rem;font-weight:600;color:var(--accent)\">CAD $" +
        (d.v < 1 ? (d.v * 1000) + "M" : d.v + "B") + "</span></p><p>" + d.n + "</p>" +
        '<span class="who">Self-reported by CDL, cumulative across all alumni</span>';
    }
    host.addEventListener("mouseover", function (e) { var r = e.target.closest(".cdl-bar"); if (r) pick(+r.dataset.i); });
    host.addEventListener("click", function (e) { var r = e.target.closest(".cdl-bar"); if (r) pick(+r.dataset.i); });
    draw();
    REDRAW.push(draw);
  })();

  /* ---------------- Theme control ---------------- */
  (function theme() {
    var ctl = $(".themectl"); if (!ctl) return;
    var KEY = "aa-theme", root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function stored() {
      try { var v = localStorage.getItem(KEY); return (v === "dark" || v === "light") ? v : "system"; }
      catch (e) { return "system"; }
    }
    function apply(mode, persist) {
      if (mode === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", mode);
      if (persist) {
        try { mode === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode); }
        catch (e) { /* private window, or site data blocked: the choice just will not persist */ }
      }
      $$("button", ctl).forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-theme-set") === mode ? "true" : "false");
      });
      // Charts bake colours into markup, so they have to be rebuilt from the new palette.
      requestAnimationFrame(redrawAll);
    }
    ctl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-theme-set]"); if (!b) return;
      apply(b.getAttribute("data-theme-set"), true);
    });
    // Follow the OS while in Auto.
    if (mq) {
      var onSys = function () { if (stored() === "system") requestAnimationFrame(redrawAll); };
      if (mq.addEventListener) mq.addEventListener("change", onSys);
      else if (mq.addListener) mq.addListener(onSys);
    }
    apply(stored(), false);
  })();

  routeFromHash();
})();
