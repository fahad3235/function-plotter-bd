// Node unit tests for js/logic.js — exits non-zero on any failure.
const L = require('../js/logic.js');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('ok - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (extra !== undefined ? ' :: ' + extra : '')); }
}
function close(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-9); }
function throws(fn) { try { fn(); return false; } catch (e) { return true; } }

check('x^2 at 3 = 9', L.evaluate('x^2', 3) === 9);
check('2x implicit mult at 3 = 6', L.evaluate('2x', 3) === 6);
check('2(x+1) at 3 = 8', L.evaluate('2(x+1)', 3) === 8);
check('x(x+1) at 3 = 12', L.evaluate('x(x+1)', 3) === 12);
check('precedence 2+3*4 = 14', L.evaluate('2+3*4', 0) === 14);
check('right-assoc 2^3^2 = 512', L.evaluate('2^3^2', 0) === 512);
check('unary -x^2 at 3 = -9', L.evaluate('-x^2', 3) === -9);
check('-(x+1) at 3 = -4', L.evaluate('-(x+1)', 3) === -4);
check('sin(pi/2) = 1', close(L.evaluate('sin(pi/2)', 0), 1));
check('cos(0) = 1', L.evaluate('cos(0)', 0) === 1);
check('log(100) = 2 (base 10)', close(L.evaluate('log(100)', 0), 2));
check('ln(e) = 1', close(L.evaluate('ln(e)', 0), 1));
check('sqrt(16) = 4', L.evaluate('sqrt(16)', 0) === 4);
check('abs(-5) = 5', L.evaluate('abs(-5)', 0) === 5);
check('exp(0) = 1', L.evaluate('exp(0)', 0) === 1);
check('x^3-3x at 2 = 2', L.evaluate('x^3-3*x', 2) === 2);
check('2sin(x) at pi/2 = 2', close(L.evaluate('2sin(x)', Math.PI / 2), 2));
check('pi constant', close(L.evaluate('pi', 0), Math.PI));
check('1/x at 0 is non-finite (gap)', !isFinite(L.evaluate('1/x', 0)));
check('sqrt(-1) is NaN', Number.isNaN(L.evaluate('sqrt(-1)', 0)));
check('empty throws', throws(() => L.evaluate('', 0)));
check('trailing operator throws', throws(() => L.evaluate('2+', 0)));
check('unbalanced paren throws', throws(() => L.evaluate('sin(', 0)));
check('unknown name throws', throws(() => L.evaluate('foo(x)', 0)));
check('bad number throws', throws(() => L.evaluate('1..2', 0)));
check('double operator throws', throws(() => L.evaluate('x^^2', 0)));
check('roots of x^2-4 are -2 and 2', (() => {
  const r = L.findRoots(L.compile('x^2-4'), -10, 10);
  return r.length === 2 && close(r[0], -2, 1e-6) && close(r[1], 2, 1e-6);
})());
check('tangent root of x^2 found at 0', (() => {
  const r = L.findRoots(L.compile('x^2'), -10, 10);
  return r.length === 1 && close(r[0], 0, 1e-3);
})());
check('no roots for x^2+1', L.findRoots(L.compile('x^2+1'), -10, 10).length === 0);
check('min/max of x^2 on [-2,2] = 0/4', (() => {
  const mm = L.minMax(L.compile('x^2'), -2, 2);
  return mm && close(mm.min, 0, 1e-6) && close(mm.max, 4, 1e-3);
})());
check('min/max of x^2-4 on [-10,10] = -4/96', (() => {
  const mm = L.minMax(L.compile('x^2-4'), -10, 10);
  return mm && close(mm.min, -4, 1e-6) && close(mm.max, 96, 0.05);
})());
check('samplePoints count', L.samplePoints(L.compile('x'), -1, 1, 11).length === 11);
check('valueTable step 1 over [-2,2] has 5 rows', L.valueTable(L.compile('x^2'), -2, 2).length === 5);
check('valueTable x^2 row at x=2 is 4', L.valueTable(L.compile('x^2'), -2, 2).find(r => r.x === 2).y === 4);
check('FUNCTIONS lists sin and log', L.FUNCTIONS.includes('sin') && L.FUNCTIONS.includes('log'));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
