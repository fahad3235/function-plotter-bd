// Headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js — exits non-zero on any failure or page error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9357;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
const pageErrors = [];
function check(name, cond, extra) {
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/fp-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(JSON.stringify(msg.params.args));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const setInput = async (id, val) => ev(
    `(()=>{const el=document.getElementById('${id}');el.value=${JSON.stringify(val)};` +
    `el.dispatchEvent(new Event('input',{bubbles:true}));return el.value;})()`);
  const txt = async (id) => ev(`document.getElementById('${id}').textContent`);

  check('title', (await ev('document.title')) === 'Function Plotter BD');
  check('heading', (await ev(`document.querySelector('h1').textContent`)) === 'Function Plotter BD');
  check('4 function inputs', (await ev(`document.querySelectorAll('.fn-input').length`)) === 4);
  check('default f1 is x^2-4', (await ev(`document.getElementById('fn-expr-0').value`)) === 'x^2-4');
  check('canvas present with size', (await ev(`(()=>{const c=document.getElementById('plot');return c.width+'x'+c.height;})()`)) === '900x540');
  check('canvas drew pixels (non-blank)', (await ev(`(()=>{const c=document.getElementById('plot');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4) if(d[i]>0) n++;return n>10000;})()`)) === true);
  const analysis = await txt('analysisBox');
  check('analysis min -4', analysis.includes('-4'), analysis);
  check('analysis max 96', analysis.includes('96'), analysis);
  check('analysis roots -2 and 2', analysis.includes('-2.00') && analysis.includes('2.00'), analysis);
  check('value table has rows', (await ev(`document.querySelectorAll('#valueTable tbody tr').length`)) >= 10);
  check('value table x=2 row shows f1=0', (await ev(`(()=>{const rows=[...document.querySelectorAll('#valueTable tbody tr')];const r=rows.find(tr=>tr.cells[0].textContent.trim()==='2.00');return r?r.cells[1].textContent.trim():null;})()`)) === '0.00');
  // trace at x=2 via slider (fraction 0.6 of -10..10)
  await ev(`(()=>{const s=document.getElementById('traceSlider');s.value=240;s.dispatchEvent(new Event('input',{bubbles:true}));return s.value;})()`);
  await wait(300);
  const trace = await txt('traceReadout');
  check('trace at x=2: f1=0.00', trace.includes('0.00'), trace);
  check('trace shows f2 sin(2)=0.91', trace.includes('0.91'), trace);
  // invalid expression -> inline error, no crash
  await setInput('fn-expr-0', '2+');
  await wait(300);
  check('invalid expr shows error', (await txt('fn-err-0')).length > 0, await txt('fn-err-0'));
  await setInput('fn-expr-0', 'x^2-4');
  await wait(300);
  check('error clears after fix', (await txt('fn-err-0')) === '');
  // preset load
  await ev(`(()=>{document.getElementById('presetSel').value='cos(x)';document.getElementById('loadPreset').click();return document.getElementById('fn-expr-0').value;})()`);
  check('preset loads cos(x) into f1', (await ev(`document.getElementById('fn-expr-0').value`)) === 'cos(x)');
  // zoom in: -10..10 -> -5..5
  await ev(`document.getElementById('zoomIn').click()`);
  await wait(300);
  check('zoom in narrows view to -5..5', (await ev(`document.getElementById('viewMin').value`)) === '-5' && (await ev(`document.getElementById('viewMax').value`)) === '5');
  await ev(`document.getElementById('resetView').click()`);
  await wait(300);
  check('reset view restores -10..10', (await ev(`document.getElementById('viewMin').value`)) === '-10');
  // invalid view rejected
  await setInput('viewMin', '5'); await setInput('viewMax', '5');
  await ev(`document.getElementById('applyView').click()`);
  await wait(200);
  check('bad view shows error', (await txt('viewErr')).length > 0);
  await ev(`document.getElementById('resetView').click()`);
  // language toggle -> Bengali heading + digits
  await ev(`document.getElementById('langBtn').click()`);
  await wait(300);
  const bnTag = await ev(`document.querySelector('[data-i18n="tagline"]').textContent`);
  check('BN tagline renders Bengali', bnTag && bnTag.includes('গাণিতিক'), bnTag);
  const bnAnalysis = await txt('analysisBox');
  check('BN digits in analysis', /[০-৯]/.test(bnAnalysis), bnAnalysis);
  await ev(`document.getElementById('langBtn').click()`);
  await wait(300);
  check('EN toggle restores tagline', (await ev(`document.querySelector('[data-i18n="tagline"]').textContent`)).includes('Graph maths'));
  // import round-trip via test hook
  const impOk = await ev(`window.__fp.importData({app:'function-plotter-bd',version:1,funcs:[{expr:'x^3',on:true},{expr:'',on:false},{expr:'',on:false},{expr:'',on:false}],view:{xmin:-5,xmax:5},lang:'en'})`);
  check('valid import accepted', impOk === true);
  check('import applied f1=x^3', (await ev(`document.getElementById('fn-expr-0').value`)) === 'x^3');
  const impBad = await ev(`window.__fp.importData({app:'other',version:1})`);
  check('invalid import rejected', impBad === false);
  check('bad import leaves data intact', (await ev(`document.getElementById('fn-expr-0').value`)) === 'x^3');
  // erase via hook path: use UI typed-DELETE
  await ev(`window.__fp.importData({app:'function-plotter-bd',version:1,funcs:[{expr:'x^2-4',on:true},{expr:'sin(x)',on:true},{expr:'',on:false},{expr:'',on:false}],view:{xmin:-10,xmax:10},lang:'en'})`);
  await setInput('eraseInput', 'DELETE');
  await ev(`document.getElementById('eraseBtn').click()`);
  await wait(300);
  check('typed-DELETE erases to defaults', (await ev(`document.getElementById('fn-expr-0').value`)) === 'x^2-4' && (await txt('dataMsg')).length > 0);
  // mobile 390px: no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const overflow = await ev(`document.documentElement.scrollWidth`);
  check('390px no horizontal overflow', overflow <= 391, 'scrollWidth=' + overflow);
  check('390px canvas still present', (await ev(`!!document.getElementById('plot')`)) === true);
  check('zero console/page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 500));

  console.log(failures + ' smoke failures');
  try { chrome.kill(); } catch (e) { /* ignore */ }
  process.exit(failures || pageErrors.length ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); process.exit(2); });
