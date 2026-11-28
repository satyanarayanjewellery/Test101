import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const indexHtmlUrl = new URL('../index.html', import.meta.url);
const adminHtmlUrl = new URL('../admin/index.html', import.meta.url);
const adminCssUrl = new URL('../admin/styles.css', import.meta.url);
const adminJsUrl = new URL('../admin/app.js', import.meta.url);
const customerSwUrl = new URL('../sw.js', import.meta.url);
const adminSwUrl = new URL('../admin/sw.js', import.meta.url);

function loadAdminApi(overrides = {}) {
  const ctx = vm.createContext({
    URL,
    Date,
    Intl,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    TextEncoder,
    TextDecoder,
    AbortController,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    console,
    setTimeout,
    clearTimeout,
    ...overrides
  });
  return { ctx };
}

test('Security 1: GitHub token verification strictly requires explicit push === true (no public-repo bypass)', async () => {
  const html = await readFile(indexHtmlUrl, 'utf8');
  const adminJs = await readFile(adminJsUrl, 'utf8');

  // Extract customer verifyGitHubToken
  const verStart = html.indexOf('    async function verifyGitHubToken(');
  const verEnd = html.indexOf('    function blobToBase64(', verStart);
  assert.ok(verStart >= 0 && verEnd > verStart);
  const makeCustomerVerify = (mockFetch) => vm.runInNewContext(
    `const CATALOG_REPO_ADMIN = 'satyanarayanjewellery'; const CATALOG_REPO_NAME = 'shop';\n${html.slice(verStart, verEnd)}\nverifyGitHubToken`,
    { fetch: mockFetch }
  );

  // Load admin verifyGitHubToken
  const { ctx } = loadAdminApi();
  vm.runInContext(adminJs, ctx);
  const adminVerify = ctx.__ADMIN_PWA_API__.verifyGitHubToken;

  const maliciousResponses = [
    { label: 'missing permissions object (public repo)', payload: { full_name: 'satyanarayanjewellery/shop' } },
    { label: 'permissions without push key', payload: { permissions: { pull: true } } },
    { label: 'explicit push: false', payload: { permissions: { pull: true, push: false } } },
    { label: 'non-boolean truthy push', payload: { permissions: { pull: true, push: 'true' } } }
  ];

  for (const { label, payload } of maliciousResponses) {
    const mockFetch = async (url) => {
      if (url.includes('/repos/')) return { ok: true, status: 200, json: async () => payload };
      return { ok: true, status: 200, json: async () => ({ login: 'random-attacker' }) };
    };
    const customerVerify = makeCustomerVerify(mockFetch);
    await assert.rejects(
      customerVerify('ghp_attacker_token'),
      (e) => e.authError === true,
      `Customer verifyGitHubToken must reject ${label}`
    );
    await assert.rejects(
      adminVerify('ghp_attacker_token', mockFetch),
      (e) => e.authError === true,
      `Admin verifyGitHubToken must reject ${label}`
    );
  }

  // Positive case: explicit push: true passes
  const validFetch = async (url) => {
    if (url.includes('/repos/')) return { ok: true, status: 200, json: async () => ({ permissions: { pull: true, push: true } }) };
    return { ok: true, status: 200, json: async () => ({ login: 'satyanarayanjewellery' }) };
  };
  const custOk = await makeCustomerVerify(validFetch)('github_pat_admin');
  assert.equal(custOk.login, 'satyanarayanjewellery');
  const ownOk = await adminVerify('github_pat_admin', validFetch);
  assert.equal(ownOk.login, 'satyanarayanjewellery');
});

test('Security 2: Saved GitHub PAT is never prefilled into visible inputs and is cleared on lock/revocation', async () => {
  const html = await readFile(indexHtmlUrl, 'utf8');
  const adminJs = await readFile(adminJsUrl, 'utf8');

  // Customer modal must not prefill stored PAT into #admin-gh-token
  const openModalStart = html.indexOf('    function openAdminAuthModal()');
  const openModalEnd = html.indexOf('    function closeAdminAuthModal()', openModalStart);
  assert.ok(openModalStart >= 0 && openModalEnd > openModalStart);
  const openModalSrc = html.slice(openModalStart, openModalEnd);
  assert.ok(!openModalSrc.includes('productAdmin.ghToken || getStoredGitHubToken()'), 'openAdminAuthModal must not prefill PAT');
  assert.ok(openModalSrc.includes("tokenInput.value = '';"), 'openAdminAuthModal must clear token input');

  // Customer lock must clear in-memory token and reset password input
  const lockStart = html.indexOf("document.getElementById('btn-admin-lock')?.addEventListener");
  const lockEnd = html.indexOf("const dropzone = document.getElementById('product-dropzone');", lockStart);
  assert.ok(lockStart >= 0 && lockEnd > lockStart);
  const lockSrc = html.slice(lockStart, lockEnd);
  assert.ok(lockSrc.includes("productAdmin.ghToken = '';"), 'Customer lock must clear in-memory PAT');
  assert.ok(lockSrc.includes("tokenInput.type = 'password';"), 'Customer lock must reset input to password');

  // Admin app tryAutoRestoreSession must not prefill #auth-token-input
  const restoreStart = adminJs.indexOf('  async function tryAutoRestoreSession()');
  const restoreEnd = adminJs.indexOf('  function bindEvents()', restoreStart);
  assert.ok(restoreStart >= 0 && restoreEnd > restoreStart);
  const restoreSrc = adminJs.slice(restoreStart, restoreEnd);
  assert.ok(!restoreSrc.includes("$('auth-token-input').value = saved"), 'tryAutoRestoreSession must not prefill PAT into DOM');

  // Admin lockWorkspace must clear input, reset type=password, and clear in-memory token
  const ownLockStart = adminJs.indexOf('  function lockWorkspace(');
  const ownLockEnd = adminJs.indexOf('  async function tryAutoRestoreSession()', ownLockStart);
  assert.ok(ownLockStart >= 0 && ownLockEnd > ownLockStart);
  const ownLockSrc = adminJs.slice(ownLockStart, ownLockEnd);
  assert.ok(ownLockSrc.includes("tokenInp.value = '';"));
  assert.ok(ownLockSrc.includes("tokenInp.type = 'password';"));
  assert.ok(ownLockSrc.includes("state.admin.token = '';"));

  // Admin online handler must lock out revoked tokens on authError
  const onlineStart = adminJs.indexOf("window.addEventListener('online'");
  const onlineEnd = adminJs.indexOf("window.addEventListener('offline'", onlineStart);
  assert.ok(onlineStart >= 0 && onlineEnd > onlineStart);
  const onlineSrc = adminJs.slice(onlineStart, onlineEnd);
  assert.ok(onlineSrc.includes('if (err && err.authError)'), 'online re-check must detect authError');
  assert.ok(onlineSrc.includes('lockWorkspace(true)'), 'online re-check must lock out revoked token');
});

test('Security 3: Zero inline event handlers, external URL sanitization, referrer policy, and strict remote catalog media', async () => {
  const html = await readFile(indexHtmlUrl, 'utf8');
  const adminHtml = await readFile(adminHtmlUrl, 'utf8');
  const adminJs = await readFile(adminJsUrl, 'utf8');

  // Referrer policies in both PWAs
  assert.ok(html.includes('<meta name="referrer" content="strict-origin-when-cross-origin" />'));
  assert.ok(adminHtml.includes('<meta name="referrer" content="no-referrer" />'));

  // Zero inline on*= event handler attributes in HTML & templates
  const inlineHandlerRe = /\son(?:error|click|load|mouseover|focus|blur|submit|change|input)\s*=/i;
  assert.equal(inlineHandlerRe.test(html), false, 'index.html must not contain inline on*= event handlers');
  assert.equal(inlineHandlerRe.test(adminHtml), false, 'admin/index.html must not contain inline on*= event handlers');
  assert.equal(inlineHandlerRe.test(adminJs), false, 'admin/app.js must not contain inline on*= event handlers');

  // Test sanitizeExternalUrl from index.html
  const sanStart = html.indexOf('    function sanitizeExternalUrl(');
  const sanEnd = html.indexOf('    function sanitizeImgUrl(', sanStart);
  assert.ok(sanStart >= 0 && sanEnd > sanStart);
  const sanitizeExternalUrl = vm.runInNewContext(`${html.slice(sanStart, sanEnd)}\nsanitizeExternalUrl`, { URL });
  assert.equal(sanitizeExternalUrl('https://economictimes.indiatimes.com/news'), 'https://economictimes.indiatimes.com/news');
  assert.equal(sanitizeExternalUrl('http://example.com/article'), 'http://example.com/article');
  assert.equal(sanitizeExternalUrl('javascript:alert(1)'), '#');
  assert.equal(sanitizeExternalUrl('JAVASCRIPT:alert(1)'), '#');
  assert.equal(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>'), '#');
  assert.equal(sanitizeExternalUrl('vbscript:msgbox(1)'), '#');
  assert.equal(sanitizeExternalUrl('//evil.example/phish'), '#');
  assert.equal(sanitizeExternalUrl(''), '#');
  assert.equal(sanitizeExternalUrl(null), '#');

  // Remote catalog manifest loaders must only accept CATALOG_MEDIA_PREFIX (no remote blob:/data:)
  const custLoadStart = html.indexOf('    async function loadPublishedCatalog(');
  const custLoadEnd = html.indexOf('    async function ensureProductsLoaded(', custLoadStart);
  assert.ok(html.slice(custLoadStart, custLoadEnd).includes('clean.startsWith(CATALOG_MEDIA_PREFIX)'));

  const ownLoadStart = adminJs.indexOf('  async function loadPublishedCatalog()');
  const ownLoadEnd = adminJs.indexOf('  async function refreshAllCatalog()', ownLoadStart);
  assert.ok(adminJs.slice(ownLoadStart, ownLoadEnd).includes('clean.startsWith(CATALOG_MEDIA_PREFIX)'));
});

test('Bug Fix 1: Cold-load FX hedges in both PWAs always settle even when daily fails before live rejects', async () => {
  // 1. Customer index.html fetchFxWithHedge
  const html = await readFile(indexHtmlUrl, 'utf8');
  const hedgeStart = html.indexOf('    function fetchFxWithHedge()');
  const hedgeEnd = html.indexOf('    function refreshLiveFx(', hedgeStart);
  assert.ok(hedgeStart >= 0 && hedgeEnd > hedgeStart);

  const runCustomerHedge = (fetchFromTiers) => vm.runInNewContext(
    `const FX_TIERS = [[{name:'live'}], [{name:'daily'}]];
     const FX_DAILY_HEDGE_MS = 20;
     function commitFxRate() {}
     ${html.slice(hedgeStart, hedgeEnd)}
     fetchFxWithHedge()`,
    { fetchFromTiers, setTimeout, clearTimeout, Promise }
  );

  // Race: hedge fires at 20ms -> daily rejects at 30ms -> live rejects at 60ms.
  // Previously hung forever! Must settle to null cleanly.
  const custNull = await Promise.race([
    runCustomerHedge((tiers) => new Promise((_, reject) => {
      const isLive = tiers[0][0].name === 'live';
      setTimeout(() => reject(new Error('down')), isLive ? 60 : 10);
    })),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Customer fetchFxWithHedge hung!')), 400))
  ]);
  assert.equal(custNull, null, 'Customer fetchFxWithHedge must settle to null when daily fails before live fails');

  // 2. Admin admin/app.js refreshLiveFx
  const adminJs = await readFile(adminJsUrl, 'utf8');
  const fastAdminJs = adminJs.replace('const FX_DAILY_HEDGE_MS = 700;', 'const FX_DAILY_HEDGE_MS = 20;');
  const { ctx } = loadAdminApi({
    fetch: (url) => new Promise((_, reject) => {
      const isLive = /currency-converter\.live|fxapi\.app/.test(url);
      setTimeout(() => reject(new Error('offline')), isLive ? 60 : 5);
    })
  });
  vm.runInContext(fastAdminJs, ctx);
  const api = ctx.__ADMIN_PWA_API__;
  const ownRes = await Promise.race([
    api.refreshLiveFx(true),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Admin refreshLiveFx hung!')), 500))
  ]);
  assert.equal(ownRes, null, 'Admin refreshLiveFx must settle cleanly when offline');
  assert.equal(api.state.live.fxInFlight, null, 'Admin fxInFlight lock must be released after failure');
});

test('Bug Fix 2: Admin silver accuracy unit, statutory preview city parity, IST date stamping, and h23 midnight clock', async () => {
  const html = await readFile(indexHtmlUrl, 'utf8');
  const adminJs = await readFile(adminJsUrl, 'utf8');

  // Silver indicative row in fetchMarketAccuracy uses /g (matching theirInr / 1000)
  const accStart = adminJs.indexOf('  async function fetchMarketAccuracy(');
  const accEnd = adminJs.indexOf('  function renderMarketAccuracy()', accStart);
  assert.ok(accStart >= 0 && accEnd > accStart);
  const accSrc = adminJs.slice(accStart, accEnd);
  assert.ok(accSrc.includes("localUnit: '/g'"), 'Silver indicative per-gram row must use /g, not /kg');
  assert.ok(!accSrc.includes("localUnit: metal === 'gold' ? '/g' : '/kg'"));

  // Statutory preview compares Cuttack current vs Cuttack preview (no city mismatch)
  const prevStart = adminJs.indexOf('  function renderStatutoryPreview()');
  const prevEnd = adminJs.indexOf('  function renderStatutoryNotice()', prevStart);
  assert.ok(prevStart >= 0 && prevEnd > prevStart);
  const prevSrc = adminJs.slice(prevStart, prevEnd);
  assert.ok(prevSrc.includes("const current = computeCityPrices('cuttack'"), 'Statutory preview must compare Cuttack current vs Cuttack preview');

  // IST date stamp rolls over at 00:00 IST (18:30 UTC), not 00:00 UTC
  const { ctx } = loadAdminApi();
  vm.runInContext(adminJs, ctx);
  const todayIstIso = ctx.__ADMIN_PWA_API__.todayIstIso;
  // 2026-11-27T20:00:00Z is 2026-11-28 01:30 AM IST
  assert.equal(todayIstIso(new Date('2026-11-27T20:00:00Z')), '2026-11-28');
  // 2026-11-27T18:00:00Z is 2026-11-27 11:30 PM IST
  assert.equal(todayIstIso(new Date('2026-11-27T18:00:00Z')), '2026-11-27');

  // Midnight hour handling uses hourCycle: 'h23' and % 24
  assert.ok(adminJs.includes("hourCycle: 'h23'"));
  assert.ok(adminJs.includes('% 24'));
  assert.ok(html.includes("hourCycle: 'h23'"));
});

test('Bug Fix 3: Dynamic statutory GST in Calculator, Lightbox & Mintu; empty catalog count; lightbox ObjectURL isolation; HTTP 422 retry', async () => {
  const html = await readFile(indexHtmlUrl, 'utf8');
  const adminJs = await readFile(adminJsUrl, 'utf8');

  // Calculator uses statutoryRatesFor dynamically when available
  const calcStart = html.indexOf('    function getPerGramPrice(');
  const calcEnd = html.indexOf('    function switchToolTab(', calcStart);
  assert.ok(calcStart >= 0 && calcEnd > calcStart);
  const nodes = new Map();
  const fakeDoc = {
    getElementById: (id) => {
      if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, textContent: '' });
      return nodes.get(id);
    }
  };
  fakeDoc.getElementById('calc-metal').value = '22K';
  fakeDoc.getElementById('calc-weight').value = '10';
  fakeDoc.getElementById('calc-unit').value = 'g';
  fakeDoc.getElementById('calc-making').value = '10';
  fakeDoc.getElementById('calc-making-type').value = 'pct';
  fakeDoc.getElementById('calc-gst-toggle').checked = true;

  const qDynamic = vm.runInNewContext(`${html.slice(calcStart, calcEnd)}\ncomputeQuote()`, {
    state: { prices: { gold916ExGstGram: 10000 } },
    TROY_OZ_TO_GRAMS: 31.1034768,
    statutoryRatesFor: () => ({ importDutyPct: 15, gstPct: 5 }),
    fmtINR: (n) => `₹${Math.round(n)}`,
    document: fakeDoc
  });
  assert.equal(qDynamic.gstPct, 5, 'Calculator must adopt dynamic statutory GST%');
  assert.equal(qDynamic.gstAmount, Math.round((100000 + 10000) * 0.05));

  // Empty catalog shows "0 pieces" once loaded instead of "Collection loading…" forever
  assert.ok(html.includes("resultsEl.textContent = productAdmin.catalogLoaded ? '0 pieces' : 'Collection loading…';"));

  // Lightbox ObjectURL pools are isolated and revoked on close in both PWAs
  assert.ok(html.includes('lightboxObjectUrls: []'));
  assert.ok(html.includes('function revokeLightboxObjectUrls()'));
  assert.ok(html.includes('resolveItemMediaList(item, productAdmin.lightboxObjectUrls)'));
  assert.ok(adminJs.includes('lightboxObjectUrls: []'));
  assert.ok(adminJs.includes('function revokeLightboxObjectUrls()'));
  assert.ok(adminJs.includes('resolveDisplayMedia(item, state.admin.lightboxObjectUrls)'));

  // Media PUT retries with existing sha on HTTP 422 in both PWAs
  assert.ok(html.includes('/HTTP 422|"sha" wasn\'t supplied/i'));
  assert.ok(adminJs.includes('/HTTP 422|"sha" wasn\'t supplied/i'));
});

test('Bug Fix 4: Both Service Workers normalize ?t= cache keys and never return undefined offline', async () => {
  for (const [label, swUrl] of [['customer sw.js', customerSwUrl], ['admin/sw.js', adminSwUrl]]) {
    const swCode = await readFile(swUrl, 'utf8');
    const listeners = {};
    const cacheStore = new Map();
    const cacheApi = {
      put: async (k, v) => { cacheStore.set(typeof k === 'string' ? k : k.url, v); },
      match: async (k) => cacheStore.get(typeof k === 'string' ? k : k.url)
    };
    let fetchMode = 'online';
    const ctx = {
      URL,
      Response,
      self: {
        location: { origin: 'https://example.com' },
        addEventListener: (t, fn) => { listeners[t] = fn; },
        skipWaiting: () => {},
        clients: { claim: () => {} }
      },
      caches: {
        open: async () => cacheApi,
        match: async (k) => cacheStore.get(typeof k === 'string' ? k : k.url),
        keys: async () => [],
        delete: async () => true
      },
      fetch: async (req) => {
        if (fetchMode === 'offline') throw new Error('network down');
        if (fetchMode === 'http-error') return { ok: false, status: 503, type: 'basic', body: 'upstream unavailable' };
        const body = req.url.includes('products.json') ? '[{"id":"p1"}]' : '{"gold":{"importDutyPct":15}}';
        return { ok: true, status: 200, type: 'basic', body, clone() { return { ...this }; } };
      }
    };
    vm.runInNewContext(swCode, ctx);

    // 1. Online fetch with ?t=111 caches under normalized pathname (no ?t= pollution)
    let p;
    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/catalog/statutory-rates.json?t=111' },
      respondWith: (resP) => { p = resP; }
    });
    const onlineStat = await p;
    assert.equal(onlineStat.body, '{"gold":{"importDutyPct":15}}', `${label}: online statutory`);
    assert.ok(cacheStore.has('/shop/catalog/statutory-rates.json'), `${label}: statutory cached by pathname`);

    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/catalog/products.json?t=111' },
      respondWith: (resP) => { p = resP; }
    });
    await p;
    assert.ok(cacheStore.has('/shop/catalog/products.json'), `${label}: products cached by pathname`);

    // HTTP errors resolve fetch() rather than rejecting it. They must still fall back to the last
    // good policy/catalog response instead of surfacing a 503 or replacing the cached copy.
    fetchMode = 'http-error';
    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/catalog/statutory-rates.json?t=err' },
      respondWith: (resP) => { p = resP; }
    });
    const failedStat = await p;
    assert.equal(failedStat.body, '{"gold":{"importDutyPct":15}}', `${label}: HTTP statutory error uses cached data`);
    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/catalog/products.json?t=err' },
      respondWith: (resP) => { p = resP; }
    });
    const failedProducts = await p;
    assert.equal(failedProducts.body, '[{"id":"p1"}]', `${label}: HTTP catalog error uses cached data`);
    assert.equal(cacheStore.get('/shop/catalog/statutory-rates.json').body, '{"gold":{"importDutyPct":15}}', `${label}: bad policy response never poisons cache`);
    assert.equal(cacheStore.get('/shop/catalog/products.json').body, '[{"id":"p1"}]', `${label}: bad catalog response never poisons cache`);

    // 2. Offline fetch with a DIFFERENT ?t=222 hits the cached pathname!
    fetchMode = 'offline';
    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/catalog/statutory-rates.json?t=222' },
      respondWith: (resP) => { p = resP; }
    });
    const offlineStat = await p;
    assert.equal(offlineStat.body, '{"gold":{"importDutyPct":15}}', `${label}: offline statutory cache hit despite ?t=222`);

    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/catalog/products.json?t=222' },
      respondWith: (resP) => { p = resP; }
    });
    const offlineProd = await p;
    assert.equal(offlineProd.body, '[{"id":"p1"}]', `${label}: offline products cache hit despite ?t=222`);

    // 3. Offline uncached asset and navigation return a valid 503 Response, never undefined
    listeners.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'https://example.com/shop/' },
      respondWith: (resP) => { p = resP; }
    });
    const offlineNav = await p;
    assert.ok(offlineNav && offlineNav.status === 503, `${label}: uncached offline navigate returns 503 Response`);

    listeners.fetch({
      request: { method: 'GET', mode: 'cors', url: 'https://example.com/shop/missing-asset.png' },
      respondWith: (resP) => { p = resP; }
    });
    const offlineAsset = await p;
    assert.ok(offlineAsset && offlineAsset.status === 503, `${label}: uncached offline asset returns 503 Response`);
  }
});

test('Bug Fix 5: Admin HTML/CSS have zero undefined CSS variables and all md-span grid utilities are defined', async () => {
  const adminHtml = await readFile(adminHtmlUrl, 'utf8');
  const adminCss = await readFile(adminCssUrl, 'utf8');

  // Every var(--foo) used in admin/index.html and admin/styles.css must be defined in admin/styles.css
  const definedVars = new Set([...adminCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  const usedVars = new Set([
    ...[...adminHtml.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]),
    ...[...adminCss.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1])
  ]);
  const missingVars = [...usedVars].filter((v) => !definedVars.has(v));
  assert.deepEqual(missingVars, [], `Undefined CSS variables in Admin PWA: ${missingVars.join(', ')}`);

  // Every md-span-* class referenced in admin/index.html must be defined in admin/styles.css
  const usedSpans = new Set([...adminHtml.matchAll(/\b(md-span-\d+)\b/g)].map((m) => m[1]));
  for (const cls of usedSpans) {
    assert.ok(adminCss.includes(`.${cls}`), `admin/styles.css must define .${cls}`);
  }
});
