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

  // Gemstone / Platinum / Diamond removed from shop filters and owner upload form
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

test('exchange comparison loads India import duty on foreign markets and never mislabels units', async () => {
  const html = await loadHtml();
  const constStart = html.indexOf('    const INDIA_IMPORT_DUTY_MULTIPLIER =');
  const constEnd = html.indexOf('    const BASIS_SYNC_MS', constStart);
  const marketsStart = html.indexOf('    const EXCHANGE_MARKETS = [');
  const marketsEnd = html.indexOf('    // =========================================================================\n    // MARKET FEEDS', marketsStart);
  const rowsStart = html.indexOf('    function computeExchangeRows(');
  const rowsEnd = html.indexOf('    function renderExchangeComparison(', rowsStart);
  assert.ok(constStart >= 0 && constEnd > constStart, 'duty constants must be locatable');
  assert.ok(marketsStart >= 0 && marketsEnd > marketsStart, 'exchange markets must be locatable');
  assert.ok(rowsStart >= 0 && rowsEnd > rowsStart, 'computeExchangeRows must be locatable');

  const { computeExchangeRows, EXCHANGE_MARKETS, INDIA_IMPORT_DUTY_MULTIPLIER } = vm.runInNewContext(
    [
      html.slice(constStart, constEnd),
      html.slice(marketsStart, marketsEnd),
      html.slice(rowsStart, rowsEnd),
      '({ computeExchangeRows, EXCHANGE_MARKETS, INDIA_IMPORT_DUTY_MULTIPLIER })'
    ].join('\n'),
    {
      TROY_OZ_TO_GRAMS: 31.1034768,
      CURRENCY_PER_USD: { USD: 1, AED: 3.6725, EUR: 0.92, GBP: 0.79, LBP: 89500 },
      Number,
      Math,
      Infinity
    }
  );

  const spotGold = 4100;
  const spotSilver = 48;
  const usdInr = 88;
  const CURRENCY_PER_USD = { USD: 1, AED: 3.6725, EUR: 0.92, GBP: 0.79, LBP: 89500, INR: 1 };
  const goldBase = (spotGold * usdInr / 31.1034768) * 1.15 * 10;
  const silverBase = (spotSilver * usdInr / 31.1034768) * 1.15 * 1000;
  const context = {
    state: {
      prices: { spotGold, spotSilver, usdInr, gold999ExGst: goldBase, silver999ExGst: silverBase },
      exchanges: { metal: 'gold', sortBy: 'diff' }
    }
  };
  const run = vm.runInNewContext(`(${computeExchangeRows.toString()})`, {
    ...context,
    EXCHANGE_MARKETS,
    TROY_OZ_TO_GRAMS: 31.1034768,
    CURRENCY_PER_USD: { USD: 1, AED: 3.6725, EUR: 0.92, GBP: 0.79, LBP: 89500, INR: 1 },
    INDIA_IMPORT_DUTY_MULTIPLIER,
    Infinity,
    Math
  });

  const goldRows = run();
  assert.ok(Array.isArray(goldRows) && goldRows.length > 10);
  assert.equal(goldRows[0].isShop, true, 'shop reference row comes first');
  assert.equal(goldRows[0].quoteMetal, 'gold');

  // Every row must equal global parity x basis x USD/INR x 15% duty, in INR per 10g.
  // (Every market is modeled from duty-free global spot, so duty applies to Indian venues too.)
  const expected = (market) => (spotGold / 31.1034768)
    * (1 + market.basisPct / 100)
    * (usdInr / (CURRENCY_PER_USD[market.currency] || 1))
    * 10
    * INDIA_IMPORT_DUTY_MULTIPLIER;

  const foreign = goldRows.find((r) => !r.isShop && r.currency !== 'INR');
  assert.ok(foreign, 'a non-INR gold market must exist');
  assert.ok(Math.abs(foreign.theirInr - expected(foreign)) < 1,
    `${foreign.name} must be duty-loaded: expected ${Math.round(expected(foreign))}, got ${Math.round(foreign.theirInr)}`);
  // Without the duty the same market would look ~13% cheaper than the shop — that was the bug.
  assert.ok(Math.abs(foreign.diffPct) < 3,
    `${foreign.name} must sit near the shop price, got ${foreign.diffPct.toFixed(2)}%`);

  // Indian exchanges keep their basis spread and must never collapse to a spot-only figure.
  // Before the USD→INR fix MCX showed ~₹1,300 per 10g against a ₹1,33,000 shop price (-99%).
  const inrMarket = goldRows.find((r) => !r.isShop && r.currency === 'INR');
  assert.ok(inrMarket, 'an Indian exchange must exist');
  assert.ok(Math.abs(inrMarket.theirInr - expected(inrMarket)) < 1,
    `${inrMarket.name} must be converted USD→INR (got ${Math.round(inrMarket.theirInr)})`);
  assert.ok(Math.abs(inrMarket.diffPct) < 1,
    `${inrMarket.name} should sit near the shop price, got ${inrMarket.diffPct.toFixed(2)}%`);

  // The comparison must not claim every market is cheaper than the shop.
  const cheaper = goldRows.filter((r) => !r.isShop && r.diffAmt < -1).length;
  const pricier = goldRows.filter((r) => !r.isShop && r.diffAmt > 1).length;
  assert.ok(cheaper > 0 && pricier > 0, `expected a mix of cheaper/pricier, got ${cheaper}/${pricier}`);
  assert.ok(cheaper < goldRows.length / 2, 'most markets must not be "cheaper than us"');

  // "Both" is not a quote bracket: every row still carries gold or silver.
  assert.ok(goldRows.every((r) => r.quoteMetal === 'gold' || r.quoteMetal === 'silver'));

  // Silver filter compares against the silver base and quotes per kg.
  const silverRows = vm.runInNewContext(`(${computeExchangeRows.toString()})`, {
    state: { prices: context.state.prices, exchanges: { metal: 'silver', sortBy: 'diff' } },
    EXCHANGE_MARKETS,
    TROY_OZ_TO_GRAMS: 31.1034768,
    CURRENCY_PER_USD: { USD: 1, AED: 3.6725, EUR: 0.92, GBP: 0.79, LBP: 89500, INR: 1 },
    INDIA_IMPORT_DUTY_MULTIPLIER,
    Infinity,
    Math
  })();
  assert.equal(silverRows[0].quoteMetal, 'silver');
  assert.ok(Math.abs(silverRows[0].theirInr - silverBase) < 1, 'shop silver row must use the silver base');
  // Bimetals are priced in gold; every other row in the silver view is silver.
  assert.ok(silverRows.some((r) => r.quoteMetal === 'silver' && !r.isShop));
  assert.ok(silverRows.every((r) => r.quoteMetal === 'silver' || r.metal === 'both'));
  const silverOnly = silverRows.find((r) => !r.isShop && r.metal === 'silver');
  if (silverOnly) {
    assert.ok(Math.abs(silverOnly.diffPct) < 3,
      `${silverOnly.name} must be compared against the silver base, got ${silverOnly.diffPct.toFixed(2)}%`);
  }

  // The 'Both' filter must stay reachable and list every venue (quoted in gold, one clean column).
  const bothRows = vm.runInNewContext(`(${computeExchangeRows.toString()})`, {
    state: { prices: context.state.prices, exchanges: { metal: 'both', sortBy: 'diff' } },
    EXCHANGE_MARKETS,
    TROY_OZ_TO_GRAMS: 31.1034768,
    CURRENCY_PER_USD: { USD: 1, AED: 3.6725, EUR: 0.92, GBP: 0.79, LBP: 89500, INR: 1 },
    INDIA_IMPORT_DUTY_MULTIPLIER,
    Infinity,
    Math
  })();
  assert.ok(bothRows.length > silverRows.length, "'Both' must list more venues than Silver");
  assert.ok(bothRows.every((r) => r.quoteMetal === 'gold'));

  // Row markup uses the quote bracket for the unit label (shop row per-kg in silver view).
  assert.ok(html.includes("const rowMetal = r.quoteMetal || (r.metal === 'silver' ? 'silver' : 'gold');"));
  assert.ok(html.includes("const unitLabel = rowMetal === 'gold' ? '/g' : '/kg';"));
  assert.ok(!html.includes('metalOfPrice'));
});

test('market accuracy loads import duty, reports variance with a sign, and repaints on calibrate', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    async function fetchMarketAccuracy(');
  const end = html.indexOf('    function renderMarketAccuracy(', start);
  assert.ok(start >= 0 && end > start);
  const src = html.slice(start, end);

  // Global quotes are landed at India's duty before comparing with the shop.
  assert.ok(/results\.push\(\{ \.\.\.f, type: 'live'[^\n]*\n?[^\n]*INDIA_IMPORT_DUTY_MULTIPLIER/.test(src)
    || src.includes('* INDIA_IMPORT_DUTY_MULTIPLIER'), 'live feeds must add import duty');
  assert.ok(src.includes('const consensusUsd = median(liveVals)'), 'consensus must be the median of live USD quotes');
  assert.ok(src.includes('const consensusInr = consensusUsd'), 'consensus must be converted to INR per unit');
  // Failed feeds are sorted last rather than treated as zero price.
  assert.ok(src.includes("Number.isFinite(b.theirInr) ? b.theirInr : -Infinity"));
  // Variance: positive means shop is above consensus (matches the documented meaning).
  assert.ok(src.includes('((shopBase - consensusInr) / consensusInr) * 100'));

  // Failed feed rows render an em dash, not ₹0 / +0.00%.
  assert.ok(html.includes("${ok ? fmtINR(r.theirInr, 0) : '—'}"));
  assert.ok(html.includes("acc-chip acc-chip-fail\">Failed</span>"));
  // Live feeds quote per ounce; modeled markets quote per gram / kilogram.
  assert.ok(html.includes("localUnit: '/oz'"));
  assert.ok(html.includes("const localUnit = r.localUnit || unit;"));

  // Calibration recomputes prices and accuracy KPIs immediately.
  const calibStart = html.indexOf('    function calibrateToMarket(');
  const calibEnd = html.indexOf('    function bindAccuracyControls(', calibStart);
  const calib = html.slice(calibStart, calibEnd);
  assert.ok(calib.includes('state.prices = computeCityPrices('), 'calibrate must re-price');
  assert.ok(calib.includes('ma.shopBase ='), 'calibrate must refresh the shop base');
  assert.ok(calib.includes('ma.variancePct ='), 'calibrate must refresh the variance');
  assert.ok(calib.includes('renderPriceCards(null, false)'), 'calibrate must repaint the rate board');

  // First open of the accuracy tab fetches and repaints (was blank until manual refresh).
  const switchStart = html.indexOf('function switchAppView(');
  const switchView = html.slice(switchStart, switchStart + 9000);
  assert.ok(/viewName === 'accuracy'[\s\S]{0,400}fetchMarketAccuracy\(false\)\.then\(/.test(switchView),
    'accuracy view must repaint after its first fetch');

  // Selecting a metal repaints after the new feeds resolve, not before.
  assert.ok(html.includes('fetchMarketAccuracy(false).then(renderMarketAccuracy)'));
});

test('Rate of the Day explains a missed noon window instead of waiting forever', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function renderRateOfDay(');
  const end = html.indexOf('    function renderPriceCards(', start);
  const fn = html.slice(start, end);
  assert.ok(fn.includes('const hour = new Date().getHours();'));
  assert.ok(fn.includes("hour < 12 ? 'Awaiting 12 PM'"));
  assert.ok(fn.includes('window has closed'), 'must explain the closed window');
  assert.ok(!fn.includes("dateEl.textContent = 'Awaiting 12 PM';\n"), 'must not always say Awaiting 12 PM');
});

test('Mintu flows open the chat panel and no dead view alias remains', async () => {
  const html = await loadHtml();
  // Ask Mintu buttons/tiles must land on the Tools view with the Mintu sub-tab active.
  assert.ok(!html.includes("switchAppView('agent')"), 'dead agent alias must not be used');
  const occurrences = html.match(/switchToolTab\('mintu'\)/g) || [];
  assert.ok(occurrences.length >= 4, 'quote, old-gold, old-silver and news flows must open Mintu');
});
