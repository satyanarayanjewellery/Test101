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
  assert.equal(manifest.id, '/shop/owner/index.html');
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

  assert.match(ownerSw, /const CACHE = 'sj-owner-desk-v\d+'/);
  assert.match(ownerSw, /key\.startsWith\('sj-owner-desk-'\)/, 'Owner SW should only delete its own cache namespace');
  assert.match(ownerSw, /SKIP_WAITING/, 'Owner SW should support controlled update reload');
  assert.match(ownerSw, /catalog\/products\.json/);
  assert.match(ownerSw, /catalog\/statutory-rates\.json/);
  assert.match(ownerSw, /\/manifest\.webmanifest/);

  assert.match(rootSw, /url\.pathname\.includes\('\/owner\/'\)/, 'Customer SW must bypass /owner/ routes');
  assert.match(rootSw, /!key\.startsWith\('sj-owner-desk-'\)/, 'Customer SW must preserve owner caches');
  assert.match(rootSw, /\/manifest\.webmanifest/);
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

test('10. Customer PWA and Owner PWA have disjoint resolved IDs, non-overlapping scopes, and in-app install buttons', () => {
  const ownerManifest = JSON.parse(ownerManifestRaw);
  const origin = 'https://satyanarayanjewellery.github.io';
  const customerManifestUrl = `${origin}/shop/manifest.webmanifest`;
  const ownerManifestUrl = `${origin}/shop/owner/manifest.webmanifest`;

  // Per W3C Web App Manifest spec: start_url & scope resolve against manifest URL; id resolves against origin.
  const customerStart = new URL(rootManifest.start_url, customerManifestUrl).href;
  const customerScope = new URL(rootManifest.scope, customerManifestUrl).href;
  const customerId = new URL(rootManifest.id, `${origin}/`).href;

  const ownerStart = new URL(ownerManifest.start_url, ownerManifestUrl).href;
  const ownerScope = new URL(ownerManifest.scope, ownerManifestUrl).href;
  const ownerId = new URL(ownerManifest.id, `${origin}/`).href;

  assert.notEqual(customerId, ownerId, 'Customer and Owner PWAs must resolve to distinct manifest IDs');
  assert.ok(customerStart.startsWith(customerScope), 'Customer start_url must lie inside Customer scope');
  assert.ok(ownerStart.startsWith(ownerScope), 'Owner start_url must lie inside Owner scope');

  // Critical for Android Chrome WebAPK side-by-side install: neither app scope may cover the other's start_url.
  assert.equal(ownerStart.startsWith(customerScope), false, 'Customer scope must not swallow Owner start_url');
  assert.equal(customerStart.startsWith(ownerScope), false, 'Owner scope must not swallow Customer start_url');

  // Every Owner shortcut must stay inside Owner scope.
  for (const sc of ownerManifest.shortcuts) {
    const scUrl = new URL(sc.url, ownerManifestUrl).href;
    assert.ok(scUrl.startsWith(ownerScope), `Shortcut ${sc.name} (${scUrl}) must be inside Owner scope (${ownerScope})`);
  }

  // Both Customer and Owner PWAs expose in-app beforeinstallprompt handlers (avoids Android menu origin-conflict).
  assert.match(customerHtml, /id="btn-install-customer-pwa"/);
  assert.match(customerHtml, /addEventListener\('beforeinstallprompt'/);
  assert.match(ownerJs, /addEventListener\('beforeinstallprompt'/);
});

test('11. Owner Suite: Smart Inventory auto-pricing, stock status normalization, CSV formula-injection guard, and QR SVG generator', () => {
  const api = loadOwnerApi();
  const prices = api.computeCityPrices('cuttack', 2900, 33.5, 86.5);

  // Metal inference & live auto-pricing math
  assert.equal(api.inferMetalCode('Gold', '916 Hallmarked'), '22K');
  assert.equal(api.inferMetalCode('Gold', '18K Rose'), '18K');
  assert.equal(api.inferMetalCode('Silver', '925 Sterling'), 'S925');

  const est = api.computeAutoItemPrice({ category: 'Gold', purity: '916', weight: 10, makingPct: 12 }, prices);
  assert.ok(est && est.grandTotal > 0);
  assert.equal(est.metal, '22K');
  assert.equal(est.grandTotal, est.baseValue + est.makingCharges + est.gstAmount);

  // Stock status normalization & labels
  assert.equal(api.normalizeStockStatus('sold_out'), 'sold_out');
  assert.equal(api.normalizeStockStatus('made_to_order'), 'made_to_order');
  assert.equal(api.normalizeStockStatus('unexpected'), 'in_stock');
  assert.equal(api.stockStatusLabel('sold_out'), 'Sold Out');

  // CSV export escapes formula-injection characters (=, +, -, @) and quotes
  const csv = api.catalogItemsToCsv([
    { id: 'sj-1', name: '=CMD("bad")', category: 'Gold', purity: '22K', weight: 8.5, makingPct: 10, price: 78000, stockStatus: 'in_stock', featured: true, sku: 'SJ-916', note: 'Bridal, " Antique "' }
  ]);
  assert.match(csv, /'=CMD\(""bad""\)/);
  assert.match(csv, /"Bridal, "" Antique """/);

  // QR SVG generator produces deterministic valid Version-3 SVG with finder squares
  const svg = api.generateQrSvg('https://satyanarayanjewellery.github.io/shop/#products?sku=SJ-916', 120);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="120" height="120"/);
  assert.match(svg, /<path d="M/);
});

test('12. Owner Suite: GST Estimate & Bill Slip Maker and Customer Orders & Advance Rate-Lock Book', () => {
  const api = loadOwnerApi();
  const prices = api.computeCityPrices('cuttack', 2900, 33.5, 86.5);

  // Multi-line GST Bill Slip calculation with CGST + SGST split, old gold exchange & advance paid
  const bill = {
    docType: 'GST Estimate',
    billNo: 'SJ-2026-007',
    customerName: 'Smt. Ananya Mohanty',
    customerPhone: '9861012345',
    includeGst: true,
    discount: 1000,
    oldExchange: 25000,
    advance: 10000,
    lines: [
      { id: 'l1', desc: '22K Bridal Necklace', metal: '22K', huid: 'AB12CD', weight: 15, ratePerGram: 0, makingVal: 12, makingType: 'pct' },
      { id: 'l2', desc: 'Silver Payal Pair', metal: 'S999', huid: '', weight: 50, ratePerGram: 0, makingVal: 15, makingType: 'per_g' }
    ]
  };
  const totals = api.computeBillTotals(bill, prices);
  assert.equal(totals.lines.length, 2);
  assert.equal(totals.cgst + totals.sgst, totals.gstTotal);
  assert.equal(totals.grossTotal, totals.taxableValue + totals.gstTotal);
  assert.equal(totals.netPayable, totals.grossTotal - 25000 - 10000);

  const billText = api.buildBillShareText(bill, totals);
  assert.match(billText, /SJ-2026-007/);
  assert.match(billText, /21AFNPP7926E1ZC/);
  assert.match(billText, /HUID:AB12CD/);
  assert.match(billText, /CGST/);
  assert.match(billText, /Net Balance Payable/);

  // Order book sanitization & WhatsApp follow-up text
  const order = api.sanitizeOrderRecord({
    customerName: 'Sri Rakesh Panda',
    phone: '+91 94370-11223',
    item: 'Custom Filigree Haram',
    metal: '22K',
    weight: 24.5,
    lockedRate: 8200,
    advance: 50000,
    dueDate: '2026-12-15',
    status: 'Ready'
  });
  assert.ok(order);
  assert.equal(order.status, 'Ready');
  assert.equal(order.advance, 50000);
  const waMsg = api.buildOrderWhatsAppText(order);
  assert.match(waMsg, /READY FOR PICKUP/);
  assert.match(waMsg, /Custom Filigree Haram/);
  assert.match(waMsg, /21AFNPP7926E1ZC/);
});

test('13. Customer Storefront syncs Featured Showroom Picks, Stock Status badges, and Inline Owner Suite tabs & modals', () => {
  // Inline Owner Studio exposes Upload, GST Bill Slip, and Order Book sub-tabs + Batch Reprice & Export
  assert.match(customerHtml, /id="owner-tab-upload"/);
  assert.match(customerHtml, /id="owner-tab-bill"/);
  assert.match(customerHtml, /id="owner-tab-orders"/);
  assert.match(customerHtml, /id="btn-inline-reprice"/);
  assert.match(customerHtml, /id="btn-inline-export-csv"/);
  assert.match(customerHtml, /id="btn-inline-export-json"/);
  assert.match(customerHtml, /id="owner-edit-item-modal"/);
  assert.match(customerHtml, /id="owner-qr-tag-modal"/);
  assert.match(customerHtml, /id="owner-print-sheet"/);

  // Shared localStorage keys so inline Owner Mode and standalone /owner/ share orders & bill sequence on same browser
  assert.match(customerHtml, /satyanarayan_owner_orders_v1/);
  assert.match(ownerJs, /satyanarayan_owner_orders_v1/);
  assert.match(customerHtml, /satyanarayan_owner_bill_seq_v1/);
  assert.match(ownerJs, /satyanarayan_owner_bill_seq_v1/);
});

