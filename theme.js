/* Shared theme machinery for the dossier and the game.
 *
 * A classic script, deliberately: it must run before the page's own script, and it owns the single
 * `aa-theme` preference so a reader who picks Dark on the dossier gets a dark game. The three-line
 * no-flash snippet stays inline in each page's <head>, because it has to run before first paint and
 * a module would be deferred. That duplication is intentional; keep the two copies identical.
 *
 * SVG presentation attributes cannot take var(), so charts bake colours into markup and do NOT
 * inherit a theme for free. Anything that draws with a colour must register a redraw here, or it
 * will strand in the old palette when the theme changes.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var C = {};
  var COLOR_MAP = { pm: "--pm", pp: "--pp", brass: "--flag", ok: "--ok", ink: "--ink",
    soft: "--ink-soft", faint: "--ink-faint", rule: "--rule", ruleS: "--rule-strong",
    sunk: "--paper-sunk", raised: "--paper-raised" };
  var FALLBACK = { pm: "#1F5F7A", pp: "#A8451F", brass: "#7F631B", ok: "#3F6B45", ink: "#17171A",
    soft: "#55555F", faint: "#6A6A75", rule: "#E2DED4", ruleS: "#CFC9BC", sunk: "#F0EDE5", raised: "#FFFDF8" };

  /* Mutates C in place. Callers hold the SAME object, so a copy would strand them on old colours. */
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    Object.keys(COLOR_MAP).forEach(function (k) {
      C[k] = (cs.getPropertyValue(COLOR_MAP[k]) || "").trim() || FALLBACK[k];
    });
  }
  readColors();

  var REDRAW = [];
  function onRedraw(fn) { REDRAW.push(fn); }
  function redrawAll() { readColors(); REDRAW.forEach(function (f) { try { f(); } catch (e) {} }); }

  function seg(rootSel, attr, onPick) {
    var root = $(rootSel); if (!root) return;
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $$("button", root).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      onPick(b.getAttribute(attr));
    });
  }

  var KEY = "aa-theme";
  function stored() {
    try { var v = localStorage.getItem(KEY); return (v === "dark" || v === "light") ? v : "system"; }
    catch (e) { return "system"; }
  }
  function control() {
    var ctl = $(".themectl"); if (!ctl) return;
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
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
      requestAnimationFrame(redrawAll);
    }
    ctl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-theme-set]"); if (!b) return;
      apply(b.getAttribute("data-theme-set"), true);
    });
    if (mq) {
      var onSys = function () { if (stored() === "system") requestAnimationFrame(redrawAll); };
      if (mq.addEventListener) mq.addEventListener("change", onSys);
      else if (mq.addListener) mq.addListener(onSys);
    }
    apply(stored(), false);
  }

  window.AATheme = { C: C, readColors: readColors, onRedraw: onRedraw, redrawAll: redrawAll,
                     seg: seg, stored: stored, control: control, KEY: KEY };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", control);
  else control();
})();
