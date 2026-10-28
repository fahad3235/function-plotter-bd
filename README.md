# Function Plotter BD

An offline, bilingual (English / Bangla) graphing calculator for students in
Bangladesh. Type a maths function and see its graph instantly — no account,
no server, no upload. Built as a single static page with vanilla JavaScript.

## Problem

Graphing a function by hand takes a whole page of point-plotting, and most
online graphing tools need an account or an internet connection. Function
Plotter BD plots up to four functions at once in the browser, reads values
off the graph with a trace slider, and finds minima, maxima, and roots in the
current view — useful for SSC/HSC algebra and calculus practice.

## Features

1. **Up to 4 functions at once** — each with its own colour, on/off toggle,
   and inline error message for bad formulas.
2. **Safe formula parser** — a hand-written tokenizer + shunting-yard parser
   (no `eval()`). Supports `x`, `pi`, `e`, `+ - * / % ^`, parentheses,
   implicit multiplication (`2x`, `2(x+1)`), and `sin cos tan asin acos atan
   sinh cosh tanh sqrt cbrt log ln exp abs floor ceil`. `log` is base-10
   (the school convention in Bangladesh) and `ln` is the natural log.
   `-x^2` means `-(x^2)`, matching classroom convention.
3. **Canvas graph with grid and axes** — automatic y-scaling from the plotted
   values, with gaps where a function is undefined (e.g. `1/x` at 0).
4. **View controls** — X min/max, zoom in/out, pan left/right, reset.
5. **Trace** — a slider (or click the graph) reads `f(x)` for every enabled
   function at the chosen x.
6. **Analysis** — minimum, maximum, and roots of the first enabled function
   over the current view (roots by sign-change bisection, plus tangent roots
   such as `x^2` at 0).
7. **Value table** — `f(x)` at integer x across the view.
8. **Presets** — one-click `x^2`, `sin(x)`, `1/x`, `2^x`, `abs(x)`, `sqrt(x)`,
   `x^3-3x`, `exp(-x^2)`, and more.
9. **Bilingual UI** — EN / Bangla toggle, persisted, with Bengali digits in
   readouts when Bangla is active.
10. **Persistence + data tools** — functions, view, and language are saved to
    localStorage; export JSON, import with strict validation (a bad file is
    rejected with data intact), typed-DELETE erase-all.

## Stack

- Vanilla HTML/CSS/JavaScript, no build step, no dependencies, no network
  requests. Canvas 2D for the graph.

## Prerequisites

- Any modern browser. For tests: Node.js 18+ and a Chromium binary.

## Run locally

```sh
# Just open it — no server needed:
open index.html
# or serve it:
npx serve .
```

## Testing

```sh
node tests/logic.test.js   # 35 parser/math unit checks
node tests/smoke.js        # headless-Chrome UI checks (raw CDP, no puppeteer)
```

`tests/smoke.js` uses `/opt/meta-chromium/chrome` on this machine; point the
`chrome` spawn path at your own Chromium if it lives elsewhere. The app
exposes a `window.__fp` test hook (`getState`, `exportData`, `importData`)
used by the smoke test to exercise import without a file dialog.

## Deployment

Static hosting only (GitHub Pages, Netlify, any static host): publish the
whole folder; `index.html` is the entry point.

## Limitations

- Roots and extrema are computed from 2,001 samples over the view, so a very
  narrow spike between samples can be missed, and at most 20 roots are listed.
- The y-axis is auto-scaled from sampled values; a function with an extreme
  spike (e.g. near a vertical asymptote) compresses the rest of the graph.
- Values are double-precision floats; results are rounded to 2 decimals in
  readouts, so tiny differences (below ~0.005) are invisible there.
- `log` means base-10 here; if your textbook writes `log` for natural log,
  use `ln` instead.

## Status

Complete MVP. Offline-only by design; no user data ever leaves the browser.
