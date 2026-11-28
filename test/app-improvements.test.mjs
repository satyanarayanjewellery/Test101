import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const htmlUrl = new URL('../index.html', import.meta.url);

async function loadHtml() {
  return readFile(htmlUrl, 'utf8');
}

function makeFakeDom(values = {}) {
  const nodes = new Map();
  const getNode = (id) => {
    if (!nodes.has(id)) {
      const init = values[id];
      const node = {
        id,
        value: typeof init === 'object' && init !== null && 'value' in init ? init.value : (init ?? ''),
        checked: typeof init === 'object' && init !== null && 'checked' in init ? init.checked : false,
        textContent: '',
        className: '',
        classList: {
          hidden: false,
          toggle(cls, force) { if (cls === 'hidden') this.hidden = Boolean(force); },
          add() {},
          remove() {}
        },
        focus() {},
        removeAttribute() {},
        setAttribute() {}
      };
      nodes.set(id, node);
    }
    return nodes.get(id);
  };
  return {
    document: { getElementById: (id) => getNode(id) },
    getNode
  };
}

const samplePrices = {
  gold999ExGst: 131000, gold999: 134930, gold995ExGst: 130869, gold995: 134795,
  gold916ExGst: 120083, gold916: 123686, gold18ExGst: 98250, gold18: 101177,
  gold999ExGstGram: 13100, gold999Gram: 13493,
  gold995ExGstGram: 13086.9, gold995Gram: 13479.5,
  gold916ExGstGram: 12008.3, gold916Gram: 12368.6,
  gold18ExGstGram: 9825, gold18Gram: 10117.7,
  silver999ExGst: 124000, silver999: 127720,
  silver999ExGstGram: 124, silver999Gram: 127.72,
  silver925ExGst: 114700, silver925: 118141,
  silver925ExGstGram: 114.7, silver925Gram: 118.141,
  silver750ExGst: 93000, silver750: 95790,
  silver750ExGstGram: 93, silver750Gram: 95.79,
  silverMCX: 108000, silverMCXGst: 111240,
  spotGold: 4100, spotSilver: 48, usdInr: 85
};

test('head has SEO, social and PWA hooks', async () => {
  const html = await loadHtml();
  for (const part of [
    'name="description"',
    'name="theme-color"',
    'property="og:title"',
    'property="og:description"',
    'name="twitter:card"',
    'rel="manifest" href="manifest.webmanifest"',
    'rel="apple-touch-icon"',
    'application/ld+json',
    'JewelryStore'
  ]) assert.ok(html.includes(part), part);
});

test('share and freshness controls live in the tools view, not on the rates board', async () => {
  const html = await loadHtml();
  const toolsStart = html.indexOf('<div id="view-tools"');
  const toolsEnd = html.indexOf('<!-- Mobile Bottom Navigation', toolsStart);
  assert.ok(toolsStart >= 0 && toolsEnd > toolsStart);
  const toolsView = html.slice(toolsStart, toolsEnd);

  for (const id of [
    'btn-share-rates', 'btn-share-whatsapp', 'btn-copy-rates', 'btn-print-rates',
    'rates-updated-label', 'rates-stale-badge', 'panel-share'
  ]) assert.ok(toolsView.includes(`id="${id}"`), `tools view: ${id}`);
  assert.ok(toolsView.includes('data-tool-tab="share"'));
  assert.match(html, /const tabs = \['calculator', 'old-gold', 'old-silver', 'mintu', 'share'\]/);

  const ratesView = html.slice(html.indexOf('<div id="view-rates"'), html.indexOf('<div id="view-products"'));
  for (const id of ['btn-share-rates', 'btn-share-whatsapp', 'btn-copy-rates', 'btn-print-rates', 'rates-updated-label', 'rates-stale-badge']) {
    assert.ok(!ratesView.includes(`id="${id}"`), `share control still on rates view: ${id}`);
  }
  assert.ok(html.includes('id="rates-live-region"'));
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(html.includes('Skip to live rates'));
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('prefers-reduced-motion'));
});

test('tola units and price alerts are removed', async () => {
  const html = await loadHtml();
  assert.ok(!html.toLowerCase().includes('tola'), 'no tola references remain');
  for (const absent of [
    'alert-gold-input', 'alert-silver-input', 'btn-save-alerts', 'btn-clear-alerts', 'alert-status',
    'loadPriceAlerts', 'renderAlertStatus', 'checkPriceAlerts', 'updateTolaTiles', 'TOLA_GRAMS'
  ]) assert.ok(!html.includes(absent), absent);
  assert.match(html, /'satyanarayan_price_alerts_v1'\]\.forEach\(key => localStorage\.removeItem\(key\)\)/);
});

test('header date/time is rendered at boot and ticks every second', async () => {
  const html = await loadHtml();
  assert.ok(html.includes('id="header-live-datetime"'));

  const bootStart = html.indexOf('(function bootApp() {');
  const bootEnd = html.indexOf('    })();', bootStart);
  assert.ok(bootStart >= 0 && bootEnd > bootStart);
  const boot = html.slice(bootStart, bootEnd);
  assert.match(boot, /^ {6}renderHeaderDateTime\(\);$/m);
  assert.match(boot, /setInterval\(renderHeaderDateTime, 1000\)/);
  assert.ok(!html.slice(0, bootStart).includes('setInterval(renderHeaderDateTime, 1000)'), 'clock interval is only started once');

  const start = html.indexOf('    const HEADER_DT_FORMATTER =');
  const end = html.indexOf('    function renderMarketHoursUI()', start);
  assert.ok(start >= 0 && end > start);
  const el = { id: 'header-live-datetime', textContent: '--' };
  const context = {
    getEl: (id) => (id === el.id ? el : null),
    setText: (node, value) => { node.textContent = value; }
  };
  const render = vm.runInNewContext(`${html.slice(start, end)}\nrenderHeaderDateTime`, context);
  render();
  assert.match(el.textContent, /IST$/);
  assert.match(el.textContent, /\d{2}:\d{2}:\d{2}/);
});

test('WhatsApp channel link and its styling are preserved', async () => {
  const html = await loadHtml();
  assert.match(html, /id="whatsapp-channel-link" href="https:\/\/whatsapp\.com\/channel\/0029Vb9XXVnKgsNmtesNKy1A"/);
  assert.ok(html.includes('.bg-emerald-500\\/20{background-color:rgba(16,185,129,0.2)}'));
  assert.ok(html.includes('S.browser_fallback_url='));
});

test('manifest and service worker are valid, referenced, and prevent cache poisoning', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'Satyanarayan Jewellers — Live Gold & Silver Price Desk');
  assert.equal(manifest.theme_color, '#090607');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.ok(manifest.icons.some(i => i.sizes === '192x192'));
  assert.ok(manifest.icons.some(i => i.sizes === '512x512'));
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /sj-price-desk-v16/);
  assert.match(sw, /index\.html/);
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /client\.navigate\(client\.url\)/,
    'a worker update must refresh already-open customer apps, including legacy shells without update listeners');
  assert.match(sw, /!url\.pathname\.includes\('\/admin\/'\)/,
    'customer worker updates must not navigate the separately-scoped Admin PWA');
  const html = await loadHtml();
  assert.ok(html.includes("navigator.serviceWorker.register('sw.js')"));

  // Execute sw.js in a mock ServiceWorkerGlobalScope to verify non-OK responses are not cached
  const listeners = {};
  const cacheStore = new Map([['./index.html', { ok: true, type: 'basic', body: 'cached-shell' }]]);
  const cacheApi = {
    put: async (k, v) => { cacheStore.set(typeof k === 'string' ? k : k.url, v); },
    match: async (k) => cacheStore.get(typeof k === 'string' ? k : k.url)
  };
  let nextFetchRes = { ok: false, status: 500, type: 'basic', clone() { return { ...this }; } };
  const navigatedClients = [];
  const windowClients = [
    { url: 'https://example.com/shop/', navigate: async (url) => { navigatedClients.push(url); } },
    { url: 'https://example.com/shop/admin/', navigate: async (url) => { navigatedClients.push(url); } }
  ];
  const swContext = {
    URL,
    self: {
      location: { origin: 'https://example.com' },
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: () => {},
      clients: { claim: async () => {}, matchAll: async () => windowClients }
    },
    caches: {
      open: async () => cacheApi,
      match: async (k) => cacheStore.get(typeof k === 'string' ? k : k.url),
      keys: async () => [],
      delete: async () => true
    },
    fetch: async () => nextFetchRes
  };
  vm.runInNewContext(sw, swContext);

  // A newly activated customer worker refreshes stale customer windows, but leaves Admin PWA open.
  let activation;
  listeners.activate({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.deepEqual(navigatedClients, ['https://example.com/shop/']);

  // 1. Navigation returning HTTP 500 should fall back to cached shell and NOT overwrite cache
  let responded;
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://example.com/' },
    respondWith: (p) => { responded = p; }
  });
  const navRes = await responded;
  assert.equal(navRes.body, 'cached-shell');
  assert.equal(cacheStore.get('./index.html').body, 'cached-shell');

  // 2. Navigation returning HTTP 200 same-origin updates the cache
  nextFetchRes = { ok: true, status: 200, type: 'basic', body: 'fresh-shell', clone() { return { ...this }; } };
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://example.com/' },
    respondWith: (p) => { responded = p; }
  });
  const freshRes = await responded;
  assert.equal(freshRes.body, 'fresh-shell');
  assert.equal(cacheStore.get('./index.html').body, 'fresh-shell');

  // 3. Statutory duty/GST is policy data: it must bypass stale-while-revalidate so a changed
  //    duty is never masked by a cached copy (which would misprice every rupee figure).
  nextFetchRes = { ok: true, status: 200, type: 'basic', body: '{"gold":{"importDutyPct":15}}', clone() { return { ...this }; } };
  let statutoryResponded;
  listeners.fetch({
    request: { method: 'GET', mode: 'cors', url: 'https://example.com/catalog/statutory-rates.json' },
    respondWith: (p) => { statutoryResponded = p; }
  });
  const statutoryRes = await statutoryResponded;
  assert.equal(statutoryRes.body, '{"gold":{"importDutyPct":15}}', 'statutory rates must come from the network');
});

test('relative-age helper formats ages correctly', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function formatRelativeAge(');
  const end = html.indexOf('    function updateRatesUpdatedLabel()', start);
  assert.ok(start >= 0 && end > start);
  const source = html.slice(start, end);
  const fn = vm.runInNewContext(`${source}\nformatRelativeAge`, {});
  assert.equal(fn(0), 'just now');
  assert.equal(fn(5000), 'just now');
  assert.equal(fn(45000), '45s ago');
  assert.equal(fn(5 * 60000), '5m ago');
  assert.equal(fn(65 * 60000), '1h 5m ago');
  assert.equal(fn(-1), 'just now');
});

test('share-text builder includes GST and spot lines without tola', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function buildRatesShareText()');
  const end = html.indexOf('    function announceRates()', start);
  assert.ok(start >= 0 && end > start);
  const source = html.slice(start, end);
  const context = {
    state: { prices: samplePrices, live: { lastSync: new Date('2026-11-25T03:30:00Z') } },
    getCurrentCity: () => ({ name: 'Cuttack', state: 'Odisha' }),
    fmtINR: (n) => '₹' + Math.round(n).toLocaleString('en-IN'),
    fmtUSD: (n) => '$' + Number(n).toFixed(2),
    // The share card states the duty/GST it was priced with, so this must come from the model.
    statutoryRatesFor: () => ({ importDutyPct: 15, gstPct: 3 }),
    statutoryLabel: () => '15% duty + 3% GST'
  };
  const build = vm.runInNewContext(`${source}\nbuildRatesShareText`, context);
  const text = build();
  for (const part of ['Satyanarayan Jewellers', 'Cuttack', 'Gold (per 10g', '999:', '916 (22K):', 'Silver (per kg', 'MCX estimate', 'Spot:', 'Indicative estimates', '15% duty + 3% GST']) {
    assert.ok(text.includes(part), part);
  }
  assert.ok(text.includes('incl. 3% GST'), 'the GST percentage must come from the statutory model');
  assert.match(text, /₹1,31,000/); // 999 gold per 10g, ex-GST
  assert.ok(!text.toLowerCase().includes('tola'));
});

test('admin tools and two-factor authentication are removed', async () => {
  const html = await loadHtml();
  for (const absent of [
    'id="admin-login-modal"', 'id="panel-admin"', 'data-tool-tab="admin"',
    'id="twofa-setup"', 'id="twofa-login-wrap"', 'state.admin', 'adminMult',
    'openAdminModal', 'renderAdminUI', 'Ctrl+Shift+A'
  ]) assert.ok(!html.includes(absent), absent);
  for (const key of ['satyanarayan_admin_pass_v1', 'satyanarayan_admin_offset_v1', 'sj_admin_totp_secret_v1', 'sj_totp_pending']) {
    assert.ok(html.includes(key), `cleanup for ${key}`);
  }
  for (const tab of ['calculator', 'old-gold', 'old-silver', 'mintu', 'share']) {
    assert.ok(html.includes(`data-tool-tab="${tab}"`));
    assert.ok(html.includes(`id="panel-${tab}"`));
  }
});

test('price calculator handles percentage, per-gram, and flat making charges without double percent sign', async () => {
  const html = await loadHtml();
  assert.ok(html.includes('<span id="quote-making-pct">8%</span>'), 'markup does not hardcode trailing %');
  const start = html.indexOf('    function getPerGramPrice(');
  const end = html.indexOf('    function switchToolTab(', start);
  assert.ok(start >= 0 && end > start);
  const source = html.slice(start, end);
  const fmtINR = (n, d = 0) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

  // Percentage mode (10g 22K, 8% making, 3% GST)
  const domPct = makeFakeDom({
    'calc-metal': '22K', 'calc-weight': '10', 'calc-unit': 'g',
    'calc-making': '8', 'calc-making-type': 'pct', 'calc-gst-toggle': { checked: true }
  });
  const qPct = vm.runInNewContext(`${source}\ncomputeQuote()`, {
    state: { prices: samplePrices }, TROY_OZ_TO_GRAMS: 31.1034768, fmtINR, document: domPct.document
  });
  assert.equal(qPct.baseValue, 120083);
  assert.equal(qPct.makingCharges, 9607);
  assert.equal(qPct.gstAmount, 3891);
  assert.equal(qPct.grandTotal, 133581);
  assert.equal(domPct.getNode('quote-making-pct').textContent, '8%');

  // Per-gram mode (10g 22K, ₹500/g, GST off)
  const domPerG = makeFakeDom({
    'calc-metal': '22K', 'calc-weight': '10', 'calc-unit': 'g',
    'calc-making': '500', 'calc-making-type': 'per_g', 'calc-gst-toggle': { checked: false }
  });
  const qPerG = vm.runInNewContext(`${source}\ncomputeQuote()`, {
    state: { prices: samplePrices }, TROY_OZ_TO_GRAMS: 31.1034768, fmtINR, document: domPerG.document
  });
  assert.equal(qPerG.makingCharges, 5000);
  assert.equal(qPerG.gstAmount, 0);
  assert.equal(domPerG.getNode('quote-making-pct').textContent, '₹500/g');

  // Flat mode
  const domFlat = makeFakeDom({
    'calc-metal': '24K', 'calc-weight': '1', 'calc-unit': '10g',
    'calc-making': '2500', 'calc-making-type': 'flat', 'calc-gst-toggle': { checked: true }
  });
  const qFlat = vm.runInNewContext(`${source}\ncomputeQuote()`, {
    state: { prices: samplePrices }, TROY_OZ_TO_GRAMS: 31.1034768, fmtINR, document: domFlat.document
  });
  assert.equal(qFlat.baseValue, 131000);
  assert.equal(qFlat.makingCharges, 2500);
  assert.equal(domFlat.getNode('quote-making-pct').textContent, '₹2,500 flat');
});

test('old gold exchange applies stone deduction and hallmark vs non-hallmark policy', async () => {
  const html = await loadHtml();
  const unitStart = html.indexOf('    function unitToGrams(');
  const unitEnd = html.indexOf('    function computeQuote(', unitStart);
  const ogStart = html.indexOf('    function computeOldGoldExchange()');
  const ogEnd = html.indexOf('    function computeOldSilverExchange()', ogStart);
  assert.ok(ogStart >= 0 && ogEnd > ogStart);
  const source = html.slice(unitStart, unitEnd) + '\n' + html.slice(ogStart, ogEnd);
  const fmtINR = (n, d = 0) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

  const domHm = makeFakeDom({ 'og-purity': '91.6', 'og-weight': '10', 'og-unit': 'g', 'og-stone': '1', 'og-new-bill': '' });
  const resHm = vm.runInNewContext(`${source}\ncomputeOldGoldExchange()`, {
    state: { prices: samplePrices, ogHallmark: true }, TROY_OZ_TO_GRAMS: 31.1034768, fmtINR, document: domHm.document
  });
  assert.equal(resHm.netGrams, 9);
  assert.equal(resHm.deductPct, 0);
  assert.equal(Math.round(resHm.netValue), Math.round(9 * samplePrices.gold916ExGstGram));

  const domNonHm = makeFakeDom({ 'og-purity': '91.6', 'og-weight': '10', 'og-unit': 'g', 'og-stone': '1', 'og-new-bill': '' });
  const resNonHm = vm.runInNewContext(`${source}\ncomputeOldGoldExchange()`, {
    state: { prices: samplePrices, ogHallmark: false }, TROY_OZ_TO_GRAMS: 31.1034768, fmtINR, document: domNonHm.document
  });
  assert.equal(resNonHm.deductPct, 30);
  assert.equal(Math.round(resNonHm.netValue), Math.round(9 * samplePrices.gold916ExGstGram * 0.7));
});

test('market schedule accurately distinguishes weekday open, daily break, and weekend close', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    const DAY_MAP =');
  const end = html.indexOf('    const HEADER_DT_FORMATTER =', start);
  assert.ok(start >= 0 && end > start);
  const getMarketSchedule = vm.runInNewContext(`${html.slice(start, end)}\ngetMarketSchedule`, {
    state: { marketMode: 'INR' }
  });

  // Wed 2026-11-25 06:00 UTC = 11:30 AM IST (MCX open) and 1:00 AM EST (Global Spot open)
  const wed = getMarketSchedule(new Date('2026-11-25T06:00:00Z'));
  assert.equal(wed.globalSpot.isOpen, true);
  assert.equal(wed.indiaMcx.isOpen, true);

  // Wed 2026-11-25 22:30 UTC = 5:30 PM EST (Global Spot daily 1h break)
  const rollover = getMarketSchedule(new Date('2026-11-25T22:30:00Z'));
  assert.equal(rollover.globalSpot.isOpen, false);
  assert.equal(rollover.globalSpot.pillText, 'DAILY BREAK');

  // Sat 2026-11-28 10:00 UTC (Weekend closed for both)
  const sat = getMarketSchedule(new Date('2026-11-28T10:00:00Z'));
  assert.equal(sat.globalSpot.isOpen, false);
  assert.equal(sat.globalSpot.isWeekend, true);
  assert.equal(sat.indiaMcx.isOpen, false);
  assert.equal(sat.indiaMcx.isWeekend, true);
});

test('markdown renderer and avatar sanitizer defend against XSS and placeholder injection', async () => {
  const html = await loadHtml();
  const escStart = html.indexOf('    function escapeHtml(');
  const escEnd = html.indexOf('\n    }', escStart) + 6;
  const mdStart = html.indexOf('    function renderMarkdown(');
  const mdEnd = html.indexOf('    // =========================================================================\n    // MINTU AVATAR', mdStart);
  assert.ok(escStart >= 0 && mdStart >= 0 && mdEnd > mdStart);

  const renderMarkdown = vm.runInNewContext(`${html.slice(escStart, escEnd)}\n${html.slice(mdStart, mdEnd)}\nrenderMarkdown`, {});
  const xssHtml = renderMarkdown('<script>alert(1)</script>\n@@CODEBLOCK_99@@');
  assert.ok(!xssHtml.includes('<script>'));
  assert.ok(xssHtml.includes('&lt;script&gt;'));
  assert.ok(!xssHtml.includes('undefined'));
  assert.ok(xssHtml.includes('@@CODEBLOCK_99@@'));

  const avStart = html.indexOf('    function safeAvatarSrc(');
  const avEnd = html.indexOf('    function applyMintuAvatar(', avStart);
  assert.ok(avStart >= 0 && avEnd > avStart);
  const safeAvatarSrc = vm.runInNewContext(`const MINTU_DEFAULT_AVATAR = 'data:image/jpeg;base64,DEFAULT';\n${html.slice(avStart, avEnd)}\nsafeAvatarSrc`, {});
  assert.equal(safeAvatarSrc('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(safeAvatarSrc('" onerror="alert(1)'), 'data:image/jpeg;base64,DEFAULT');
  assert.equal(safeAvatarSrc('javascript:alert(1)'), 'data:image/jpeg;base64,DEFAULT');
  assert.equal(safeAvatarSrc('data:image/svg+xml;base64,PHN2Zz4='), 'data:image/jpeg;base64,DEFAULT');
});

test('security, performance, CSS utility, and cleanup regressions stay fixed', async () => {
  const html = await loadHtml();
  // Chart.js pinned to valid UMD bundle with SRI + CORS
  assert.ok(html.includes("const CHART_JS_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'"));
  assert.match(html, /const CHART_JS_INTEGRITY = 'sha384-[A-Za-z0-9+/=]+'/);
  assert.ok(html.includes("s.crossOrigin = 'anonymous'"));
  // Gemini API key sent in header, never query string
  assert.ok(html.includes("'x-goog-api-key': apiKey"));
  assert.ok(!html.includes(':generateContent?key='));
  // REST fallback uses sane 5s cadence with backoff
  assert.ok(html.includes('const REST_FALLBACK_MS = 5000'));
  // No missing CSS utility classes, mobile nav hidden in print, no dead elements/probes
  assert.ok(html.includes('.bg-slate-950\\/50{'));
  assert.ok(html.includes('.hover\\:bg-emerald-500\\/25:hover{'));
  const printIdx = html.indexOf('@media print{');
  assert.ok(printIdx >= 0);
  assert.ok(html.slice(printIdx, printIdx + 350).includes('#mobile-nav-bar'));
  assert.ok(!html.includes('mintu-agent.gif'));
  assert.ok(!html.includes('id="os-balance-box"'));
  assert.ok(html.includes('alt="Satyanarayan Jewellers Logo"'));
  assert.ok(!html.includes('alt="DK Logo"'));
});

test('computeCityPrices computes Cuttack and city-adjusted gold & silver rates accurately', async () => {
  const html = await loadHtml();
  const constantsStart = html.indexOf('    const TROY_OZ_TO_GRAMS =');
  const constantsEnd = html.indexOf('    const FX_REFRESH_MS =', constantsStart);
  const citiesStart = html.indexOf('    const CITIES = {');
  const citiesEnd = html.indexOf('    };', citiesStart) + '    };'.length;
  const fnStart = html.indexOf('    function computeCityPrices(');
  const fnEnd = html.indexOf('    function formatIndianInt(', fnStart);
  assert.ok(constantsStart >= 0 && constantsEnd > constantsStart);
  assert.ok(citiesStart >= 0 && citiesEnd > citiesStart);
  assert.ok(fnStart >= 0 && fnEnd > fnStart);

  const computeCityPrices = vm.runInNewContext([
    html.slice(constantsStart, constantsEnd),
    html.slice(citiesStart, citiesEnd),
    html.slice(fnStart, fnEnd),
    'computeCityPrices'
  ].join('\n'), {});

  const cuttack = computeCityPrices('cuttack', 4100, 48, 85);
  const expectedGoldBase = (4100 * 85 / 31.1034768) * 1.15 * 10 * 1.0000;
  const expectedMcxBase = (48 * 85 / 31.1034768) * 1.15 * 1000 * 1.0000;
  const expectedSilverBase = expectedMcxBase * 1.0000;
  assert.equal(cuttack.gold999ExGst, Math.round(expectedGoldBase));
  assert.equal(cuttack.gold916, Math.round(expectedGoldBase * 1.03 * 916 / 999));
  assert.equal(cuttack.silverMCXGst, Math.round(expectedMcxBase * 1.03));
  assert.equal(cuttack.silver925ExGst, Math.round(expectedSilverBase * 925 / 999));

  const delhi = computeCityPrices('delhi', 4100, 48, 85);
  assert.ok(delhi.gold999ExGst > cuttack.gold999ExGst);
});

test('jewellery collection supports image/video uploads with admin-only access and safe media URLs', async () => {
  const html = await loadHtml();
  const catalogJson = JSON.parse(await readFile(new URL('../catalog/products.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(catalogJson), 'catalog/products.json must be a JSON array');

  // Upload studio and admin modal stay hidden by default for regular visitors,
  // admin login is strictly GitHub token only (no device PIN bypass), and
  // fixed modals live outside </main> so .app-view transforms never trap/clip them.
  assert.match(html, /<section id="admin-studio" class="hidden /);
  assert.match(html, /<div id="admin-auth-modal" class="jewel-modal-backdrop hidden"/);
  assert.match(html, /<div id="product-lightbox" class="jewel-modal-backdrop hidden"/);
  assert.ok(!html.includes('admin-panel-pin'), 'PIN login panel should be removed (token-only admin access)');
  assert.ok(!html.includes('admin-tab-pin'), 'PIN login tab should be removed (token-only admin access)');
  const mainEndIdx = html.indexOf('</main>');
  assert.ok(mainEndIdx > 0);
  assert.ok(html.indexOf('id="admin-auth-modal"') > mainEndIdx, 'admin-auth-modal must be outside <main>/.app-view');
  assert.ok(html.indexOf('id="product-lightbox"') > mainEndIdx, 'product-lightbox must be outside <main>/.app-view');
  assert.ok(html.includes('accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"'));

  // Test sanitizeCatalogMediaUrl()
  const sanStart = html.indexOf('    function sanitizeCatalogMediaUrl(');
  const sanEnd = html.indexOf('    function mediaExtFromFile(', sanStart);
  assert.ok(sanStart >= 0 && sanEnd > sanStart);
  const sanitizeCatalogMediaUrl = vm.runInNewContext(`${html.slice(sanStart, sanEnd)}\nsanitizeCatalogMediaUrl`, {});
  assert.equal(sanitizeCatalogMediaUrl('catalog/media/prod-123-0.webp'), 'catalog/media/prod-123-0.webp');
  assert.equal(sanitizeCatalogMediaUrl('catalog/media/prod-123-1.mp4'), 'catalog/media/prod-123-1.mp4');
  assert.equal(sanitizeCatalogMediaUrl('blob:https://example.com/abc-123'), 'blob:https://example.com/abc-123');
  assert.equal(sanitizeCatalogMediaUrl('catalog/media/../index.html'), '');
  assert.equal(sanitizeCatalogMediaUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeCatalogMediaUrl('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.equal(sanitizeCatalogMediaUrl('https://evil.example/a.jpg'), '');

  // Test verifyGitHubToken() requires repository push permission
  const verStart = html.indexOf('    async function verifyGitHubToken(');
  const verEnd = html.indexOf('    function blobToBase64(', verStart);
  assert.ok(verStart >= 0 && verEnd > verStart);
  const makeVerify = (mockFetch) => vm.runInNewContext(
    `const CATALOG_REPO_ADMIN = 'satyanarayanjewellery'; const CATALOG_REPO_NAME = 'shop';\n${html.slice(verStart, verEnd)}\nverifyGitHubToken`,
    { fetch: mockFetch }
  );
  const verifyPush = makeVerify(async (url) => {
    if (url.includes('/repos/')) return { ok: true, status: 200, json: async () => ({ permissions: { push: true } }) };
    return { ok: true, status: 200, json: async () => ({ login: 'satyanarayanjewellery' }) };
  });
  const okRes = await verifyPush('  Bearer "github_pat_valid"  ');
  assert.equal(okRes.login, 'satyanarayanjewellery');
  assert.equal(okRes.token, 'github_pat_valid');

  const verifyReadOnly = makeVerify(async () => ({ ok: true, status: 200, json: async () => ({ permissions: { push: false } }) }));
  await assert.rejects(verifyReadOnly('github_pat_ro'), (e) => e.authError === true && /read-only/i.test(e.message));

  const verifyBad = makeVerify(async () => ({ ok: false, status: 401, json: async () => ({}) }));
  await assert.rejects(verifyBad('github_pat_bad'), (e) => e.authError === true && /invalid or expired/i.test(e.message));

  // Test getVisibleCatalogItems() hides local drafts when locked
  const visStart = html.indexOf('    function getVisibleCatalogItems()');
  const visEnd = html.indexOf('    function renderProducts()', visStart);
  assert.ok(visStart >= 0 && visEnd > visStart);
  const lockedItems = vm.runInNewContext(`${html.slice(visStart, visEnd)}\ngetVisibleCatalogItems()`, {
    productAdmin: { unlocked: false, publishedItems: [{ id: 'pub-1' }], localItems: [{ id: 'loc-1' }] }
  });
  assert.deepEqual(Array.from(lockedItems, (x) => x.id), ['pub-1']);
  const unlockedItems = vm.runInNewContext(`${html.slice(visStart, visEnd)}\ngetVisibleCatalogItems()`, {
    productAdmin: { unlocked: true, publishedItems: [{ id: 'pub-1' }], localItems: [{ id: 'loc-1' }] }
  });
  assert.deepEqual(Array.from(unlockedItems, (x) => x.id), ['loc-1', 'pub-1']);

  // Admin entry button stays hidden for customers until a secret reveal
  assert.match(html, /<button id="btn-admin-access" type="button" class="shop-admin-btn hidden"/);
  assert.ok(html.includes('.shop-admin-btn.hidden{display:none}'),
    'hidden rule must beat .shop-admin-btn display:inline-flex');
  assert.ok(html.includes('ADMIN_ACCESS_REVEAL_KEY'), 'reveal state must persist per tab');
  assert.ok(html.includes("'#admin'"), 'secret #admin URL hash must reveal admin access');
  assert.ok(html.includes('ADMIN_ACCESS_SECRET'), 'secret "admin" key sequence must reveal admin access');
  const lockIdx = html.indexOf("document.getElementById('btn-admin-lock')");
  assert.ok(lockIdx > 0 && html.slice(lockIdx, lockIdx + 400).includes('concealAdminAccess()'),
    'Lock must re-hide admin access');

  // updateAdminStudioUI() drives the admin button visibility
  const uiStart = html.indexOf('    function updateAdminStudioUI()');
  const uiEnd = html.indexOf('    function revealAdminAccess()', uiStart);
  assert.ok(uiStart >= 0 && uiEnd > uiStart);
  const runAdminUi = (adminState) => {
    const dom = makeFakeDom();
    const run = vm.runInNewContext(`${html.slice(uiStart, uiEnd)}\nupdateAdminStudioUI`, {
      document: dom.document,
      productAdmin: adminState
    });
    run();
    return dom;
  };
  const baseAdminState = () => ({
    unlocked: false,
    ghConnected: false,
    ghLogin: '',
    accessRevealed: false,
    publishedItems: [],
    localItems: []
  });

  const lockedDom = runAdminUi(baseAdminState());
  assert.equal(lockedDom.getNode('btn-admin-access').classList.hidden, true,
    'admin button must be hidden for regular visitors');
  assert.equal(lockedDom.getNode('admin-studio').classList.hidden, true);
  assert.equal(lockedDom.getNode('admin-mode-pill').classList.hidden, true);
  assert.equal(lockedDom.getNode('btn-admin-access-label').textContent, 'Admin');

  const revealedDom = runAdminUi({ ...baseAdminState(), accessRevealed: true });
  assert.equal(revealedDom.getNode('btn-admin-access').classList.hidden, false,
    'admin button must appear after the secret reveal');
  assert.equal(revealedDom.getNode('admin-studio').classList.hidden, true,
    'upload studio must stay hidden until admin mode is unlocked');

  const activeDom = runAdminUi({ ...baseAdminState(), unlocked: true, ghConnected: true });
  assert.equal(activeDom.getNode('btn-admin-access').classList.hidden, false,
    'admin button must stay visible while admin mode is active');
  assert.equal(activeDom.getNode('admin-mode-pill').classList.hidden, false);
  assert.equal(activeDom.getNode('btn-admin-access-label').textContent, 'Token Settings');

  // revealAdminAccess()/concealAdminAccess() flip the flag and persist it per tab
  const recStart = html.indexOf('    function revealAdminAccess()');
  const recEnd = html.indexOf('    function renderPendingMediaPreviews(', recStart);
  assert.ok(recStart >= 0 && recEnd > recStart);
  const recStore = new Map();
  const recProductAdmin = { accessRevealed: false };
  const recSessionStorage = {
    getItem: (k) => (recStore.has(k) ? recStore.get(k) : null),
    setItem: (k, v) => { recStore.set(k, String(v)); },
    removeItem: (k) => { recStore.delete(k); }
  };
  const { revealAdminAccess, concealAdminAccess } = vm.runInNewContext(
    `${html.slice(recStart, recEnd)}\n({ revealAdminAccess, concealAdminAccess })`,
    {
      productAdmin: recProductAdmin,
      sessionStorage: recSessionStorage,
      ADMIN_ACCESS_REVEAL_KEY: 'sj_admin_access_revealed_v1',
      document: makeFakeDom().document,
      updateAdminStudioUI: () => {}
    }
  );
  revealAdminAccess();
  assert.equal(recProductAdmin.accessRevealed, true);
  assert.equal(recSessionStorage.getItem('sj_admin_access_revealed_v1'), '1');
  concealAdminAccess();
  assert.equal(recProductAdmin.accessRevealed, false);
  assert.equal(recSessionStorage.getItem('sj_admin_access_revealed_v1'), null);
});

test('shop drops the shopping bag and Gemstone/Platinum/Diamond; rates gain a Rate of the Day', async () => {
  const html = await loadHtml();

  // Shopping bag/cart fully removed — Saved/wishlist stays
  assert.ok(!html.includes('id="shop-cart"'), 'cart drawer must be removed');
  assert.ok(!html.includes('btn-open-cart'), 'My Bag buttons must be removed');
  assert.ok(!html.includes('product-add-bag'), 'Add-to-bag buttons must be removed');
  assert.ok(!html.includes('SHOP_BAG_KEY'), 'bag storage must be removed');
  assert.ok(!html.includes('Add to bag'), 'no "Add to bag" copy may remain');
  assert.ok(!html.includes('shop-cart-shell'), 'cart drawer CSS must be removed');
  assert.ok(!html.includes('renderShopBag'), 'bag renderer must be removed');
  assert.ok(html.includes('product-save-btn'), 'Saved/wishlist must stay');
  assert.ok(html.includes('saved-count-pill'), 'saved count pill must stay');
  assert.ok(html.includes('product-wa-enquire'), 'per-product WhatsApp enquiry must stay');

  // Gemstone / Platinum / Diamond removed from shop filters and admin upload form
  for (const cat of ['Diamond', 'Platinum', 'Gemstone']) {
    assert.ok(!html.includes(`data-prod-cat="${cat}"`), `${cat} filter pill must be removed`);
    assert.ok(!html.includes(`<option>${cat}</option>`), `${cat} upload option must be removed`);
  }
  assert.ok(html.includes('data-prod-cat="Gold"') && html.includes('data-prod-cat="Silver"'),
    'Gold and Silver pills must stay');

  // Rate of the Day card + capture wiring
  assert.ok(html.includes('id="rate-of-day-section"'), 'Rate of the Day card must exist');
  assert.ok(html.includes('rateOfDay:'), 'rate-of-day storage key must exist');
  assert.ok(html.includes('renderRateOfDay(p);'), 'rate-of-day must refresh with every rate paint');

  // captureRateOfDay(): noon-window capture, once per day, older days kept for display
  const capStart = html.indexOf('    function localDateKey(');
  const capEnd = html.indexOf('    function renderRateOfDay(', capStart);
  assert.ok(capStart >= 0 && capEnd > capStart);
  const store = new Map();
  const { localDateKey, readRateOfDay, captureRateOfDay } = vm.runInNewContext(
    `${html.slice(capStart, capEnd)}\n({ localDateKey, readRateOfDay, captureRateOfDay })`,
    {
      STORAGE_KEYS: { rateOfDay: 'satyanarayan_rate_of_day_v1' },
      lsGet: (k, fb = '') => (store.has(k) ? store.get(k) : fb),
      lsSet: (k, v) => { store.set(k, String(v)); }
    }
  );
  const prices = {
    gold999ExGstGram: 9000.5,
    gold995ExGstGram: 8965.2,
    gold916ExGstGram: 8250.4,
    gold18ExGstGram: 6750.3
  };

  // Inside the 12:00–12:59 PM window → captures today's ex-GST retail rates
  const noon = new Date(2026, 10, 26, 12, 30);
  const captured = captureRateOfDay(prices, noon);
  assert.equal(localDateKey(noon), '2026-11-26');
  assert.equal(captured.date, '2026-11-26');
  assert.equal(captured.rates.g999, 9000.5);
  assert.equal(captured.rates.g916, 8250.4);
  assert.equal(readRateOfDay().rates.g750, 6750.3);

  // Outside the window with nothing captured today → no capture
  store.clear();
  assert.equal(captureRateOfDay(prices, new Date(2026, 10, 26, 14, 0)), null,
    'rates outside 12:00–12:59 must not be captured');
  assert.equal(captureRateOfDay(prices, new Date(2026, 10, 26, 11, 59)), null);

  // Today's capture is never overwritten later in the day
  captureRateOfDay(prices, noon);
  const later = captureRateOfDay({ ...prices, gold999ExGstGram: 9999 }, new Date(2026, 10, 26, 15, 0));
  assert.equal(later.rates.g999, 9000.5, 'today\'s noon capture must not be overwritten');

  // First in-window rate of a new day replaces the previous day's capture
  const nextDay = captureRateOfDay({ ...prices, gold999ExGstGram: 9111 }, new Date(2026, 10, 27, 12, 5));
  assert.equal(nextDay.date, '2026-11-27');
  assert.equal(nextDay.rates.g999, 9111);

  // A previous day's capture stays readable for display when today's window hasn't happened yet
  store.set('satyanarayan_rate_of_day_v1',
    JSON.stringify({ date: '2026-12-25', capturedAt: '12:04 PM', rates: { g999: 8888, g995: 1, g916: 1, g750: 1 } }));
  assert.equal(captureRateOfDay(prices, new Date(2026, 11, 26, 9, 0)), null,
    'no new capture outside the window');
  assert.equal(readRateOfDay().date, '2026-12-25', 'older capture must remain for display');
});

test('Rate of the Day explains a missed noon window instead of waiting forever', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function renderRateOfDay(');
  const end = html.indexOf('    function renderPriceCards(', start);
  const fn = html.slice(start, end);
  assert.ok(fn.includes('const hour = new Date().getHours();'));
  assert.ok(fn.includes("hour < 12 ? 'Awaiting 12 PM' : (hour === 12 ? 'Capturing now…' : 'Tomorrow · 12 PM')"));
  assert.ok(!fn.includes("dateEl.textContent = 'Awaiting 12 PM';\n"), 'must not always say Awaiting 12 PM');
});

test('Mintu flows open the chat panel and no dead view alias remains', async () => {
  const html = await loadHtml();
  // Ask Mintu buttons/tiles must land on the Tools view with the Mintu sub-tab active.
  assert.ok(!html.includes("switchAppView('agent')"), 'dead agent alias must not be used');
  const occurrences = html.match(/switchToolTab\('mintu'\)/g) || [];
  assert.ok(occurrences.length >= 4, 'quote, old-gold, old-silver and news flows must open Mintu');
});

// The inline sheet is hand-written Tailwind: any utility the markup uses but the sheet
// never defines is silently inert. That is what stacked the 7-tab bottom nav into one
// column on phones, so every utility used by markup is now checked against the sheet.
function definedCssNames(css) {
  const names = new Set();
  // Tailwind escapes the variant colon (`hover\:text-white`) and decimals/arbitrary values
  // (`gap-1\.5`, `text-\[8px\]`). Park the escaped colon behind a sentinel so a bare `:`
  // can still end a selector, then normalise every name back to the token markup carries.
  const MARK = '\u0000';
  const parked = css.replace(/\\:/g, MARK);
  for (const match of parked.matchAll(/\.((?:\\[^\s,{}>]|[^\\\s,{}>:])+)/g)) {
    const name = match[1]
      .replace(/::?[a-z-]+(?:\([^)]*\))?$/i, '') // drop trailing :hover / ::placeholder
      .replace(/\\/g, '')
      .split(MARK)
      .join(':');
    if (name) names.add(name);
  }
  return names;
}

function usedClassTokens(html) {
  const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html);
  const css = styleMatch ? styleMatch[1] : '';
  const withoutCss = html.replace(css, '');
  const tokens = new Set();
  const add = (value) => {
    for (const token of value.split(/\s+/)) {
      if (token && !token.includes('$') && !token.includes('{') && !token.includes('}')) tokens.add(token);
    }
  };
  for (const match of withoutCss.matchAll(/\bclass="([^"]*)"/g)) add(match[1]);
  for (const match of withoutCss.matchAll(/className = '([^']*)'/g)) add(match[1]);
  return tokens;
}

test('every Tailwind utility used by markup is defined in the inline stylesheet', async () => {
  const html = await loadHtml();
  const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html);
  assert.ok(styleMatch, 'inline stylesheet must exist');
  const defined = definedCssNames(styleMatch[1]);
  const knownUtility = /^(?:sm:|md:|lg:|hover:|focus:|active:|group-hover:|selection:|placeholder:|disabled:)?(?:text|bg|border|grid-cols|col-span|gap|space-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min-w|min-h|max-w|max-h|rounded|shadow|ring|z|inset|top|bottom|left|right|flex|grid|items|justify|self|font|leading|tracking|opacity|overflow|place|line-clamp|list|object|whitespace|uppercase|tabular-nums|truncate|pointer-events|select|transition|duration|animate|antialiased|sr-only|accent|fill|stroke|no-underline|italic|break|skeleton)(?:-|$)/;
  const missing = [...usedClassTokens(html)]
    .filter((token) => knownUtility.test(token) && !defined.has(token))
    .sort();
  assert.deepEqual(missing, [], `stylesheet is missing: ${missing.join(', ')}`);
});

test('mobile bottom nav is a single 5-tab row that replaces the desktop tabs', async () => {
  const html = await loadHtml();
  const navStart = html.indexOf('id="mobile-nav-bar"');
  assert.ok(navStart >= 0, 'mobile nav must exist');
  const nav = html.slice(navStart, html.indexOf('</nav>', navStart));
  assert.ok(nav.includes('grid grid-cols-5'), 'customer mobile nav must use the 5-column grid');
  const tabs = nav.match(/data-app-view="[a-z]+"/g) || [];
  assert.deepEqual(
    tabs.map((t) => t.slice('data-app-view="'.length, -1)),
    ['charts', 'news', 'rates', 'products', 'tools'],
    'bottom nav must keep exactly the five customer tabs in one row'
  );
  assert.ok(!html.includes('id="view-exchanges"') && !html.includes('id="view-accuracy"'),
    'exchanges and accuracy views must not ship in the customer app');
  // The bar must be hidden from md upward, otherwise it duplicates the desktop tabs.
  assert.ok(/@media \(min-width:768px\)\{#mobile-nav-bar\{display:none\}\}/.test(html),
    'mobile nav must be hidden at md and up');
  // Active-tab styling must not rewrite label sizes (it used to inflate them to 10px).
  const switchStart = html.indexOf('function switchAppView(');
  const switchView = html.slice(switchStart, switchStart + 9000);
  assert.ok(!/lbl\.className\s*=/.test(switchView), 'label sizing must be left to the markup');
  assert.ok(switchView.includes("lbl.classList.toggle('font-semibold', active)"));
});

test('USD/INR feeds are preference-ordered, as-of aware and sanity-guarded', async () => {
  const html = await loadHtml();
  const fxStart = html.indexOf('    // USD/INR plausibility band');
  const fxEnd = html.indexOf('    const CITIES = {', fxStart);
  assert.ok(fxStart >= 0 && fxEnd > fxStart, 'FX feed block must be locatable');

  const { FX_TIERS, extractFxAsOf, validateUsdInr } = vm.runInNewContext(
    [
      html.slice(fxStart, fxEnd),
      '({ FX_TIERS, extractFxAsOf, validateUsdInr })'
    ].join('\n'),
    { Number, Date, Math, JSON, Infinity }
  );

  // Deterministic preference: live mid-market quotes first (raced), then daily fallbacks —
  // open.er-api, the duplicated currency-api CDNs, and the stale ECB T+1 fix (Frankfurter) last.
  // (JSON compare: vm-context arrays/objects don't share prototypes with this realm.)
  assert.equal(JSON.stringify(FX_TIERS.map((tier) => tier.map((p) => p.name))),
    JSON.stringify([['currency-converter.live', 'fxapi.app'], ['open.er-api'], ['jsDelivr', 'Cloudflare'], ['Frankfurter']]));
  // Live providers must be flagged so the app polls them at 1-minute cadence and labels them live.
  for (const p of FX_TIERS[0]) assert.equal(p.live, true, `${p.name} must carry live: true`);
  for (const tier of FX_TIERS.slice(1)) for (const p of tier) {
    assert.ok(!p.live, `${p.name} is a daily reference feed and must not be flagged live`);
  }
  for (const tier of FX_TIERS) for (const p of tier) {
    assert.equal(typeof p.parse, 'function', `${p.name} needs a parse`);
    assert.equal(typeof p.parseAsOf, 'function', `${p.name} needs parseAsOf so the UI can show the rate's as-of date`);
  }

  // as-of extraction for each provider's real payload shape
  const allProviders = FX_TIERS.flat();
  const findProvider = (name) => {
    const p = allProviders.find((x) => x.name === name);
    assert.ok(p, `${name} must exist in FX_TIERS`);
    return p;
  };
  const erApi = findProvider('open.er-api');
  assert.equal(extractFxAsOf(erApi, { time_last_update_unix: 1795737751 }), 1795737751000);
  assert.equal(extractFxAsOf(erApi, { time_last_update_utc: 'Fri, 27 Nov 2026 00:02:31 +0000' }), Date.parse('Fri, 27 Nov 2026 00:02:31 +0000'));
  const frf = findProvider('Frankfurter');
  assert.equal(extractFxAsOf(frf, { date: '2026-11-26' }), Date.parse('2026-11-26T00:00:00Z'));
  const cdn = findProvider('jsDelivr');
  assert.equal(extractFxAsOf(cdn, { date: '2026-11-26' }), Date.parse('2026-11-26T00:00:00Z'));
  const live = findProvider('currency-converter.live');
  assert.equal(extractFxAsOf(live, { data: { quotes: { INR: { as_of: '2026-11-27T06:46:16+00:00' } }, generated_at: '2026-11-27T06:46:24+00:00' } }), Date.parse('2026-11-27T06:46:16+00:00'));
  assert.equal(extractFxAsOf(findProvider('fxapi.app'), { timestamp: '2026-11-27T06:40:38.607Z' }), Date.parse('2026-11-27T06:40:38.607Z'));
  assert.equal(extractFxAsOf(erApi, {}), null, 'missing timestamp must yield null, not NaN');
  assert.equal(extractFxAsOf(erApi, { time_last_update_unix: 'garbage' }), null);

  // Sanity guard: plausible band + max move vs previous rate
  assert.equal(validateUsdInr(92.52, null).ok, true);
  assert.equal(validateUsdInr(92.52, null).value, 92.52);
  assert.equal(validateUsdInr(94.0, 92.5).ok, true, 'a normal intraday-scale move must pass');
  assert.equal(validateUsdInr(94.0, 92.5).value, 94.0);
  assert.equal(validateUsdInr(9.25, null).reason, 'band');
  assert.equal(validateUsdInr(150, null).reason, 'band');
  assert.equal(validateUsdInr(0, null).reason, 'value');
  assert.equal(validateUsdInr(NaN, null).reason, 'value');
  assert.equal(validateUsdInr(95.5, 92.5).reason, 'move', '>2% jump in one refresh must be rejected');
  assert.equal(validateUsdInr(89.0, 92.5).reason, 'move', '>2% drop in one refresh must be rejected');
  assert.equal(validateUsdInr(92.5, 0).ok, true, 'a zero/absent previous rate must not trip the move guard');

  // The guard and as-of stamp must actually be wired into the live sync path
  assert.ok(html.includes('validateUsdInr(res.val, state.live.usdInr)'), 'syncLiveAPIs must validate via validateUsdInr');
  assert.ok(html.includes('state.live.usdInrAsOf = res.asOf || null'), 'sync must store the payload as-of timestamp');
  assert.ok(html.includes('usdInrAsOf: state.live.usdInrAsOf || null'), 'cached rates must persist the as-of timestamp');
  assert.ok(html.includes('id="news-ticker-inr-label"'), 'the news ticker must carry an FX as-of label');
});

// ---------------------------------------------------------------------------
// LIVE USD/INR ENGINE — gold & silver INR prices must always be calculated from
// the freshest live mid-market rupee rate, with daily feeds only as a backstop.
// ---------------------------------------------------------------------------
async function loadFxEngine({ fetchFromTiers, state, now = () => 1_000_000 }) {
  const html = await loadHtml();
  const engineStart = html.indexOf('    // LIVE USD/INR ENGINE');
  const engineEnd = html.indexOf('    async function syncLiveAPIs(', engineStart);
  assert.ok(engineStart >= 0 && engineEnd > engineStart, 'live FX engine block must be locatable');
  const constantsStart = html.indexOf('    const TROY_OZ_TO_GRAMS =');
  const constantsEnd = html.indexOf('    const WS_PROVIDERS =', constantsStart);
  const citiesStart = html.indexOf('    const CITIES = {');
  const citiesEnd = html.indexOf('    };', citiesStart) + '    };'.length;
  const computeStart = html.indexOf('    function computeCityPrices(');
  const computeEnd = html.indexOf('    function formatIndianInt(', computeStart);
  const fxStart = html.indexOf('    // USD/INR plausibility band');
  const fxEnd = html.indexOf('    const CITIES = {', fxStart);
  assert.ok(constantsStart >= 0 && constantsEnd > constantsStart);
  assert.ok(citiesStart >= 0 && citiesEnd > citiesStart);
  assert.ok(computeStart >= 0 && computeEnd > computeStart);
  assert.ok(fxStart >= 0 && fxEnd > fxStart);

  const renders = [];
  const persisted = [];
  const timers = [];
  const fakeDate = class extends Date { static now() { return now(); } };
  const sandbox = {
    Number, Date: fakeDate, Math, JSON, Infinity, Promise, console,
    state,
    fetchFromTiers,
    fmtTime: () => '12:00',
    renderPriceCards: (dirs) => renders.push(dirs),
    updateRatesUpdatedLabel: () => {},
    renderChart: () => {},
    updateAllTools: () => {},
    renderNewsTicker: () => {},
    persistCachedRates: (...args) => persisted.push(args),
    document: { hidden: false },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}
  };
  vm.runInNewContext([
    html.slice(constantsStart, constantsEnd),
    html.slice(citiesStart, citiesEnd),
    html.slice(computeStart, computeEnd),
    html.slice(fxStart, fxEnd),
    html.slice(engineStart, engineEnd),
    'globalThis.__engine = { refreshLiveFx, applyLiveFxToPrices, scheduleFxSync };'
  ].join('\n'), sandbox);
  return { engine: sandbox.__engine, renders, persisted, timers, sandbox };
}

function makeFxState(overrides = {}) {
  return {
    cityId: 'cuttack',
    marketMode: 'INR',
    activeView: 'rates',
    history: [],
    prices: null,
    live: {
      spotGold: 4100, spotSilver: 48, usdInr: null,
      lastFxSync: 0, lastFxAttempt: 0, isFxFetching: false, fxTimerId: null,
      fxSource: '', fxLive: false, usdInrAsOf: null,
      ...overrides
    }
  };
}

test('live FX engine prices gold & silver from the live mid-market tier and reprices immediately', async () => {
  const clock = 1_000_000;
  const calls = [];
  let rate = 92.9;
  const state = makeFxState();
  const { engine, renders, persisted } = await loadFxEngine({
    now: () => clock,
    state,
    fetchFromTiers: async (tiers) => {
      calls.push(tiers.map((t) => t.map((p) => p.name)));
      return { val: rate, source: 'currency-converter.live', asOf: clock - 30_000, live: true };
    }
  });

  const first = await engine.refreshLiveFx(true);
  assert.equal(first, 92.9);
  assert.equal(state.live.usdInr, 92.9);
  assert.equal(state.live.fxLive, true);
  assert.equal(state.live.fxSource, 'currency-converter.live');
  // Only the live mid-market tier is raced — daily feeds are not consulted when live works.
  assert.equal(JSON.stringify(calls), JSON.stringify([[['currency-converter.live', 'fxapi.app']]]));
  // Gold & silver are repriced from the live rate right away (no metal sync needed).
  const expectedGold = Math.round((4100 * 92.9 / 31.1034768) * 1.15 * 10 * 1.03);
  const expectedSilver = Math.round((48 * 92.9 / 31.1034768) * 1.15 * 1000 * 1.03);
  assert.equal(state.prices.gold999, expectedGold);
  assert.equal(state.prices.silver999, expectedSilver);
  assert.equal(state.prices.usdInr, 92.9);
  assert.equal(state.history.length, 1);
  assert.equal(persisted.length, 1);

  // Rupee weakens → every INR price moves up and the board flashes upward.
  rate = 93.1;
  const second = await engine.refreshLiveFx(true);
  assert.equal(second, 93.1);
  assert.ok(state.prices.gold999 > expectedGold, 'gold must reprice with the weaker rupee');
  assert.ok(state.prices.silver999 > expectedSilver, 'silver must reprice with the weaker rupee');
  assert.equal(JSON.stringify(renders[renders.length - 1]), JSON.stringify({ gold: 1, silver: 1 }));

  // Rupee strengthens → prices move down, flash downward.
  rate = 92.7;
  await engine.refreshLiveFx(true);
  assert.ok(state.prices.gold999 < expectedGold);
  assert.equal(JSON.stringify(renders[renders.length - 1]), JSON.stringify({ gold: -1, silver: -1 }));
});

test('live FX engine retries the live tier every minute even while a daily fallback rate is held', async () => {
  let clock = 1_000_000;
  const calls = [];
  // Held rate: a daily reference fetched 1 minute ago (well inside the 15-min horizon).
  const state = makeFxState({ usdInr: 92.5, fxLive: false, fxSource: 'open.er-api', lastFxSync: clock - 60_000, lastFxAttempt: clock - 61_000 });
  const { engine } = await loadFxEngine({
    now: () => clock,
    state,
    fetchFromTiers: async (tiers) => {
      calls.push(tiers.map((t) => t.map((p) => p.name)));
      throw new Error('live tier down');
    }
  });

  const kept = await engine.refreshLiveFx(false);
  assert.equal(kept, 92.5, 'a fresh daily fallback rate must be kept while live is down');
  assert.equal(state.live.usdInr, 92.5);
  // Only the live tier was retried — the daily APIs are NOT re-hammered every minute.
  assert.equal(JSON.stringify(calls), JSON.stringify([[['currency-converter.live', 'fxapi.app']]]));

  // One minute later the live tier is retried again (not parked for 15 minutes).
  clock += 61_000;
  await engine.refreshLiveFx(false);
  assert.equal(calls.length, 2, 'live tier must be retried at the 1-minute cadence');
  assert.equal(JSON.stringify(calls[1]), JSON.stringify([['currency-converter.live', 'fxapi.app']]));

  // Once the held rate goes stale (> 15 min), daily tiers backstop it.
  clock += 16 * 60_000;
  state.live.lastFxSync = clock - 16 * 60_000;
  const dailyCalls = [];
  const { engine: engine2 } = await loadFxEngine({
    now: () => clock,
    state,
    fetchFromTiers: async (tiers) => {
      dailyCalls.push(tiers.map((t) => t.map((p) => p.name)));
      if (dailyCalls.length === 1) throw new Error('live tier down');
      return { val: 92.7, source: 'open.er-api', asOf: clock - 3_600_000, live: false };
    }
  });
  const backstop = await engine2.refreshLiveFx(false);
  assert.equal(backstop, 92.7);
  assert.equal(state.live.fxLive, false);
  assert.equal(dailyCalls.length, 2, 'stale rate must fall back to the daily tiers');
  assert.equal(JSON.stringify(dailyCalls[1]), JSON.stringify([['open.er-api'], ['jsDelivr', 'Cloudflare'], ['Frankfurter']]));
});

test('live FX engine keeps the last good rate on garbage feeds and shares one in-flight attempt', async () => {
  const clock = 1_000_000;
  const state = makeFxState({ usdInr: 92.5, lastFxSync: clock - 60_000, lastFxAttempt: clock - 61_000 });
  let calls = 0;
  const { engine } = await loadFxEngine({
    now: () => clock,
    state,
    fetchFromTiers: async () => {
      calls += 1;
      return { val: 150, source: 'currency-converter.live', asOf: clock, live: true }; // outside the band
    }
  });
  const kept = await engine.refreshLiveFx(true);
  assert.equal(kept, 92.5, 'a band-rejected live quote must not reprice the board');
  assert.equal(state.live.usdInr, 92.5);
  assert.equal(state.prices, null, 'no reprice may happen on a rejected quote');

  // Concurrent callers (metal sync + heartbeat) share a single in-flight attempt.
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let fetches = 0;
  const state2 = makeFxState();
  const { engine: engine2 } = await loadFxEngine({
    clock,
    state: state2,
    fetchFromTiers: () => { fetches += 1; return gate.then(() => ({ val: 92.9, source: 'fxapi.app', asOf: clock, live: true })); }
  });
  const p1 = engine2.refreshLiveFx(true);
  const p2 = engine2.refreshLiveFx(true);
  assert.equal(p1, p2, 'concurrent refreshes must share one in-flight promise');
  release();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 92.9);
  assert.equal(r2, 92.9);
  assert.equal(fetches, 1, 'only one network attempt may run at a time');
  assert.equal(state2.live.usdInr, 92.9);
});

test('live FX heartbeat runs every minute independent of metal syncs and pauses when hidden', async () => {
  const clock = 1_000_000;
  const state = makeFxState({ usdInr: 92.5, lastFxSync: clock, lastFxAttempt: clock });
  const { engine, timers, sandbox } = await loadFxEngine({
    clock,
    state,
    fetchFromTiers: async () => ({ val: 92.5, source: 'currency-converter.live', asOf: clock, live: true })
  });
  engine.scheduleFxSync();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 60_000, 'heartbeat must tick at the live FX cadence (60s)');
  // Firing the heartbeat reschedules itself and refreshes the rate.
  timers[0].fn();
  assert.equal(timers.length, 2, 'heartbeat must reschedule itself');
  // Hidden tab: no new timer is armed.
  sandbox.document.hidden = true;
  engine.scheduleFxSync();
  assert.equal(timers.length, 2, 'hidden tab must not arm the heartbeat');
});

test('live FX engine is wired into boot, sync, visibility and the global spot board', async () => {
  const html = await loadHtml();
  // The metal sync delegates FX to the engine and never clobbers the engine-owned rate.
  assert.ok(html.includes('const fxPromise = refreshLiveFx(isInitialConnect || isManual);'), 'syncLiveAPIs must delegate to refreshLiveFx');
  assert.ok(!html.includes('state.live.usdInr = fxRes.value;'), 'syncLiveAPIs must not overwrite the engine-owned rate');
  assert.ok(!html.includes('const needFx ='), 'the old 15-minute FX gate must be gone');
  // Boot starts the dedicated heartbeat.
  const bootStart = html.indexOf('(function bootApp() {');
  const bootEnd = html.indexOf('    })();', bootStart);
  const boot = html.slice(bootStart, bootEnd);
  assert.ok(boot.includes('scheduleFxSync();'), 'boot must start the FX heartbeat');
  // Visibility change pauses and resumes the heartbeat.
  const visStart = html.indexOf("document.addEventListener('visibilitychange'");
  const visEnd = html.indexOf('});', visStart);
  const vis = html.slice(visStart, visEnd);
  assert.ok(vis.includes('state.live.fxTimerId'), 'visibility handler must manage the FX timer');
  assert.ok(vis.includes('scheduleFxSync();'), 'visibility handler must resume the heartbeat');
  // The FX strip appears only on the global spot board and reports the rate used for India prices.
  const inrStart = html.indexOf('<section id="inr-rates-section"');
  const usdStart = html.indexOf('<section id="usd-spot-section"');
  const usdEnd = html.indexOf('</section>', usdStart);
  assert.ok(inrStart >= 0 && usdStart > inrStart && usdEnd > usdStart);
  const inrBoard = html.slice(inrStart, usdStart);
  const usdBoard = html.slice(usdStart, usdEnd);
  for (const id of ['usd-spot-fx', 'usd-spot-fx-label', 'usd-spot-fx-value', 'usd-spot-fx-source', 'usd-spot-fx-inrper', 'usd-spot-fx-delta']) {
    assert.ok(usdBoard.includes(`id="${id}"`), `global FX strip: ${id}`);
    assert.ok(!inrBoard.includes(`id="${id}"`));
  }
  assert.ok(usdBoard.includes('rate used for India ₹ prices'));
  assert.ok(!html.includes('id="inr-fx-strip"'));
  assert.ok(html.includes('function renderGlobalFxStrip('));
  const paintStart = html.indexOf('function renderPriceCardsNow(');
  const paintEnd = html.indexOf('function renderNewsTicker(', paintStart);
  const paint = html.slice(paintStart, paintEnd);
  assert.ok(paint.includes('renderGlobalFxStrip();'), 'the global spot paint path must render the FX strip');
  // The engine reprices the whole board (history, flash, cache) when the rupee moves.
  const applyStart = html.indexOf('function applyLiveFxToPrices(');
  const applyEnd = html.indexOf('function scheduleFxSync(', applyStart);
  const apply = html.slice(applyStart, applyEnd);
  assert.ok(apply.includes('computeCityPrices(state.cityId, state.live.spotGold, state.live.spotSilver, state.live.usdInr)'), 'FX moves must recompute gold & silver');
  assert.ok(apply.includes('persistCachedRates('), 'FX reprices must persist the cached rates');
});

// ---------------------------------------------------------------------------
// FAST FIRST PAINT — the desk must not wait for the slowest of three independent
// hosts (or for a blocked tier to time out) before showing a price.
// ---------------------------------------------------------------------------
async function loadTierEngine({ fetchImpl, state }) {
  const html = await loadHtml();
  const start = html.indexOf('    function parseSwissquoteMid(');
  const end = html.indexOf('    // =========================================================================\n    // LIVE USD/INR ENGINE');
  assert.ok(start >= 0 && end > start, 'tier engine must be locatable');
  const sandbox = {
    Number, Date, Math, JSON, Infinity, Promise, Error, console, AbortController,
    setTimeout, clearTimeout, fetch: fetchImpl,
    // The engine reads live.spotGold/spotSilver/usdInr to decide what it still needs.
    state: { live: { usdInr: null, spotGold: null, spotSilver: null, ...(state && state.live) } },
    window: { addEventListener: () => {} }
  };
  vm.runInNewContext([
    html.slice(start, end),
    'globalThis.api = { fetchFromTiers, GOLD_TIERS };'
  ].join('\n'), sandbox);
  return sandbox.api;
}

function makeFetch({ dead = /$^/, latency = 80 }) {
  const calls = [];
  const fetchImpl = (url, opts = {}) => {
    calls.push(url);
    if (dead.test(url)) {
      // Host never answers (ad-blocker / ISP DNS): only our own abort ends the request.
      return new Promise((_, reject) => {
        const fail = () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); };
        const sig = opts.signal;
        if (sig) { if (sig.aborted) return fail(); sig.addEventListener('abort', fail, { once: true }); }
      });
    }
    return new Promise((resolve) => setTimeout(() => resolve({
      ok: true,
      json: async () => ({ price: 4100, xau: { usd: 4100 }, xag: { usd: 48 }, usd: { inr: 92.9 }, rate: 92.9, rates: { INR: 92.9 }, date: '2026-11-27' })
    }), latency));
  };
  return { fetchImpl, calls };
}

test('price feeds hedge to the fallback tier instead of waiting for a dead host to time out', async () => {
  const { fetchImpl } = makeFetch({ dead: /swissquote|gold-api\.com/, latency: 60 });
  const api = await loadTierEngine({ fetchImpl, state: {} });
  const started = Date.now();
  const res = await api.fetchFromTiers(api.GOLD_TIERS);
  const elapsed = Date.now() - started;
  assert.equal(res.source, 'jsDelivr', 'the healthy fallback must supply the price');
  // Old behaviour: full 2.2s tier-0 timeout before tier 1 was even asked (~2.3s total).
  assert.ok(elapsed < 1800, `first price must arrive well under the old 2.2s tier timeout (took ${elapsed}ms)`);
});

test('a fresher tier that answers late still upgrades a price already painted from a fallback', async () => {
  const deadFirst = makeFetch({ dead: /$^/, latency: 30 });
  // Tier 0 is slower than the hedge delay (1.4s), tier 1 is fast (30ms): the fallback paints
  // almost immediately, then the live quote corrects the board when it finally arrives.
  const fetchImpl = (url, opts) => {
    const isTier0 = /swissquote|gold-api\.com/.test(url);
    if (isTier0) {
      return new Promise((resolve) => setTimeout(() => resolve({
        ok: true, json: async () => ({ price: 4111, xau: { usd: 4111 }, date: '2026-11-27' })
      }), 1800));
    }
    return deadFirst.fetchImpl(url, opts);
  };
  const api = await loadTierEngine({ fetchImpl, state: {} });
  const upgrades = [];
  const started = Date.now();
  const res = await api.fetchFromTiers(api.GOLD_TIERS, false, (fresh) => upgrades.push({ at: Date.now() - started, val: fresh.val }));
  assert.equal(res.val, 4100, 'the fast fallback paints first');
  // Cold start hedges the next rung at ~0.9s, so the fallback paints ~1s in — while the live
  // tier is still 0.8s away. Old behaviour waited the full 2.2s for tier 0 before trying.
  assert.ok(Date.now() - started < 1300, `first paint must not wait for the slow live tier (took ${Date.now() - started}ms)`);
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(upgrades.length, 1, 'the late live quote must arrive as an upgrade');
  assert.equal(upgrades[0].val, 4111, 'the upgrade carries the fresher live value');
});

test('each metal paints on its own feed and FX hedges instead of blocking the board', async () => {
  const html = await loadHtml();
  // Gold and silver must not be gated behind a single all-three-feeds Promise.allSettled paint.
  const syncStart = html.indexOf('async function syncLiveAPIs(');
  const syncEnd = html.indexOf('function scheduleRetrySync(', syncStart);
  const sync = html.slice(syncStart, syncEnd);
  assert.ok(/paintLiveSnapshot\('gold'\)/.test(sync), 'gold must paint as soon as its feed lands');
  assert.ok(/paintLiveSnapshot\('silver'\)/.test(sync), 'silver must paint as soon as its feed lands');
  assert.ok(!/const allOk =/.test(sync), 'no single all-or-nothing gate may hold the board back');
  assert.ok(sync.includes('if (goldOk || silverOk)'), 'one working metal must be enough to be live');
  // A metal feed can fail without leaving the desk stuck on skeletons forever.
  assert.ok(sync.includes('scheduleRetrySync()'), 'a never-connected desk must retry on a timer');
  // Cold-load FX hedges the live tier against the daily ladder with an upgrade path.
  const hedgeStart = html.indexOf('function fetchFxWithHedge(');
  const hedgeEnd = html.indexOf('function refreshLiveFx(', hedgeStart);
  assert.ok(hedgeStart >= 0 && hedgeEnd > hedgeStart, 'fetchFxWithHedge must exist');
  const hedge = html.slice(hedgeStart, hedgeEnd);
  assert.ok(hedge.includes('FX_DAILY_HEDGE_MS'), 'the daily ladder must be hedged in');
  assert.ok(hedge.includes('commitFxRate(fresh, true)'), 'a late live quote must upgrade a daily fallback rate');
  assert.match(html, /const FX_DAILY_HEDGE_MS = \d+;/, 'the hedge delay must be a named constant');
  // Paint may borrow the cached snapshot for the metal that has not arrived yet.
  assert.ok(html.includes('function readCachedRates('), 'cached rates must be readable by the paint path');
});

// ---------------------------------------------------------------------------
// PRICE ACCURACY — every ₹ figure must be traceable to a live quote, the current
// statutory duty/GST, and a value that passed a sanity guard. These tests pin the
// guarantees that make the board's numbers exact rather than merely plausible.
// ---------------------------------------------------------------------------
async function loadStatutoryEngine({ statutory = null } = {}) {
  const html = await loadHtml();
  const start = html.indexOf('    const TROY_OZ_TO_GRAMS =');
  const end = html.indexOf('    const GOLD_RETAIL_PREMIUM =');
  assert.ok(start >= 0 && end > start, 'statutory block must be locatable');
  const helpersStart = html.indexOf('    function spotInBand(');
  const helpersEnd = html.indexOf('    function statutoryLabel(', helpersStart);
  assert.ok(helpersStart > start && helpersEnd > helpersStart, 'statutory helpers must be locatable');
  const sandbox = { Number, Math, Date, JSON, Infinity, state: { statutory } };
  vm.runInNewContext([
    html.slice(start, end),
    html.slice(helpersStart, helpersEnd),
    'globalThis.api = { DEFAULT_STATUTORY_RATES, INDIA_IMPORT_DUTY_MULTIPLIER, INDIA_GST_MULTIPLIER, statutoryRatesFor, importDutyMultiplier, gstMultiplier, spotInBand, acceptSpot, roundSpot, roundFxRate, statutoryIsStale, SPOT_BANDS };'
  ].join('\n'), sandbox);
  return sandbox.api;
}

test('statutory duty & GST match the current Indian law and are data-overridable', async () => {
  const api = await loadStatutoryEngine();
  // 15% effective import duty = 10% BCD + 5% AIDC (Customs Notification 16/2026, 13 May 2026),
  // and 3% GST (unchanged by the Sept-2025 GST 2.0 rationalisation) for BOTH bullion metals.
  assert.equal(api.DEFAULT_STATUTORY_RATES.gold.importDutyPct, 15);
  assert.equal(api.DEFAULT_STATUTORY_RATES.gold.gstPct, 3);
  assert.equal(api.DEFAULT_STATUTORY_RATES.silver.importDutyPct, 15);
  assert.equal(api.DEFAULT_STATUTORY_RATES.silver.gstPct, 3);
  assert.equal(api.INDIA_IMPORT_DUTY_MULTIPLIER, 1.15);
  assert.equal(api.INDIA_GST_MULTIPLIER, 1.03);
  assert.equal(api.importDutyMultiplier('gold'), 1.15);
  assert.equal(api.importDutyMultiplier('silver'), 1.15);
  assert.equal(api.gstMultiplier('gold'), 1.03);

  // The published data file must exist, parse, and agree with the compiled defaults.
  const policy = JSON.parse(await readFile(new URL('../catalog/statutory-rates.json', import.meta.url), 'utf8'));
  for (const metal of ['gold', 'silver']) {
    assert.equal(policy[metal].importDutyPct, api.DEFAULT_STATUTORY_RATES[metal].importDutyPct, metal);
    assert.equal(policy[metal].gstPct, api.DEFAULT_STATUTORY_RATES[metal].gstPct, metal);
    assert.match(policy[metal].effectiveFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(policy[metal].verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  }

  // A duty change is a data edit: an override replaces the compiled default for THAT metal only…
  const overridden = await loadStatutoryEngine({ statutory: { silver: { importDutyPct: 10, gstPct: 3 } } });
  assert.equal(overridden.importDutyMultiplier('silver'), 1.10);
  assert.equal(overridden.importDutyMultiplier('gold'), 1.15, 'gold must keep its own duty');
  // …and an out-of-range override is ignored rather than mispricing the shop.
  const garbage = await loadStatutoryEngine({ statutory: { gold: { importDutyPct: 0, gstPct: 3 } } });
  assert.equal(garbage.importDutyMultiplier('gold'), 1.15, 'a 0% duty is not a real Indian rate');
  const nonsense = await loadStatutoryEngine({ statutory: { gold: { importDutyPct: 900, gstPct: 3 } } });
  assert.equal(nonsense.importDutyMultiplier('gold'), 1.15);
  // A missing override must not be coerced to 0 (Number(null) === 0 regression guard).
  const empty = await loadStatutoryEngine({ statutory: {} });
  assert.equal(empty.importDutyMultiplier('gold'), 1.15);
  assert.equal(empty.statutoryRatesFor('gold').importDutyPct, 15);
  assert.equal(empty.statutoryRatesFor('silver').gstPct, 3);
});

test('price math applies duty then GST so GST is charged on the landed (duty-paid) value', async () => {
  const html = await loadHtml();
  const constStart = html.indexOf('    const TROY_OZ_TO_GRAMS =');
  const constEnd = html.indexOf('    const CITIES = {');
  const citiesStart = html.indexOf('    const CITIES = {');
  const citiesEnd = html.indexOf('    };', citiesStart) + '    };'.length;
  const helpersStart = html.indexOf('    function spotInBand(');
  const helpersEnd = html.indexOf('    function statutoryLabel(', helpersStart);
  const fnStart = html.indexOf('    function computeCityPrices(');
  const fnEnd = html.indexOf('    function formatIndianInt(', fnStart);
  const computeCityPrices = vm.runInNewContext([
    html.slice(constStart, constEnd),
    html.slice(citiesStart, citiesEnd),
    html.slice(helpersStart, helpersEnd),
    html.slice(fnStart, fnEnd),
    'computeCityPrices'
  ].join('\n'), {});

  const spotGold = 4100, spotSilver = 48, usdInr = 88;
  const p = computeCityPrices('cuttack', spotGold, spotSilver, usdInr);
  const landedGold = (spotGold * usdInr / 31.1034768) * 1.15;
  const landedSilver = (spotSilver * usdInr / 31.1034768) * 1.15;
  // ex-GST is the duty-paid landed value; GST is exactly 3% ON TOP of it (not on the raw spot).
  assert.equal(p.gold999ExGst, Math.round(landedGold * 10));
  assert.equal(p.gold999, Math.round(landedGold * 10 * 1.03));
  assert.equal(p.silver999ExGst, Math.round(landedSilver * 1000));
  assert.equal(p.silver999, Math.round(landedSilver * 1000 * 1.03));
  assert.ok(Math.abs(p.gold999 / p.gold999ExGst - 1.03) < 0.0001, 'incl-GST must be 3% above ex-GST');
  assert.ok(Math.abs(p.silver999 / p.silver999ExGst - 1.03) < 0.0001);
  // Per-gram tiles are the per-10g / per-kg prices divided consistently (no rounding drift).
  assert.ok(Math.abs(p.gold999ExGstGram * 10 - landedGold * 10) < 0.01);
  assert.ok(Math.abs(p.silver999ExGstGram * 1000 - landedSilver * 1000) < 0.01);
  // Alloy purities are exact fractions of the 999 base.
  assert.equal(p.gold916ExGst, Math.round(landedGold * 10 * 916 / 999));
  assert.equal(p.silver925ExGst, Math.round(landedSilver * 1000 * 925 / 999));

  // A silently wrong duty (the Number(null) → 0 bug) would make a ₹1.2 lakh board ~15% cheaper;
  // assert the magnitude so a regression cannot hide behind "close enough".
  assert.ok(p.gold999ExGst > 100000, `gold 999 per 10g looks unlanded: ${p.gold999ExGst}`);
});

test('out-of-domain and wild-jump quotes are rejected instead of repricing the board', async () => {
  const api = await loadStatutoryEngine();
  // Domain: gold USD/oz, silver USD/oz.
  assert.equal(api.acceptSpot(4100, 'gold', null).ok, true);
  assert.equal(api.acceptSpot(48, 'silver', null).ok, true);
  assert.equal(api.acceptSpot(4.1, 'gold', null).reason, 'band', 'a 100x-low gold print must be dropped');
  assert.equal(api.acceptSpot(41000, 'gold', null).reason, 'band');
  assert.equal(api.acceptSpot(0.48, 'silver', null).reason, 'band');
  assert.equal(api.acceptSpot(NaN, 'gold', null).reason, 'band');
  // Jump guard: no real session moves >12% in one print.
  assert.equal(api.acceptSpot(4500, 'gold', 4100).ok, true, 'a normal move must pass');
  assert.equal(api.acceptSpot(4100 * 1.2, 'gold', 4100).reason, 'move');
  assert.equal(api.acceptSpot(4100 * 0.7, 'gold', 4100).reason, 'move');
  // A missing previous value (cold start / offline restore) must not block a genuine quote.
  assert.equal(api.acceptSpot(4800, 'gold', null).ok, true);
  // Accepted values are normalized so a persisted snapshot restores exactly equal.
  assert.equal(api.acceptSpot(4100.123456789, 'gold', null).value, api.roundSpot(4100.123456789));
  assert.equal(api.roundSpot(4100.1) + 0, 4100.1);
  assert.equal(api.roundFxRate(92.1234567891), 92.123457);

  const html = await loadHtml();
  // The guard must be wired into BOTH live paths and must be per-metal (concurrent ladders).
  assert.ok(html.includes('acceptSpot(midPrice, \'gold\''), 'WS gold ticks must be guarded');
  assert.ok(html.includes('acceptSpot(midPrice, \'silver\''), 'WS silver ticks must be guarded');
  assert.ok(html.includes("const goldGuard = (val) => acceptSpot(val, 'gold'"), 'REST gold must be guarded');
  assert.ok(html.includes("const silverGuard = (val) => acceptSpot(val, 'silver'"), 'REST silver must be guarded');
  assert.ok(!html.includes('let spotGuard'), 'the guard must be a parameter, never shared module state');
  assert.match(html, /function raceTier\(tier, timeoutMs, guard = null\)/);
  assert.match(html, /function fetchFromTiers\(tiers, forceAll = false, onUpgrade = null, guard = null\)/);
  // The cached snapshot is validated before it can paint.
  const readStart = html.indexOf('    function readCachedRates(');
  const readEnd = html.indexOf('    function hydrateCachedRates(', readStart);
  const read = html.slice(readStart, readEnd);
  assert.ok(read.includes("spotInBand(cached.spotGold, 'gold')"), 'cached gold must be domain-checked');
  assert.ok(read.includes("validateUsdInr(cached.usdInr, null).ok"), 'cached FX must be validated');
});

test('a restored snapshot is never presented as a live price', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function hydrateCachedRates(');
  const end = html.indexOf('    async function fetchWithTimeout(', start);
  assert.ok(start >= 0 && end > start);
  const hydrate = html.slice(start, end);
  // Hydration restores the snapshot's OWN timestamp and provenance…
  assert.ok(hydrate.includes('state.live.cachedTs = Number.isFinite(cached.ts) ? cached.ts : null'));
  assert.ok(hydrate.includes('state.live.hydratedFromCache = true'));
  // …must not claim a live connection…
  assert.ok(!/connected\s*=\s*true/.test(hydrate), 'hydration must not mark the desk live');
  assert.ok(!/lastSync\s*=\s*new Date\(\)/.test(hydrate), 'hydration must not stamp "now" on old data');

  // …and the freshness label reports the age of the DATA, with a "not live" badge.
  const labelStart = html.indexOf('    function updateRatesUpdatedLabel()');
  const labelEnd = html.indexOf('    function buildRatesShareText(', labelStart);
  const label = html.slice(labelStart, labelEnd);
  assert.ok(label.includes('const liveTs = state.live && state.live.lastSync'), 'live time must be tracked separately');
  assert.ok(label.includes('const cacheTs = Number(state.live && state.live.cachedTs) || 0'), 'cache time must be used');
  assert.ok(label.includes('const fromCache = !liveTs'));
  assert.ok(label.includes('not live'), 'a restored board must say it is not live');
  assert.ok(label.includes('LIVE_TICK_FRESH_MS'), 'staleness must follow tick freshness');
  assert.match(html, /const LIVE_TICK_FRESH_MS = \d+ \* 1000;/);

  // Persisted snapshots are normalized and carry FX provenance + as-of.
  const persistStart = html.indexOf('    function persistCachedRates(');
  const persistEnd = html.indexOf('    // A restored snapshot is authoritative', persistStart);
  const persist = html.slice(persistStart, persistEnd);
  assert.ok(persist.includes('spotGold: roundSpot(spotGold)'), 'persist must normalize spot');
  assert.ok(persist.includes('usdInr: roundFxRate(usdInr)'), 'persist must normalize FX');
  assert.ok(persist.includes('fxSource: state.live.fxSource'), 'persist must keep FX provenance');
  assert.ok(persist.includes('usdInrAsOf: state.live.usdInrAsOf'), 'persist must keep the FX as-of');

  // A restored snapshot is also surfaced in the UI, not just internally.
  for (const id of ['cache-notice', 'cache-notice-text']) assert.ok(html.includes(`id="${id}"`), id);
});

test('the statutory duty/GST model flags a stale regime and refuses corrupt data', async () => {
  const api = await loadStatutoryEngine();
  // The compiled regime was verified on 13 May 2026, so it is not stale today…
  assert.equal(api.statutoryIsStale(Date.parse('2026-11-27T00:00:00Z')), false);
  // …but a year on it must ask for re-verification instead of trusting it silently.
  assert.equal(api.statutoryIsStale(Date.parse('2027-06-01T00:00:00Z')), true);

  const html = await loadHtml();
  // Loaded at boot and revalidated on a slow cadence.
  assert.ok(html.includes('loadStatutoryRates();'), 'boot must load the statutory data');
  assert.ok(html.includes('STATUTORY_MIN_REFRESH_MS'), 'statutory data must be revalidated');
  assert.ok(html.includes('STATUTORY_RATES_PATH = \'catalog/statutory-rates.json\''));
  // The loader refuses a corrupt/out-of-range policy file rather than pricing off it.
  const sanitizeStart = html.indexOf('    function sanitizeStatutoryPayload(');
  const sanitizeEnd = html.indexOf('    function readCachedStatutory(', sanitizeStart);
  const sanitize = html.slice(sanitizeStart, sanitizeEnd);
  assert.ok(sanitize.includes('duty > 60'), 'duty must be range-checked');
  assert.ok(sanitize.includes('gst > 30'), 'GST must be range-checked');
  assert.ok(sanitize.includes('return null'), 'an invalid payload must be rejected wholesale');
});

test('the price board cannot sit on stale numbers when the frame clock stalls', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function renderPriceCards(');
  const end = html.indexOf('    function renderGlobalFxStrip()', start);
  assert.ok(start >= 0 && end > start);
  const paint = html.slice(start, end);
  // A queued frame must always have a timer backstop, otherwise a backgrounded tab / powersave
  // browser keeps the old prices on screen while the desk already holds newer ones.
  assert.ok(paint.includes('queuePriceFrame()'), 'paints must go through the single queue helper');
  assert.match(paint, /priceRenderRaf\s*=\s*requestAnimationFrame\(flushPriceRender\);/);
  assert.ok(paint.includes('PRICE_PAINT_STALL_MS'), 'the stall fallback must be a named constant');
  assert.match(paint, /if \(priceRenderRaf\) flushPriceRender\(\)/, 'a stalled frame must fall back to a timer paint');

  const flushStart = html.indexOf('    function flushPriceRender()');
  const flushEnd = html.indexOf('    // --- RATE OF THE DAY', flushStart);
  const flush = html.slice(flushStart, flushEnd);
  // Flushing must clear the backstop timer so ordinary paints do not double-render.
  assert.ok(flush.includes('clearTimeout(priceThrottleTimer)'), 'flush must clear the stall timer');
  assert.match(html, /const PRICE_PAINT_STALL_MS = \d+;/);
});

test('exchange comparison and accuracy checker live only in the admin desk', async () => {
  const html = await loadHtml();
  // The customer storefront must not ship the admin views or their machinery at all.
  for (const marker of [
    'id="view-exchanges"', 'id="view-accuracy"', 'data-app-view="exchanges"', 'data-app-view="accuracy"',
    'renderExchangeComparison', 'renderMarketAccuracy', 'fetchMarketAccuracy', 'computeExchangeRows',
    'EXCHANGE_MARKETS', 'MARKET_FEEDS', 'state.exchanges', 'state.marketAccuracy'
  ]) {
    assert.ok(!html.includes(marker), `customer app must not contain ${marker}`);
  }
  assert.ok(!html.includes('data-admin-view-nav'), 'no admin-only nav hooks should remain');
  assert.ok(html.includes('id="mobile-nav-grid" class="grid grid-cols-5'));
  // The private admin desk still offers both sections.
  const adminHtml = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.ok(adminHtml.includes('data-view="exchanges"'), 'admin desk keeps Exchanges');
  assert.ok(adminHtml.includes('data-view="accuracy"'), 'admin desk keeps Accuracy');
  const adminJs = await readFile(new URL('../admin/app.js', import.meta.url), 'utf8');
  assert.ok(adminJs.includes('function renderExchangeComparison()'));
  assert.ok(adminJs.includes('function renderMarketAccuracy()'));
});


test('rates footer and shop introduction omit the removed copy', async () => {
  const html = await loadHtml();
  const footer = html.slice(html.indexOf('      <footer class="text-[11px]'), html.indexOf('      </footer>') + '      </footer>'.length);
  assert.ok(footer.includes('GSTIN: 21AFNPP7926E1ZC'));
  assert.ok(!footer.includes('footer-sources'));
  assert.ok(!footer.includes('Informational only'));
  assert.ok(!footer.includes('Priced with'));
  const hero = html.match(/<p class="shop-hero-sub">(.*?)<\/p>/)?.[1];
  assert.ok(hero?.includes('showroom pickup.'));
  assert.ok(!hero.includes('insured delivery'));
});


test('collection omits the removed certification and pricing statements', async () => {
  const html = await loadHtml();
  const start = html.indexOf('<section class="shop-gallery"');
  const end = html.indexOf('</section>', start);
  assert.ok(start >= 0 && end > start);
  const gallery = html.slice(start, end);
  assert.ok(gallery.includes('Our Collection'));
  assert.ok(gallery.includes('id="product-list"'));
  assert.ok(!gallery.includes('Every piece is BIS hallmarked'));
  assert.ok(!gallery.includes('Prices shown are indicative'));
});


test('rates footer shows only sync time and ticks/s alongside GSTIN', async () => {
  const html = await loadHtml();
  const footer = html.slice(html.indexOf('      <footer class="text-[11px]'), html.indexOf('      </footer>') + '      </footer>'.length);
  assert.ok(footer.includes('id="footer-sync-meta"'));
  assert.ok(footer.includes('GSTIN: 21AFNPP7926E1ZC'));
  assert.ok(!footer.includes('Live WS'));
  assert.ok(!footer.includes('Live Feed'));

  const fmtStart = html.indexOf('    function fmtTimeMs(');
  const fmtEnd = html.indexOf('    function escapeHtml(', fmtStart);
  const metaStart = html.indexOf('    function formatFooterSyncMeta(');
  const metaEnd = html.indexOf('    function renderPriceCardsNow(', metaStart);
  assert.ok(fmtStart >= 0 && fmtEnd > fmtStart && metaStart >= 0 && metaEnd > metaStart);

  let rendered = null;
  const state = {
    live: { lastSync: null },
    ws: { connected: false, ticksPerSec: 0 }
  };
  const el = { id: 'footer-sync-meta', textContent: '--:--:--.---' };
  const ctx = vm.createContext({
    Date,
    state,
    getEl: (id) => (id === 'footer-sync-meta' ? el : null),
    setText: (node, val) => { node.textContent = val; rendered = val; }
  });
  vm.runInContext(html.slice(fmtStart, fmtEnd) + '\n' + html.slice(metaStart, metaEnd), ctx);

  assert.equal(ctx.formatFooterSyncMeta(null, 0), '--:--:--.---');
  assert.equal(ctx.formatFooterSyncMeta(new Date('invalid'), 5), '--:--:--.---');

  const sample = new Date(2026, 10, 27, 18, 45, 12, 34);
  assert.equal(ctx.formatFooterSyncMeta(sample, 0), '18:45:12.034');
  assert.equal(ctx.formatFooterSyncMeta(sample, 4), '18:45:12.034 · 4 ticks/s');

  // Offline / cached state keeps placeholder.
  ctx.renderFooterSyncMeta();
  assert.equal(rendered, '--:--:--.---');

  // REST sync updates time without ticks when WS is disconnected.
  state.live.lastSync = sample;
  state.ws.ticksPerSec = 9;
  state.ws.connected = false;
  ctx.renderFooterSyncMeta();
  assert.equal(rendered, '18:45:12.034');

  // Connected WS appends ticks/s.
  state.ws.connected = true;
  ctx.renderFooterSyncMeta();
  assert.equal(rendered, '18:45:12.034 · 9 ticks/s');

  // Wiring checks: REST sync, price render, WS close, and WS disconnect all refresh the footer readout.
  const syncBody = html.slice(html.indexOf('async function syncLiveAPIs('), html.indexOf('function scheduleRetrySync('));
  assert.ok(syncBody.includes('renderFooterSyncMeta();'));
  const paintBody = html.slice(html.indexOf('function renderPriceCardsNow('), html.indexOf('function updateDeltaBadge('));
  assert.ok(paintBody.includes('renderFooterSyncMeta();'));
  const wsCloseBody = html.slice(html.indexOf('ws.onclose = () => {'), html.indexOf('function disconnectLiveWebSocket('));
  assert.ok(wsCloseBody.includes('renderFooterSyncMeta();'));
  const disconnectBody = html.slice(html.indexOf('function disconnectLiveWebSocket('), html.indexOf('function sanitizeStatutoryPayload('));
  assert.ok(disconnectBody.includes('renderFooterSyncMeta();'));
});


test('Rate of the Day is scoped to India (INR) mode and omits the caption line', async () => {
  const html = await loadHtml();
  const ratesStart = html.indexOf('<div id="view-rates"');
  const inrStart = html.indexOf('<section id="inr-rates-section"', ratesStart);
  const inrEnd = html.indexOf('</section>', inrStart);
  const usdStart = html.indexOf('<section id="usd-spot-section"', inrEnd);
  const usdEnd = html.indexOf('</section>', usdStart);
  assert.ok(ratesStart >= 0 && inrStart > ratesStart && inrEnd > inrStart && usdStart > inrEnd && usdEnd > usdStart);

  const beforeInr = html.slice(ratesStart, inrStart);
  const inrBoard = html.slice(inrStart, inrEnd);
  const usdBoard = html.slice(usdStart, usdEnd);

  assert.ok(!beforeInr.includes('id="rate-of-day-section"'), 'must not sit above India (INR) board');
  assert.ok(inrBoard.includes('id="rate-of-day-section"'), 'must live inside India (INR) board');
  assert.ok(!usdBoard.includes('id="rate-of-day-section"'), 'must not appear in Global Spot (USD) board');

  assert.ok(!html.includes('id="rate-of-day-caption"'), 'caption element must be removed');
  assert.ok(!inrBoard.includes('Retail ex-GST per gram'), 'caption text must be removed');
  assert.ok(inrBoard.includes('id="rate-of-day-date"'), 'capture time badge must remain');
});
