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
  assert.match(sw, /sj-price-desk-v6/);
  assert.match(sw, /index\.html/);
  assert.match(sw, /skipWaiting/);
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
  const swContext = {
    URL,
    self: {
      location: { origin: 'https://example.com' },
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: () => {},
      clients: { claim: () => {} }
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
    fmtUSD: (n) => '$' + Number(n).toFixed(2)
  };
  const build = vm.runInNewContext(`${source}\nbuildRatesShareText`, context);
  const text = build();
  for (const part of ['Satyanarayan Jewellers', 'Cuttack', 'Gold (per 10g', '999:', '916 (22K):', 'Silver (per kg', 'MCX estimate', 'Spot:', 'Indicative estimates']) {
    assert.ok(text.includes(part), part);
  }
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
  const expectedGoldBase = (4100 * 85 / 31.1034768) * 1.15 * 10 * 1.0317;
  const expectedMcxBase = (48 * 85 / 31.1034768) * 1.15 * 1000 * 1.0802;
  const expectedSilverBase = expectedMcxBase * 1.1462;
  assert.equal(cuttack.gold999ExGst, Math.round(expectedGoldBase));
  assert.equal(cuttack.gold916, Math.round(expectedGoldBase * 1.03 * 22 / 24));
  assert.equal(cuttack.silverMCXGst, Math.round(expectedMcxBase * 1.03));
  assert.equal(cuttack.silver925ExGst, Math.round(expectedSilverBase * 0.925));

  const delhi = computeCityPrices('delhi', 4100, 48, 85);
  assert.ok(delhi.gold999ExGst > cuttack.gold999ExGst);
});

test('jewellery collection supports image/video uploads with owner-only access and safe media URLs', async () => {
  const html = await loadHtml();
  const catalogJson = JSON.parse(await readFile(new URL('../catalog/products.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(catalogJson), 'catalog/products.json must be a JSON array');

  // Upload studio and owner modal stay hidden by default for regular visitors,
  // owner login is strictly GitHub token only (no device PIN bypass), and
  // fixed modals live outside </main> so .app-view transforms never trap/clip them.
  assert.match(html, /<section id="owner-studio" class="hidden /);
  assert.match(html, /<div id="owner-auth-modal" class="jewel-modal-backdrop hidden"/);
  assert.match(html, /<div id="product-lightbox" class="jewel-modal-backdrop hidden"/);
  assert.ok(!html.includes('owner-panel-pin'), 'PIN login panel should be removed (token-only owner access)');
  assert.ok(!html.includes('owner-tab-pin'), 'PIN login tab should be removed (token-only owner access)');
  const mainEndIdx = html.indexOf('</main>');
  assert.ok(mainEndIdx > 0);
  assert.ok(html.indexOf('id="owner-auth-modal"') > mainEndIdx, 'owner-auth-modal must be outside <main>/.app-view');
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
    `const CATALOG_REPO_OWNER = 'satyanarayanjewellery'; const CATALOG_REPO_NAME = 'shop';\n${html.slice(verStart, verEnd)}\nverifyGitHubToken`,
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
    productOwner: { unlocked: false, publishedItems: [{ id: 'pub-1' }], localItems: [{ id: 'loc-1' }] }
  });
  assert.deepEqual(Array.from(lockedItems, (x) => x.id), ['pub-1']);
  const unlockedItems = vm.runInNewContext(`${html.slice(visStart, visEnd)}\ngetVisibleCatalogItems()`, {
    productOwner: { unlocked: true, publishedItems: [{ id: 'pub-1' }], localItems: [{ id: 'loc-1' }] }
  });
  assert.deepEqual(Array.from(unlockedItems, (x) => x.id), ['loc-1', 'pub-1']);

  // Owner entry button stays hidden for customers until a secret reveal
  assert.match(html, /<button id="btn-owner-access" type="button" class="shop-owner-btn hidden"/);
  assert.ok(html.includes('.shop-owner-btn.hidden{display:none}'),
    'hidden rule must beat .shop-owner-btn display:inline-flex');
  assert.ok(html.includes('OWNER_ACCESS_REVEAL_KEY'), 'reveal state must persist per tab');
  assert.ok(html.includes("'#owner'"), 'secret #owner URL hash must reveal owner access');
  assert.ok(html.includes('OWNER_ACCESS_SECRET'), 'secret "owner" key sequence must reveal owner access');
  const lockIdx = html.indexOf("document.getElementById('btn-owner-lock')");
  assert.ok(lockIdx > 0 && html.slice(lockIdx, lockIdx + 400).includes('concealOwnerAccess()'),
    'Lock must re-hide owner access');

  // updateOwnerStudioUI() drives the owner button visibility
  const uiStart = html.indexOf('    function updateOwnerStudioUI()');
  const uiEnd = html.indexOf('    function revealOwnerAccess()', uiStart);
  assert.ok(uiStart >= 0 && uiEnd > uiStart);
  const runOwnerUi = (ownerState) => {
    const dom = makeFakeDom();
    const run = vm.runInNewContext(`${html.slice(uiStart, uiEnd)}\nupdateOwnerStudioUI`, {
      document: dom.document,
      productOwner: ownerState
    });
    run();
    return dom;
  };
  const baseOwnerState = () => ({
    unlocked: false,
    ghConnected: false,
    ghLogin: '',
    accessRevealed: false,
    publishedItems: [],
    localItems: []
  });

  const lockedDom = runOwnerUi(baseOwnerState());
  assert.equal(lockedDom.getNode('btn-owner-access').classList.hidden, true,
    'owner button must be hidden for regular visitors');
  assert.equal(lockedDom.getNode('owner-studio').classList.hidden, true);
  assert.equal(lockedDom.getNode('owner-mode-pill').classList.hidden, true);
  assert.equal(lockedDom.getNode('btn-owner-access-label').textContent, 'Owner');

  const revealedDom = runOwnerUi({ ...baseOwnerState(), accessRevealed: true });
  assert.equal(revealedDom.getNode('btn-owner-access').classList.hidden, false,
    'owner button must appear after the secret reveal');
  assert.equal(revealedDom.getNode('owner-studio').classList.hidden, true,
    'upload studio must stay hidden until owner mode is unlocked');

  const activeDom = runOwnerUi({ ...baseOwnerState(), unlocked: true, ghConnected: true });
  assert.equal(activeDom.getNode('btn-owner-access').classList.hidden, false,
    'owner button must stay visible while owner mode is active');
  assert.equal(activeDom.getNode('owner-mode-pill').classList.hidden, false);
  assert.equal(activeDom.getNode('btn-owner-access-label').textContent, 'Token Settings');

  // revealOwnerAccess()/concealOwnerAccess() flip the flag and persist it per tab
  const recStart = html.indexOf('    function revealOwnerAccess()');
  const recEnd = html.indexOf('    function renderPendingMediaPreviews(', recStart);
  assert.ok(recStart >= 0 && recEnd > recStart);
  const recStore = new Map();
  const recProductOwner = { accessRevealed: false };
  const recSessionStorage = {
    getItem: (k) => (recStore.has(k) ? recStore.get(k) : null),
    setItem: (k, v) => { recStore.set(k, String(v)); },
    removeItem: (k) => { recStore.delete(k); }
  };
  const { revealOwnerAccess, concealOwnerAccess } = vm.runInNewContext(
    `${html.slice(recStart, recEnd)}\n({ revealOwnerAccess, concealOwnerAccess })`,
    {
      productOwner: recProductOwner,
      sessionStorage: recSessionStorage,
      OWNER_ACCESS_REVEAL_KEY: 'sj_owner_access_revealed_v1',
      document: makeFakeDom().document,
      updateOwnerStudioUI: () => {}
    }
  );
  revealOwnerAccess();
  assert.equal(recProductOwner.accessRevealed, true);
  assert.equal(recSessionStorage.getItem('sj_owner_access_revealed_v1'), '1');
  concealOwnerAccess();
  assert.equal(recProductOwner.accessRevealed, false);
  assert.equal(recSessionStorage.getItem('sj_owner_access_revealed_v1'), null);
});
