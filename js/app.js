// Function Plotter BD \u2014 UI wiring (DOM). Depends on FPLogic + FPStrings.
(function () {
  'use strict';
  var KEY = 'function-plotter-bd-v1';
  var COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706'];
  var DEFAULTS = {
    funcs: [
      { expr: 'x^2-4', on: true },
      { expr: 'sin(x)', on: true },
      { expr: '', on: false },
      { expr: '', on: false }
    ],
    view: { xmin: -10, xmax: 10 },
    lang: 'en'
  };

  function $(id) { return document.getElementById(id); }
  function S() { return window.FPStrings[state.lang]; }
  function num(n) {
    if (n === undefined || n === null || !isFinite(n)) return '--';
    var v = Math.abs(n) < 0.0000005 ? 0 : n;
    var s = v.toFixed(2);
    if (s === '-0.00') s = '0.00';
    return state.lang === 'bn' ? window.FPtoBnDigits(s) : s;
  }
  function numRaw(n) {
    if (!isFinite(n)) return '--';
    var v = Math.abs(n) < 0.0000005 ? 0 : n;
    var s = v.toFixed(2);
    return s === '-0.00' ? '0.00' : s;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      var d = JSON.parse(raw);
      var v = validateImport(d);
      return v || clone(DEFAULTS);
    } catch (e) { return clone(DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(exportData())); } catch (e) { /* private mode */ }
  }
  function exportData() {
    return { app: 'function-plotter-bd', version: 1, funcs: state.funcs, view: state.view, lang: state.lang };
  }
  function validateImport(d) {
    if (!d || d.app !== 'function-plotter-bd' || d.version !== 1) return null;
    if (!Array.isArray(d.funcs) || d.funcs.length !== 4) return null;
    for (var i = 0; i < 4; i++) {
      var f = d.funcs[i];
      if (!f || typeof f.expr !== 'string' || f.expr.length > 200 || typeof f.on !== 'boolean') return null;
      if (f.expr) { try { window.FPLogic.compile(f.expr); } catch (e) { return null; } }
    }
    if (!d.view || !isFinite(d.view.xmin) || !isFinite(d.view.xmax)) return null;
    if (!(d.view.xmin < d.view.xmax) || (d.view.xmax - d.view.xmin) > 1000000) return null;
    if (d.lang !== 'en' && d.lang !== 'bn') return null;
    return { funcs: clone(d.funcs), view: { xmin: d.view.xmin, xmax: d.view.xmax }, lang: d.lang };
  }

  var state = load();
  var compiled = []; // per slot: fn or null, plus error string
  var traceFrac = 0.6; // default trace at x = xmin + 0.6 * span (= 2 on -10..10)

  function compileAll() {
    compiled = state.funcs.map(function (f) {
      if (!f.on) return { fn: null, err: '' };
      if (!f.expr.trim()) return { fn: null, err: S().errEmpty };
      try { return { fn: window.FPLogic.compile(f.expr), err: '' }; }
      catch (e) { return { fn: null, err: e.message }; }
    });
  }

  function applyLang() {
    var s = S();
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (s[k] !== undefined) el.textContent = s[k];
    });
    document.title = state.lang === 'bn' ? '\u09ab\u09be\u0982\u09b6\u09a8 \u09aa\u09cd\u09b2\u099f\u09be\u09b0 BD' : 'Function Plotter BD';
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
  }

  function niceStep(span, target) {
    var raw = span / target;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var cands = [1, 2, 5, 10];
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] * mag >= raw) return cands[i] * mag;
    }
    return 10 * mag;
  }

  function drawPlot() {
    var cv = $('plot'), ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var xmin = state.view.xmin, xmax = state.view.xmax;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    var curves = [];
    compiled.forEach(function (c, i) {
      if (!c.fn) return;
      var pts = window.FPLogic.samplePoints(c.fn, xmin, xmax, 901);
      curves.push({ pts: pts, color: COLORS[i] });
    });
    var ymin = Infinity, ymax = -Infinity;
    curves.forEach(function (cr) {
      cr.pts.forEach(function (p) {
        if (isFinite(p.y)) { if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y; }
      });
    });
    if (!isFinite(ymin)) {
      ctx.fillStyle = '#475569';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(S().noValues, W / 2, H / 2);
      ctx.fillText(S().noFunction, W / 2, H / 2 + 30);
      return { ymin: -10, ymax: 10 };
    }
    var pad = Math.max((ymax - ymin) * 0.1, 0.5);
    ymin -= pad; ymax += pad;
    var X = function (x) { return (x - xmin) / (xmax - xmin) * W; };
    var Y = function (y) { return H - (y - ymin) / (ymax - ymin) * H; };
    // grid
    var xStep = niceStep(xmax - xmin, 12), yStep = niceStep(ymax - ymin, 9);
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    for (var gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax + 1e-9; gx += xStep) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText(numRaw(Math.round(gx * 1e9) / 1e9), X(gx), Y(0) > H - 14 ? H - 4 : (Y(0) < 14 ? 14 : Y(0) + 14));
    }
    ctx.textAlign = 'right';
    for (var gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax + 1e-9; gy += yStep) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(W, Y(gy)); ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText(numRaw(Math.round(gy * 1e9) / 1e9), X(0) < 44 ? 44 : X(0) - 4, Y(gy) - 2);
    }
    // axes
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    if (ymin < 0 && ymax > 0) { ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); }
    if (xmin < 0 && xmax > 0) { ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke(); }
    ctx.lineWidth = 1;
    // curves
    curves.forEach(function (cr) {
      ctx.strokeStyle = cr.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      var pen = false;
      cr.pts.forEach(function (p) {
        if (!isFinite(p.y) || p.y < ymin - (ymax - ymin) || p.y > ymax + (ymax - ymin)) { pen = false; return; }
        if (!pen) { ctx.moveTo(X(p.x), Y(p.y)); pen = true; }
        else ctx.lineTo(X(p.x), Y(p.y));
      });
      ctx.stroke();
      ctx.lineWidth = 1;
    });
    // trace
    var tx = xmin + traceFrac * (xmax - xmin);
    ctx.strokeStyle = '#0f172a';
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(X(tx), 0); ctx.lineTo(X(tx), H); ctx.stroke();
    ctx.setLineDash([]);
    curves.forEach(function (cr) {
      var y = cr.pts.reduce(function (best, p) {
        return Math.abs(p.x - tx) < Math.abs(best.x - tx) ? p : best;
      }).y;
      if (!isFinite(y)) return;
      ctx.fillStyle = cr.color;
      ctx.beginPath(); ctx.arc(X(tx), Y(y), 5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(X(tx), Y(y), 2, 0, 2 * Math.PI); ctx.fill();
    });
    return { ymin: ymin, ymax: ymax };
  }

  function renderFnRows() {
    var wrap = $('fnRows');
    wrap.innerHTML = '';
    state.funcs.forEach(function (f, i) {
      var row = document.createElement('div');
      row.className = 'fn-row';
      row.innerHTML =
        '<span class="dot" style="background:' + COLORS[i] + '"></span>' +
        '<input class="fn-input" id="fn-expr-' + i + '" type="text" value="" placeholder="x^2-4" aria-label="Function ' + (i + 1) + '">' +
        '<label class="chk"><input type="checkbox" id="fn-on-' + i + '"> <span data-i18n="on">' + S().on + '</span></label>' +
        '<span class="fn-err" id="fn-err-' + i + '"></span>';
      wrap.appendChild(row);
      var inp = $('fn-expr-' + i);
      inp.value = f.expr;
      inp.addEventListener('input', function () {
        state.funcs[i].expr = inp.value;
        compileAll(); renderErrors(); drawPlot(); renderAnalysis(); renderTable(); renderTrace(); save();
      });
      var chk = $('fn-on-' + i);
      chk.checked = f.on;
      chk.addEventListener('change', function () {
        state.funcs[i].on = chk.checked;
        compileAll(); renderErrors(); drawPlot(); renderAnalysis(); renderTable(); renderTrace(); save();
      });
    });
    renderErrors();
  }
  function renderErrors() {
    compiled.forEach(function (c, i) {
      var el = $('fn-err-' + i);
      if (el) el.textContent = c.err || '';
    });
  }
  function renderTrace() {
    var tx = state.view.xmin + traceFrac * (state.view.xmax - state.view.xmin);
    $('traceX').textContent = 'x = ' + num(tx);
    var html = '';
    compiled.forEach(function (c, i) {
      if (!c.fn) return;
      html += '<div class="trace-line"><span class="dot" style="background:' + COLORS[i] + '"></span>' +
        'f' + (i + 1) + '(' + num(tx) + ') = <b>' + num(c.fn(tx)) + '</b></div>';
    });
    $('traceReadout').innerHTML = html || '<p class="muted">' + S().noFunction + '</p>';
    var sl = $('traceSlider');
    sl.value = Math.round(traceFrac * 400);
  }
  function renderAnalysis() {
    var box = $('analysisBox');
    var first = -1;
    for (var i = 0; i < compiled.length; i++) { if (compiled[i].fn) { first = i; break; } }
    if (first === -1) { box.innerHTML = '<p class="muted">' + S().noFunction + '</p>'; return; }
    var fn = compiled[first].fn;
    var mm = window.FPLogic.minMax(fn, state.view.xmin, state.view.xmax);
    var roots = window.FPLogic.findRoots(fn, state.view.xmin, state.view.xmax);
    if (!mm) { box.innerHTML = '<p class="muted">' + S().noValues + '</p>'; return; }
    box.innerHTML =
      '<p>f' + (first + 1) + '(x) = ' + escapeHtml(state.funcs[first].expr) + '</p>' +
      '<p><span data-i18n="min">' + S().min + '</span>: <b>' + num(mm.min) + '</b> &nbsp; ' +
      '<span data-i18n="max">' + S().max + '</span>: <b>' + num(mm.max) + '</b></p>' +
      '<p><span data-i18n="roots">' + S().roots + '</span>: <b>' +
      (roots.length ? roots.map(num).join(', ') : S().noRoots) + '</b></p>';
  }
  function renderTable() {
    var first = -1;
    for (var i = 0; i < compiled.length; i++) { if (compiled[i].fn) { first = i; break; } }
    var tb = $('valueTable');
    if (first === -1) { tb.innerHTML = '<p class="muted">' + S().noFunction + '</p>'; return; }
    var rows = window.FPLogic.valueTable(compiled[first].fn, state.view.xmin, state.view.xmax);
    var html = '<table><thead><tr><th>x</th>';
    compiled.forEach(function (c, i) {
      if (c.fn) html += '<th>f' + (i + 1) + '(x)</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + num(r.x) + '</td>';
      compiled.forEach(function (c) {
        if (c.fn) html += '<td>' + num(c.fn(r.x)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    tb.innerHTML = html;
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderAll() {
    compileAll();
    applyLang();
    renderFnRows();
    $('viewMin').value = state.view.xmin;
    $('viewMax').value = state.view.xmax;
    drawPlot();
    renderAnalysis();
    renderTable();
    renderTrace();
    save();
  }
  function setView(xmin, xmax) {
    if (!(xmin < xmax)) { $('viewErr').textContent = S().errView; return; }
    if ((xmax - xmin) > 1000000) { $('viewErr').textContent = S().errViewRange; return; }
    $('viewErr').textContent = '';
    state.view = { xmin: xmin, xmax: xmax };
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderAll();
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      renderAll();
    });
    $('applyView').addEventListener('click', function () {
      setView(parseFloat($('viewMin').value), parseFloat($('viewMax').value));
    });
    $('zoomIn').addEventListener('click', function () {
      var c = (state.view.xmin + state.view.xmax) / 2, h = (state.view.xmax - state.view.xmin) / 4;
      setView(c - h, c + h);
    });
    $('zoomOut').addEventListener('click', function () {
      var c = (state.view.xmin + state.view.xmax) / 2, h = (state.view.xmax - state.view.xmin);
      setView(c - h, c + h);
    });
    $('panLeft').addEventListener('click', function () {
      var w = state.view.xmax - state.view.xmin;
      setView(state.view.xmin - w * 0.25, state.view.xmax - w * 0.25);
    });
    $('panRight').addEventListener('click', function () {
      var w = state.view.xmax - state.view.xmin;
      setView(state.view.xmin + w * 0.25, state.view.xmax + w * 0.25);
    });
    $('resetView').addEventListener('click', function () { setView(-10, 10); });
    $('traceSlider').addEventListener('input', function (e) {
      traceFrac = parseInt(e.target.value, 10) / 400;
      drawPlot(); renderTrace();
    });
    $('plot').addEventListener('click', function (e) {
      var r = e.target.getBoundingClientRect();
      traceFrac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      drawPlot(); renderTrace();
    });
    $('loadPreset').addEventListener('click', function () {
      state.funcs[0].expr = $('presetSel').value;
      state.funcs[0].on = true;
      renderAll();
    });
    $('exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'function-plotter-bd.json';
      a.click();
      URL.revokeObjectURL(a.href);
      $('dataMsg').textContent = '';
    });
    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var v = validateImport(JSON.parse(rd.result));
          if (!v) throw new Error('bad');
          state = v; traceFrac = 0.6;
          renderAll();
          $('dataMsg').textContent = S().importOk;
        } catch (err) { $('dataMsg').textContent = S().importBad; }
      };
      rd.readAsText(file);
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value !== 'DELETE') { $('dataMsg').textContent = S().erasePrompt; return; }
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      state = clone(DEFAULTS);
      renderAll();
      $('dataMsg').textContent = S().erased;
    });
    // Test hook (used by tests/smoke.js only): import/export without file dialogs.
    window.__fp = {
      getState: function () { return clone(state); },
      exportData: exportData,
      importData: function (d) {
        var v = validateImport(d);
        if (!v) return false;
        state = v; traceFrac = 0.6; renderAll(); return true;
      }
    };
  });
})();
