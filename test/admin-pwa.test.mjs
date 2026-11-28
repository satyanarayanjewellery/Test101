import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
  incrementTrailingVersion,
  verifyRepoVersions,
  bumpRepoVersion,
  checkUpdatedAgainstBase
} from '../scripts/bump-version.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'admin');

const adminHtml = fs.readFileSync(path.join(ADMIN_DIR, 'index.html'), 'utf8');
const adminCss = fs.readFileSync(path.join(ADMIN_DIR, 'styles.css'), 'utf8');
const adminJs = fs.readFileSync(path.join(ADMIN_DIR, 'app.js'), 'utf8');
const adminSw = fs.readFileSync(path.join(ADMIN_DIR, 'sw.js'), 'utf8');
const adminManifestRaw = fs.readFileSync(path.join(ADMIN_DIR, 'manifest.webmanifest'), 'utf8');
const rootSw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const rootManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const customerHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function loadAdminApi() {
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
  vm.runInNewContext(adminJs, sandbox, { filename: 'admin/app.js' });
  return sandbox.__ADMIN_PWA_API__;
}

test('1. Admin manifest is valid, independent from customer PWA, and references existing icons & views', () => {
  const manifest = JSON.parse(adminManifestRaw);
  assert.equal(manifest.short_name, 'SJ Admin');
  assert.notEqual(manifest.name, rootManifest.name);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.id, '/shop/admin/index.html');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

  const sizes = new Set(manifest.icons.map((i) => i.sizes));
  assert.ok(sizes.has('192x192'), 'Expected 192x192 icon');
  assert.ok(sizes.has('512x512'), 'Expected 512x512 icon');
  assert.ok(manifest.icons.some((i) => String(i.purpose || '').includes('maskable')), 'Expected maskable icon');

  for (const icon of manifest.icons) {
    const abs = path.join(ADMIN_DIR, icon.src);
    assert.ok(fs.existsSync(abs), `Missing icon file ${icon.src}`);
    assert.ok(fs.statSync(abs).size > 2000, `Icon file ${icon.src} unexpectedly small`);
  }
  assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'icons/apple-touch-icon.png')));

  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3);
  for (const sc of manifest.shortcuts) {
    const match = String(sc.url || '').match(/#([a-z]+)$/);
    assert.ok(match, `Shortcut ${sc.name} should target a view hash`);
    assert.ok(adminHtml.includes(`id="view-${match[1]}"`), `Missing view container for shortcut #${match[1]}`);
  }
});

test('2. Admin Service Worker and Customer Service Worker have isolated scopes and cache namespaces', () => {
  assert.doesNotThrow(() => new vm.Script(adminSw, { filename: 'admin/sw.js' }));
  assert.doesNotThrow(() => new vm.Script(rootSw, { filename: 'sw.js' }));

  assert.match(adminSw, /const CACHE = 'sj-admin-desk-v\d+'/);
  assert.match(adminSw, /self\.skipWaiting\(\)/, 'Admin SW install must skipWaiting so installed Admin PWAs upgrade immediately');
  assert.match(adminSw, /client\.navigate\(client\.url\)/, 'Admin SW activate must refresh open /admin/ windows');
  assert.match(adminSw, /isCoreShellAsset/, 'Admin SW must fetch styles.css and app.js network-first');
  assert.match(adminSw, /key\.startsWith\('sj-admin-desk-'\)/, 'Admin SW should only delete its own cache namespace');
  assert.match(adminSw, /SKIP_WAITING/, 'Admin SW should support controlled update reload');
  assert.match(adminSw, /catalog\/products\.json/);
  assert.match(adminSw, /catalog\/statutory-rates\.json/);
  assert.match(adminSw, /\/manifest\.webmanifest/);

  assert.match(rootSw, /url\.pathname\.includes\('\/admin\/'\)/, 'Customer SW must bypass /admin/ routes');
  assert.match(rootSw, /!key\.startsWith\('sj-admin-desk-'\)/, 'Customer SW must preserve admin caches');
  assert.match(rootSw, /\/manifest\.webmanifest/);
});

test('3. Admin HTML locks workspace behind auth gate by default and includes PWA + noindex metadata', () => {
  assert.match(adminHtml, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(adminHtml, /<link rel="manifest" href="manifest\.webmanifest"/);
  assert.match(adminHtml, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(adminHtml, /<link rel="stylesheet" href="styles\.css"/);
  assert.match(adminHtml, /<script src="app\.js" defer><\/script>/);

  // Auth gate is visible by default; admin app shell is hidden until GitHub PAT verification.
  assert.match(adminHtml, /<section id="auth-gate" class="auth-gate"/);
  assert.match(adminHtml, /<div id="admin-app" class="hidden">/);

  // Every static DOM element referenced via $('...') in admin/app.js must exist in admin/index.html.
  const idsInHtml = new Set([...adminHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const idsInJs = new Set([...adminJs.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  const missingIds = [...idsInJs].filter((id) => !idsInHtml.has(id));
  assert.deepEqual(missingIds, [], `DOM IDs referenced in admin/app.js missing from admin/index.html: ${missingIds.join(', ')}`);

  // All five workspace views exist.
  for (const view of ['desk', 'catalog', 'exchanges', 'accuracy', 'settings']) {
    assert.ok(adminHtml.includes(`id="view-${view}"`), `Missing #view-${view}`);
  }

  // Stylesheet is non-trivial and includes safe-area + print + reduced-motion rules.
  assert.ok(adminCss.includes('safe-area-inset-bottom'));
  assert.ok(adminCss.includes('@media print'));
  assert.ok(adminCss.includes('prefers-reduced-motion'));
});

test('4. Admin app.js parses cleanly and matches Customer Desk bullion pricing math exactly', () => {
  assert.doesNotThrow(() => new vm.Script(adminJs, { filename: 'admin/app.js' }));
  const api = loadAdminApi();
  assert.ok(api, 'Expected __ADMIN_PWA_API__ to be exposed');

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

  // There is no admin-only spot calibration any more: an offset that the Customer PWA never
  // applies is exactly how the two desks ended up quoting different ₹. Passing one must be inert.
  const calPrices = api.computeCityPrices('cuttack', 3200, 34.5, 86.5, { calibPctGold: 1, calibPctSilver: 1 });
  assert.equal(calPrices.gold999ExGst, prices.gold999ExGst);
  assert.equal(calPrices.silver999ExGst, prices.silver999ExGst);
  assert.equal(api.state.accuracy.calibPctGold, undefined, 'Admin accuracy state must not hold a price multiplier');
});

test('5. Admin media resolver translates canonical catalog/media paths safely for /admin/ display', () => {
  const api = loadAdminApi();
  assert.equal(api.sanitizeCatalogMediaUrl('catalog/media/prod-1-0.webp'), 'catalog/media/prod-1-0.webp');
  assert.equal(api.toAdminMediaSrc('catalog/media/prod-1-0.webp'), '../catalog/media/prod-1-0.webp');
  assert.equal(api.toAdminMediaSrc('blob:https://satyanarayanjewellery.github.io/abc'), 'blob:https://satyanarayanjewellery.github.io/abc');

  // Block path traversal, XSS, or external URLs.
  assert.equal(api.toAdminMediaSrc('javascript:alert(1)'), '');
  assert.equal(api.toAdminMediaSrc('../etc/passwd'), '');
  assert.equal(api.toAdminMediaSrc('https://evil.example/img.jpg'), '');
  assert.equal(api.toAdminMediaSrc('catalog/media/../../secret.json'), '');
});

test('6. Statutory duty/GST validator enforces safe ranges & ISO dates and previews live impact', () => {
  const api = loadAdminApi();

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
  const api = loadAdminApi();
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
  const api = loadAdminApi();

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
      return { ok: true, status: 200, json: async () => ({ login: 'satyanarayan-admin' }) };
    }
    return { ok: true, status: 200, json: async () => ({ permissions: { pull: true, push: true } }) };
  });
  assert.equal(verified.token, 'github_pat_valid_123');
  assert.equal(verified.login, 'satyanarayan-admin');
});

test('9. Customer index.html keeps Admin PWA link strictly hidden inside #admin-studio', () => {
  const studioStart = customerHtml.indexOf('<section id="admin-studio"');
  const studioEnd = customerHtml.indexOf('</section>', studioStart);
  assert.ok(studioStart > 0 && studioEnd > studioStart);
  const linkPos = customerHtml.indexOf('id="link-admin-pwa"');
  assert.ok(linkPos > studioStart && linkPos < studioEnd, 'Admin PWA link must remain strictly inside hidden #admin-studio');
  assert.equal(customerHtml.indexOf('href="admin/"', studioEnd), -1, 'No customer-visible link to admin/ outside #admin-studio');
});

test('10. Customer PWA and Admin PWA have disjoint resolved IDs, non-overlapping scopes, and in-app install buttons', () => {
  const adminManifest = JSON.parse(adminManifestRaw);
  const origin = 'https://satyanarayanjewellery.github.io';
  const customerManifestUrl = `${origin}/shop/manifest.webmanifest`;
  const adminManifestUrl = `${origin}/shop/admin/manifest.webmanifest`;

  // Per W3C Web App Manifest spec: start_url & scope resolve against manifest URL; id resolves against origin.
  const customerStart = new URL(rootManifest.start_url, customerManifestUrl).href;
  const customerScope = new URL(rootManifest.scope, customerManifestUrl).href;
  const customerId = new URL(rootManifest.id, `${origin}/`).href;

  const adminStart = new URL(adminManifest.start_url, adminManifestUrl).href;
  const adminScope = new URL(adminManifest.scope, adminManifestUrl).href;
  const adminId = new URL(adminManifest.id, `${origin}/`).href;

  assert.notEqual(customerId, adminId, 'Customer and Admin PWAs must resolve to distinct manifest IDs');
  assert.ok(customerStart.startsWith(customerScope), 'Customer start_url must lie inside Customer scope');
  assert.ok(adminStart.startsWith(adminScope), 'Admin start_url must lie inside Admin scope');

  // Critical for Android Chrome WebAPK side-by-side install: neither app scope may cover the other's start_url.
  assert.equal(adminStart.startsWith(customerScope), false, 'Customer scope must not swallow Admin start_url');
  assert.equal(customerStart.startsWith(adminScope), false, 'Admin scope must not swallow Customer start_url');

  // Every Admin shortcut must stay inside Admin scope.
  for (const sc of adminManifest.shortcuts) {
    const scUrl = new URL(sc.url, adminManifestUrl).href;
    assert.ok(scUrl.startsWith(adminScope), `Shortcut ${sc.name} (${scUrl}) must be inside Admin scope (${adminScope})`);
  }

  // Both Customer and Admin PWAs expose in-app beforeinstallprompt handlers (avoids Android menu origin-conflict).
  assert.match(customerHtml, /id="btn-install-customer-pwa"/);
  assert.match(customerHtml, /addEventListener\('beforeinstallprompt'/);
  assert.match(adminJs, /addEventListener\('beforeinstallprompt'/);
});

test('11. Admin Suite: Smart Inventory auto-pricing, stock status normalization, CSV formula-injection guard, and QR SVG generator', () => {
  const api = loadAdminApi();
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

test('12. Admin Suite: GST Estimate & Bill Slip Maker and Customer Orders & Advance Rate-Lock Book', () => {
  const api = loadAdminApi();
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

test('13. Customer Storefront syncs Featured Showroom Picks, Stock Status badges, and Inline Admin Suite tabs & modals', () => {
  // Inline Admin Studio exposes Upload, GST Bill Slip, and Order Book sub-tabs + Batch Reprice & Export
  assert.match(customerHtml, /id="admin-tab-upload"/);
  assert.match(customerHtml, /id="admin-tab-bill"/);
  assert.match(customerHtml, /id="admin-tab-orders"/);
  assert.match(customerHtml, /id="btn-inline-reprice"/);
  assert.match(customerHtml, /id="btn-inline-export-csv"/);
  assert.match(customerHtml, /id="btn-inline-export-json"/);
  assert.match(customerHtml, /id="admin-edit-item-modal"/);
  assert.match(customerHtml, /id="admin-qr-tag-modal"/);
  assert.match(customerHtml, /id="admin-print-sheet"/);

  // Shared localStorage keys so inline Admin Mode and standalone /admin/ share orders & bill sequence on same browser
  assert.match(customerHtml, /satyanarayan_admin_orders_v1/);
  assert.match(adminJs, /satyanarayan_admin_orders_v1/);
  assert.match(customerHtml, /satyanarayan_admin_bill_seq_v1/);
  assert.match(adminJs, /satyanarayan_admin_bill_seq_v1/);
});

test('14. Version numbers: Customer displays normal version (vX.Y.Z) and all Admin surfaces display Beta version (vX.Y.Z Beta)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  const expectedNormal = `v${pkg.version}`;
  const expectedBeta = `v${pkg.version} Beta`;
  const escapedNormal = expectedNormal.replace(/\./g, '\\.');

  const api = loadAdminApi();
  assert.equal(api.ADMIN_APP_VERSION, expectedBeta);

  // Customer app constants & customer-visible header/footer version badges (normal version, never Beta)
  assert.ok(customerHtml.includes(`const APP_VERSION = '${expectedNormal}';`));
  assert.ok(customerHtml.includes(`const ADMIN_APP_VERSION = '${expectedBeta}';`));
  const customerBadges = [...customerHtml.matchAll(/<span[^>]*data-customer-version[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.ok(customerBadges.length >= 2, 'Customer header and footer must display version number');
  for (const text of customerBadges) {
    assert.equal(text, expectedNormal);
    assert.ok(!/beta/i.test(text), 'Customer version must be normal (non-Beta)');
  }
  assert.match(customerHtml, new RegExp(`id="customer-version-badge"[^>]*>${escapedNormal}<\\/span>`));
  assert.match(customerHtml, new RegExp(`id="customer-footer-version"[^>]*>${escapedNormal}<\\/span>`));

  // Inline Admin surfaces inside index.html must all show Beta version
  const inlineAdminBadges = [...customerHtml.matchAll(/<span[^>]*data-admin-version[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.ok(inlineAdminBadges.length >= 5, 'All inline admin pills, studio, and modals must display Beta version');
  for (const text of inlineAdminBadges) {
    assert.equal(text, expectedBeta);
  }
  for (const containerId of ['admin-mode-pill', 'admin-studio', 'admin-auth-modal', 'admin-edit-item-modal', 'admin-qr-tag-modal']) {
    const idx = customerHtml.indexOf(`id="${containerId}"`);
    assert.ok(idx > 0, `Expected #${containerId} in customerHtml`);
    assert.ok(customerHtml.slice(idx, idx + 800).includes(expectedBeta), `#${containerId} must include ${expectedBeta}`);
  }

  // Standalone Admin PWA (/admin/) auth gate, header, footer, diagnostics, and modals must all show Beta version
  const adminBadges = [...adminHtml.matchAll(/<span[^>]*data-admin-version[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.ok(adminBadges.length >= 6, 'Admin auth gate, header, footer, diagnostics, and modals must display Beta version');
  for (const text of adminBadges) {
    assert.equal(text, expectedBeta);
  }
  for (const id of ['auth-version-pill', 'admin-version-pill', 'diag-version', 'admin-footer-version']) {
    assert.ok(adminHtml.includes(`id="${id}"`), `Missing #${id} in admin/index.html`);
  }
});

test('15. Version bumper always adds +1 at the end across Customer (normal), Admin (Beta), and Service Workers', () => {
  assert.equal(incrementTrailingVersion('1.0.0'), '1.0.1');
  assert.equal(incrementTrailingVersion('v1.0.1'), '1.0.2');
  assert.equal(incrementTrailingVersion('v1.0.9 Beta'), '1.0.10');
  assert.equal(incrementTrailingVersion('2.4.99'), '2.4.100');

  const liveState = verifyRepoVersions(ROOT);
  assert.equal(liveState.normalLabel, `v${liveState.version}`);
  assert.equal(liveState.betaLabel, `v${liveState.version} Beta`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sj-version-bump-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'admin'), { recursive: true });
    for (const rel of ['package.json', 'index.html', 'sw.js', 'admin/index.html', 'admin/app.js', 'admin/sw.js']) {
      fs.copyFileSync(path.join(ROOT, rel), path.join(tmpDir, rel));
    }

    const before = verifyRepoVersions(tmpDir);
    execFileSync('git', ['init', '-b', 'main'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
    execFileSync('git', ['add', '.'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: tmpDir });
    execFileSync('git', ['checkout', '-b', 'update-branch'], { cwd: tmpDir });

    // Updating an app file without bumping must fail checkUpdatedAgainstBase
    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'updated\n', 'utf8');
    execFileSync('git', ['add', 'notes.txt'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'update without bump'], { cwd: tmpDir });
    assert.throws(() => checkUpdatedAgainstBase(tmpDir, 'main'), /must add 1 at the end/);

    // Bumping (+1 at end) satisfies checkUpdatedAgainstBase
    const bumped1 = bumpRepoVersion(tmpDir);
    assert.equal(bumped1.version, incrementTrailingVersion(before.version));
    assert.equal(bumped1.normalLabel, `v${bumped1.version}`);
    assert.equal(bumped1.betaLabel, `v${bumped1.version} Beta`);
    assert.equal(bumped1.customerSwCache, before.customerSwCache + 1);
    assert.equal(bumped1.adminSwCache, before.adminSwCache + 1);
    execFileSync('git', ['add', '.'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'bump +1'], { cwd: tmpDir });
    const checked = checkUpdatedAgainstBase(tmpDir, 'main');
    assert.equal(checked.skipped, false);
    assert.equal(checked.current.version, bumped1.version);

    const bumped2 = bumpRepoVersion(tmpDir);
    assert.equal(bumped2.version, incrementTrailingVersion(bumped1.version));
    assert.equal(bumped2.customerSwCache, before.customerSwCache + 2);
    assert.equal(bumped2.adminSwCache, before.adminSwCache + 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


