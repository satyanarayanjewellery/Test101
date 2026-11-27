import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const OWNER_DIR = path.join(ROOT, 'owner');

const ownerHtml = fs.readFileSync(path.join(OWNER_DIR, 'index.html'), 'utf8');
const ownerCss = fs.readFileSync(path.join(OWNER_DIR, 'styles.css'), 'utf8');
const ownerJs = fs.readFileSync(path.join(OWNER_DIR, 'app.js'), 'utf8');
const ownerSw = fs.readFileSync(path.join(OWNER_DIR, 'sw.js'), 'utf8');
const ownerManifestRaw = fs.readFileSync(path.join(OWNER_DIR, 'manifest.webmanifest'), 'utf8');
const rootSw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const rootManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const customerHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function loadOwnerApi() {
  const sandbox = {
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    Intl,
    RegExp,
    Error,
    Promise,
    URL,
    TextEncoder,
    TextDecoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(ownerJs, sandbox, { filename: 'owner/app.js' });
  return sandbox.__OWNER_PWA_API__;
}

test('1. Owner manifest is valid, independent from customer PWA, and references existing icons & views', () => {
  const manifest = JSON.parse(ownerManifestRaw);
  assert.equal(manifest.short_name, 'SJ Owner');
  assert.notEqual(manifest.name, rootManifest.name);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.id, './index.html');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

  const sizes = new Set(manifest.icons.map((i) => i.sizes));
  assert.ok(sizes.has('192x192'), 'Expected 192x192 icon');
  assert.ok(sizes.has('512x512'), 'Expected 512x512 icon');
  assert.ok(manifest.icons.some((i) => String(i.purpose || '').includes('maskable')), 'Expected maskable icon');

  for (const icon of manifest.icons) {
    const abs = path.join(OWNER_DIR, icon.src);
    assert.ok(fs.existsSync(abs), `Missing icon file ${icon.src}`);
    assert.ok(fs.statSync(abs).size > 2000, `Icon file ${icon.src} unexpectedly small`);
  }
  assert.ok(fs.existsSync(path.join(OWNER_DIR, 'icons/apple-touch-icon.png')));

  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3);
  for (const sc of manifest.shortcuts) {
    const match = String(sc.url || '').match(/#([a-z]+)$/);
    assert.ok(match, `Shortcut ${sc.name} should target a view hash`);
    assert.ok(ownerHtml.includes(`id="view-${match[1]}"`), `Missing view container for shortcut #${match[1]}`);
  }
});

test('2. Owner Service Worker and Customer Service Worker have isolated scopes and cache namespaces', () => {
  assert.doesNotThrow(() => new vm.Script(ownerSw, { filename: 'owner/sw.js' }));
  assert.doesNotThrow(() => new vm.Script(rootSw, { filename: 'sw.js' }));

  assert.match(ownerSw, /const CACHE = 'sj-owner-desk-v1'/);
  assert.match(ownerSw, /key\.startsWith\('sj-owner-desk-'\)/, 'Owner SW should only delete its own cache namespace');
  assert.match(ownerSw, /SKIP_WAITING/, 'Owner SW should support controlled update reload');
  assert.match(ownerSw, /catalog\/products\.json/);
  assert.match(ownerSw, /catalog\/statutory-rates\.json/);

  assert.match(rootSw, /url\.pathname\.includes\('\/owner\/'\)/, 'Customer SW must bypass /owner/ routes');
  assert.match(rootSw, /!key\.startsWith\('sj-owner-desk-'\)/, 'Customer SW must preserve owner caches');
});

test('3. Owner HTML locks workspace behind auth gate by default and includes PWA + noindex metadata', () => {
  assert.match(ownerHtml, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(ownerHtml, /<link rel="manifest" href="manifest\.webmanifest"/);
  assert.match(ownerHtml, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(ownerHtml, /<link rel="stylesheet" href="styles\.css"/);
  assert.match(ownerHtml, /<script src="app\.js" defer><\/script>/);

  // Auth gate is visible by default; owner app shell is hidden until GitHub PAT verification.
  assert.match(ownerHtml, /<section id="auth-gate" class="auth-gate"/);
  assert.match(ownerHtml, /<div id="owner-app" class="hidden">/);

  // Every static DOM element referenced via $('...') in owner/app.js must exist in owner/index.html.
  const idsInHtml = new Set([...ownerHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const idsInJs = new Set([...ownerJs.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  const missingIds = [...idsInJs].filter((id) => !idsInHtml.has(id));
  assert.deepEqual(missingIds, [], `DOM IDs referenced in owner/app.js missing from owner/index.html: ${missingIds.join(', ')}`);

  // All five workspace views exist.
  for (const view of ['desk', 'catalog', 'exchanges', 'accuracy', 'settings']) {
    assert.ok(ownerHtml.includes(`id="view-${view}"`), `Missing #view-${view}`);
  }

  // Stylesheet is non-trivial and includes safe-area + print + reduced-motion rules.
  assert.ok(ownerCss.includes('safe-area-inset-bottom'));
  assert.ok(ownerCss.includes('@media print'));
  assert.ok(ownerCss.includes('prefers-reduced-motion'));
});

test('4. Owner app.js parses cleanly and matches Customer Desk bullion pricing math exactly', () => {
  assert.doesNotThrow(() => new vm.Script(ownerJs, { filename: 'owner/app.js' }));
  const api = loadOwnerApi();
  assert.ok(api, 'Expected __OWNER_PWA_API__ to be exposed');

  const prices = api.computeCityPrices('cuttack', 3200, 34.5, 86.5);
  const expectedGoldPerG = ((3200 * 86.5) / 31.1034768) * 1.15;
  assert.equal(prices.gold999ExGst, Math.round(expectedGoldPerG * 10));
  assert.equal(prices.gold999, Math.round(expectedGoldPerG * 10 * 1.03));
  assert.equal(prices.gold916ExGst, Math.round(expectedGoldPerG * 10 * (916 / 999)));
  assert.equal(prices.gold18ExGst, Math.round(expectedGoldPerG * 10 * (750 / 999)));

  const expectedSilverPerG = ((34.5 * 86.5) / 31.1034768) * 1.15;
  assert.equal(prices.silver999ExGst, Math.round(expectedSilverPerG * 1000));
  assert.equal(prices.silver999, Math.round(expectedSilverPerG * 1000 * 1.03));
  assert.equal(prices.silver925ExGst, Math.round(expectedSilverPerG * 1000 * (925 / 999)));

  // Calibration offset scales spot properly.
  const calPrices = api.computeCityPrices('cuttack', 3200, 34.5, 86.5, { calibPctGold: 1 });
  assert.ok(calPrices.gold999ExGst > prices.gold999ExGst);
  assert.equal(calPrices.silver999ExGst, prices.silver999ExGst);
});

test('5. Owner media resolver translates canonical catalog/media paths safely for /owner/ display', () => {
  const api = loadOwnerApi();
  assert.equal(api.sanitizeCatalogMediaUrl('catalog/media/prod-1-0.webp'), 'catalog/media/prod-1-0.webp');
  assert.equal(api.toOwnerMediaSrc('catalog/media/prod-1-0.webp'), '../catalog/media/prod-1-0.webp');
  assert.equal(api.toOwnerMediaSrc('blob:https://satyanarayanjewellery.github.io/abc'), 'blob:https://satyanarayanjewellery.github.io/abc');

  // Block path traversal, XSS, or external URLs.
  assert.equal(api.toOwnerMediaSrc('javascript:alert(1)'), '');
  assert.equal(api.toOwnerMediaSrc('../etc/passwd'), '');
  assert.equal(api.toOwnerMediaSrc('https://evil.example/img.jpg'), '');
  assert.equal(api.toOwnerMediaSrc('catalog/media/../../secret.json'), '');
});

test('6. Statutory duty/GST validator enforces safe ranges & ISO dates and previews live impact', () => {
  const api = loadOwnerApi();

  const ok = api.validateStatutoryDraft({
    gold: { importDutyPct: 6, gstPct: 3, effectiveFrom: '2026-12-01', verifiedOn: '2026-12-01', note: 'Test budget cut' },
    silver: { importDutyPct: 6, gstPct: 3, effectiveFrom: '2026-12-01', verifiedOn: '2026-12-01', note: 'Test budget cut' }
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.gold.importDutyPct, 6);

  const cur = api.computeCityPrices('cuttack', 3200, 34.5, 86.5);
  const cut = api.computeCityPrices('cuttack', 3200, 34.5, 86.5, { statutory: ok.payload });
  assert.ok(cut.gold999 < cur.gold999, 'Lower customs duty should reduce landed gold rate');

  const badDuty = api.validateStatutoryDraft({
    gold: { importDutyPct: 95, gstPct: 3, effectiveFrom: '2026-12-01', verifiedOn: '2026-12-01' },
    silver: { importDutyPct: 15, gstPct: 3, effectiveFrom: '2026-12-01', verifiedOn: '2026-12-01' }
  });
  assert.equal(badDuty.ok, false);

  const badDate = api.validateStatutoryDraft({
    gold: { importDutyPct: 15, gstPct: 3, effectiveFrom: 'not-a-date', verifiedOn: '2026-12-01' },
    silver: { importDutyPct: 15, gstPct: 3, effectiveFrom: '2026-12-01', verifiedOn: '2026-12-01' }
  });
  assert.equal(badDate.ok, false);
});

test('7. Counter Quote, Old Exchange, Exchange Comparison & Share Broadcast formulas work accurately', () => {
  const api = loadOwnerApi();
  const prices = api.computeCityPrices('cuttack', 3200, 34.5, 86.5);

  const quote = api.computeQuoteMath({
    metal: '22K', weight: 10, unit: 'g', makingVal: 12, makingType: 'pct', includeGst: true
  }, prices);
  assert.equal(quote.grams, 10);
  assert.equal(quote.baseValue, Math.round(prices.gold916ExGstGram * 10));
  assert.equal(quote.makingCharges, Math.round(quote.baseValue * 0.12));
  assert.equal(quote.gstAmount, Math.round((quote.baseValue + quote.makingCharges) * 0.03));
  assert.equal(quote.grandTotal, quote.baseValue + quote.makingCharges + quote.gstAmount);

  const exHallmarked = api.computeOldExchangeMath({
    metal: 'gold', purity: 91.6, weight: 10, stone: 1, hallmarked: true, newBill: 100000
  }, prices);
  assert.equal(exHallmarked.netGrams, 9);
  assert.equal(exHallmarked.deductPct, 0);
  assert.equal(exHallmarked.hasBill, true);

  const exNonHallmarked = api.computeOldExchangeMath({
    metal: 'gold', purity: 91.6, weight: 10, stone: 1, hallmarked: false, newBill: 0
  }, prices);
  assert.equal(exNonHallmarked.deductPct, 30);
  assert.ok(exNonHallmarked.netValue < exHallmarked.netValue);

  const rows = api.computeExchangeRows(prices, 'gold', 'diff');
  assert.ok(Array.isArray(rows) && rows.length >= 90);
  assert.equal(rows[0].isShop, true);
  assert.equal(rows[0].name, 'Satyanarayan Jewellers');
  assert.equal(rows[0].diffPct, 0);

  const shareText = api.buildRatesShareText(prices, 'cuttack');
  assert.match(shareText, /Satyanarayan Jewellers — Cuttack, Odisha/);
  assert.match(shareText, /916 \(22K\)/);
  assert.match(shareText, /21AFNPP7926E1ZC/);
});

test('8. GitHub token verification strictly enforces write permission to satyanarayanjewellery/shop', async () => {
  const api = loadOwnerApi();

  // Rejects empty token
  await assert.rejects(() => api.verifyGitHubToken('   ', async () => { throw new Error('should not fetch'); }));

  // Rejects 401 unauthorized
  await assert.rejects(
    () => api.verifyGitHubToken('github_pat_bad', async () => ({ ok: false, status: 401 })),
    /invalid or expired/i
  );

  // Rejects read-only token
  await assert.rejects(
    () => api.verifyGitHubToken('github_pat_readonly', async () => ({
      ok: true,
      status: 200,
      json: async () => ({ permissions: { pull: true, push: false } })
    })),
    /read-only/i
  );

  // Accepts write-capable token and reads user login
  const verified = await api.verifyGitHubToken('Bearer github_pat_valid_123', async (url) => {
    if (url.endsWith('/user')) {
      return { ok: true, status: 200, json: async () => ({ login: 'satyanarayan-owner' }) };
    }
    return { ok: true, status: 200, json: async () => ({ permissions: { pull: true, push: true } }) };
  });
  assert.equal(verified.token, 'github_pat_valid_123');
  assert.equal(verified.login, 'satyanarayan-owner');
});

test('9. Customer index.html keeps Owner PWA link strictly hidden inside #owner-studio', () => {
  const studioStart = customerHtml.indexOf('<section id="owner-studio"');
  const studioEnd = customerHtml.indexOf('</section>', studioStart);
  assert.ok(studioStart > 0 && studioEnd > studioStart);
  const linkPos = customerHtml.indexOf('id="link-owner-pwa"');
  assert.ok(linkPos > studioStart && linkPos < studioEnd, 'Owner PWA link must remain strictly inside hidden #owner-studio');
  assert.equal(customerHtml.indexOf('href="owner/"', studioEnd), -1, 'No customer-visible link to owner/ outside #owner-studio');
});
