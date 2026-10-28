// Function Plotter BD \u2014 pure math core (no DOM). Node-testable.
// Safe expression parser: tokenizer + shunting-yard + RPN evaluator.
// No eval(), no Function(). Supported: x, pi, e, + - * / % ^, parentheses,
// implicit multiplication (2x, 2(x+1), x(x+1)), and functions:
// sin cos tan asin acos atan sinh cosh tanh sqrt cbrt log ln exp abs floor ceil.
// log = base-10 (school convention in Bangladesh), ln = natural log.
(function (root) {
  'use strict';
  var FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt, log: function (v) { return Math.log10(v); },
    ln: Math.log, exp: Math.exp, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil
  };
  var CONSTS = { pi: Math.PI, e: Math.E };
  var PRECEDENCE = { '+': 2, '-': 2, '*': 3, '/': 3, '%': 3, '^': 4 };
  var RIGHT_ASSOC = { '^': true };

  function fail(msg) { throw new Error(msg); }

  function tokenize(expr) {
    var s = expr.replace(/\s+/g, '').toLowerCase();
    if (!s) fail('Empty expression');
    if (s.length > 200) fail('Expression too long (max 200 chars)');
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var ch = s[i];
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        var j = i, dots = 0;
        while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) {
          if (s[j] === '.') dots++;
          j++;
        }
        if (dots > 1) fail('Bad number');
        var num = parseFloat(s.slice(i, j));
        if (!isFinite(num)) fail('Bad number');
        tokens.push({ t: 'num', v: num });
        i = j;
      } else if (ch >= 'a' && ch <= 'z') {
        var k = i;
        while (k < s.length && s[k] >= 'a' && s[k] <= 'z') k++;
        var name = s.slice(i, k);
        if (name === 'x') tokens.push({ t: 'x' });
        else if (Object.prototype.hasOwnProperty.call(CONSTS, name)) tokens.push({ t: 'num', v: CONSTS[name] });
        else if (Object.prototype.hasOwnProperty.call(FUNCS, name)) tokens.push({ t: 'fn', v: name });
        else fail('Unknown name: ' + name);
        i = k;
      } else if ('+-*/%^(),'.indexOf(ch) !== -1) {
        tokens.push({ t: ch });
        i++;
      } else {
        fail('Unexpected character: ' + ch);
      }
    }
    // Insert implicit multiplication: number/')'/x/const followed by x, fn, '(' or const;
    // ')' followed by number; x followed by '('.
    var out = [];
    for (var n = 0; n < tokens.length; n++) {
      var cur = tokens[n], prev = out[out.length - 1];
      if (prev && (prev.t === 'num' || prev.t === ')' || prev.t === 'x')) {
        if (cur.t === 'x' || cur.t === 'fn' || cur.t === '(' ||
            (cur.t === 'num' && prev.t === ')')) {
          out.push({ t: '*' });
        }
      }
      out.push(cur);
    }
    return out;
  }

  function toRPN(tokens) {
    var output = [], stack = [];
    var prev = null;
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok.t === 'num' || tok.t === 'x') {
        output.push(tok);
      } else if (tok.t === 'fn') {
        stack.push(tok);
      } else if (tok.t === ',') {
        fail('Unexpected comma');
      } else if (tok.t === '(') {
        stack.push(tok);
      } else if (tok.t === ')') {
        var found = false;
        while (stack.length) {
          var top = stack.pop();
          if (top.t === '(') { found = true; break; }
          output.push(top);
        }
        if (!found) fail('Mismatched parentheses');
        if (stack.length && stack[stack.length - 1].t === 'fn') output.push(stack.pop());
      } else if (PRECEDENCE[tok.t] !== undefined) {
        var unary = (tok.t === '-' || tok.t === '+') &&
          (prev === null || prev.t === '(' || prev.t === ',' || PRECEDENCE[prev.t] !== undefined || prev.t === 'fn');
        if (unary) {
          if (tok.t === '-') stack.push({ t: 'neg' });
          // unary '+' is a no-op
        } else {
          while (stack.length) {
            var sTop = stack[stack.length - 1];
            // Unary minus binds tighter than + - * / but LOOSER than ^,
            // so -x^2 = -(x^2) (school convention) and -x+1 = (-x)+1.
            if (sTop.t === 'neg') {
              if (tok.t === '^') break;
              output.push(stack.pop()); continue;
            }
            if (sTop.t === 'fn') { output.push(stack.pop()); continue; }
            if (PRECEDENCE[sTop.t] === undefined) break;
            if (PRECEDENCE[sTop.t] > PRECEDENCE[tok.t] ||
                (PRECEDENCE[sTop.t] === PRECEDENCE[tok.t] && !RIGHT_ASSOC[tok.t])) {
              output.push(stack.pop());
            } else break;
          }
          stack.push(tok);
        }
      } else {
        fail('Unexpected token');
      }
      prev = tok;
    }
    while (stack.length) {
      var rest = stack.pop();
      if (rest.t === '(') fail('Mismatched parentheses');
      output.push(rest);
    }
    if (!output.length) fail('Empty expression');
    return output;
  }

  function evalRPN(rpn, x) {
    var st = [];
    for (var i = 0; i < rpn.length; i++) {
      var tok = rpn[i];
      if (tok.t === 'num') st.push(tok.v);
      else if (tok.t === 'x') st.push(x);
      else if (tok.t === 'neg') {
        if (!st.length) fail('Bad expression');
        st.push(-st.pop());
      } else if (tok.t === 'fn') {
        if (!st.length) fail('Bad expression');
        st.push(FUNCS[tok.v](st.pop()));
      } else if (PRECEDENCE[tok.t] !== undefined) {
        if (st.length < 2) fail('Bad expression');
        var b = st.pop(), a = st.pop(), r;
        if (tok.t === '+') r = a + b;
        else if (tok.t === '-') r = a - b;
        else if (tok.t === '*') r = a * b;
        else if (tok.t === '/') r = a / b;
        else if (tok.t === '%') r = a % b;
        else if (tok.t === '^') r = Math.pow(a, b);
        st.push(r);
      }
    }
    if (st.length !== 1) fail('Bad expression');
    return st[0];
  }

  function compile(expr) {
    var rpn = toRPN(tokenize(expr));
    // Eager structural validation: RPN stack errors (e.g. '2+') only surface
    // at evaluation, so probe once here. Domain issues yield NaN/Infinity,
    // never throw, so a probe throw is always a structural error.
    evalRPN(rpn, 0);
    return function (x) { return evalRPN(rpn, x); };
  }

  function evaluate(expr, x) { return compile(expr)(x); }

  function samplePoints(fn, xmin, xmax, count) {
    var pts = [], step = (xmax - xmin) / (count - 1);
    for (var i = 0; i < count; i++) {
      var x = xmin + step * i;
      pts.push({ x: x, y: fn(x) });
    }
    return pts;
  }

  function minMax(fn, xmin, xmax) {
    var pts = samplePoints(fn, xmin, xmax, 2001);
    var mn = Infinity, mx = -Infinity, found = false;
    for (var i = 0; i < pts.length; i++) {
      var y = pts[i].y;
      if (isFinite(y)) { found = true; if (y < mn) mn = y; if (y > mx) mx = y; }
    }
    return found ? { min: mn, max: mx } : null;
  }

  function findRoots(fn, xmin, xmax) {
    var pts = samplePoints(fn, xmin, xmax, 2001);
    var roots = [];
    function add(r) {
      for (var i = 0; i < roots.length; i++) {
        if (Math.abs(roots[i] - r) < 1e-4) return;
      }
      roots.push(r);
    }
    function bisect(a, b, fa) {
      for (var it = 0; it < 60; it++) {
        var m = (a + b) / 2, fm = fn(m);
        if (!isFinite(fm)) return null;
        if (Math.abs(fm) < 1e-12 || (b - a) < 1e-10) return m;
        if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
      }
      return (a + b) / 2;
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var p = pts[i], q = pts[i + 1];
      if (!isFinite(p.y) || !isFinite(q.y)) continue;
      if (p.y === 0) add(p.x);
      else if ((p.y < 0) !== (q.y < 0)) {
        var r = bisect(p.x, q.x, p.y);
        if (r !== null && isFinite(r)) add(r);
      }
    }
    // Tangent roots (touch without sign change): sampled near-zero minima of |f|.
    for (var j = 1; j < pts.length - 1; j++) {
      var a1 = Math.abs(pts[j - 1].y), a2 = Math.abs(pts[j].y), a3 = Math.abs(pts[j + 1].y);
      if (isFinite(a2) && a2 <= a1 && a2 <= a3 && a2 < 1e-6) add(pts[j].x);
    }
    roots.sort(function (a, b) { return a - b; });
    return roots.slice(0, 20);
  }

  function valueTable(fn, xmin, xmax) {
    var span = xmax - xmin, step = 1;
    while (span / step > 20) step *= 2;
    var rows = [], start = Math.ceil(xmin / step) * step;
    for (var x = start; x <= xmax + 1e-9; x += step) {
      rows.push({ x: Math.round(x * 1e9) / 1e9, y: fn(x) });
    }
    return rows;
  }

  var api = {
    tokenize: tokenize, toRPN: toRPN, evalRPN: evalRPN,
    compile: compile, evaluate: evaluate, samplePoints: samplePoints,
    minMax: minMax, findRoots: findRoots, valueTable: valueTable,
    FUNCTIONS: Object.keys(FUNCS)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FPLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
