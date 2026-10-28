# TEST_RESULTS — Function Plotter BD (2026-10-28, 13:00 slot)

## Unit tests — 35/35 passed (`node tests/logic.test.js`)

Parser/math core (`js/logic.js`), all hand-computed expectations:

- Arithmetic: `x^2` at 3 = 9; `2+3*4` = 14; right-associative `2^3^2` = 512.
- Implicit multiplication: `2x` at 3 = 6; `2(x+1)` at 3 = 8; `x(x+1)` at 3 = 12;
  `2sin(x)` at pi/2 = 2.
- Unary minus follows school convention: `-x^2` at 3 = -9; `-x+1` at 3 = -2;
  `2^-x` at 2 = 0.25; `(-x)^2` at 3 = 9 (verified separately on the CLI).
- Functions/constants: `sin(pi/2)` = 1; `log(100)` = 2 (base 10); `ln(e)` = 1;
  `sqrt(16)` = 4; `abs(-5)` = 5; `exp(0)` = 1; `x^3-3x` at 2 = 2.
- Non-finite gaps: `1/x` at 0 is non-finite; `sqrt(-1)` is NaN.
- Rejections: empty, trailing operator, unbalanced paren, unknown name,
  bad number, double operator — all throw.
- Analysis: roots of `x^2-4` are exactly -2 and 2; tangent root of `x^2`
  found at 0; `x^2+1` has no roots; min/max of `x^2` on [-2,2] = 0/4;
  min/max of `x^2-4` on [-10,10] = -4/96.
- Value table: step 1 over [-2,2] gives 5 rows; row x=2 gives 4.

## Headless-Chrome smoke — 30/30 passed (`node tests/smoke.js`, raw CDP)

- Title/heading, 4 function inputs, default `f1 = x^2-4`, canvas 900x540
  with real drawn pixels.
- Analysis panel: min -4, max 96, roots -2.00 and 2.00 for `x^2-4`.
- Value table: 10+ rows; x=2 row shows f1 = 0.00.
- Trace slider at x=2: f1 = 0.00, f2 = sin(2) = 0.91.
- Invalid formula `2+` shows an inline error and clears when fixed.
- Preset loads `cos(x)` into f1; zoom-in narrows the view to -5..5;
  reset restores -10..10; an inverted view (5..5) is rejected with an error.
- Bangla toggle renders a Bengali tagline and Bengali digits in analysis;
  toggling back restores English.
- Import: a valid export is accepted and applied (`x^3`); an invalid export
  is rejected with data intact; typed-DELETE erase restores defaults.
- 390px mobile viewport: no horizontal overflow, canvas present.
- Zero console/page errors across the whole run.

## Repairs made during testing (2 real app bugs, 0 invented results)

1. **Unary-minus precedence**: `-x^2` first parsed as `(-x)^2` (= 9).
   Fixed in the shunting-yard so unary minus binds looser than `^` but
   tighter than `+ - * /`: `-x^2` = -9, `-x+1` = -2, `2^-x` still works.
2. **Lazy structural validation**: `compile('2+')` succeeded and only threw
   when the plot sampled it, so no inline error appeared and the plot threw
   an uncaught error. `compile()` now probe-evaluates once at x=0, so
   structural errors surface as inline messages and import validation
   rejects malformed formulas.

## Publishing notes

- Sources are pure ASCII (Bengali in `js/i18n.js` as `\uXXXX` escapes;
  the `বাংলা` button label in `index.html` as numeric entities) so the
  push transport cannot corrupt Bengali text.
- `window.__fp` (`getState`/`exportData`/`importData`) is a test hook used
  by the smoke test to exercise import without a file dialog.
