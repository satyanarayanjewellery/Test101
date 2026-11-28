// Cross-PWA price parity.
//
// The Admin Desk and the Customer Desk are two separate implementations of the same pricing
// model. They drifted before: the admin tile printed the ex-GST per-gram figure under an
// "Incl. GST" label, and the admin desk could apply a spot calibration the customer never saw.
// These tests freeze the contract — for the same city + spot + FX + duty/GST, both PWAs must
// return byte-identical ₹ numbers — and guard the UI paths that used to disagree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const customerHtml = fs.readFileSync(new URL('index.html', ROOT), 'utf8');
const adminJs = fs.readFileSync(new URL('admin/app.js', ROOT), 'utf8');
const adminHtml = fs.readFileSync(new URL('admin/index.html', ROOT), 'utf8');

const CITIES = [
  'cuttack', 'mumbai', 'kolkata', 'pune', 'bengaluru', 'hyderabad',
  'chennai', 'ahmedabad', 'patna', 'delhi', 'jaipur', 'lucknow'
];

// [spot gold USD/oz, spot silver USD/oz, USD/INR]
const SPOTS = [
  [3200, 38, 86],
  [4100, 48, 85],
  [2650.55, 31.77, 92.35],
  [999.5, 7.25, 60.5],
  [29500, 940, 119.5]
];

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.ok(start >= 0 && end > start, `Could not slice ${startNeedle} .. ${endNeedle}`);
  return source.slice(start, end);
}

function loadCustomerPricing() {
  const code = [
    sliceBetween(customerHtml, '    const CITIES = {', '    const STATUTORY_RATES_PATH'),
    sliceBetween(customerHtml, '    const TROY_OZ_TO_GRAMS =', '    const GOLD_RETAIL_PREMIUM'),
    sliceBetween(customerHtml, '    const GOLD_RETAIL_PREMIUM =', '    const FX_REFRESH_MS'),
    sliceBetween(customerHtml, '    function computeCityPrices(', '    function formatIndianInt('),
    'computeCityPrices'
  ].join('\n');
  return vm.runInNewContext(code, {});
}

function loadAdminPricing() {
  const code = [
    sliceBetween(adminJs, '  const TROY_OZ_TO_GRAMS =', '  const CITIES = {'),
    sliceBetween(adminJs, '  const CITIES = {', '  const CURRENCY_PER_USD'),
    sliceBetween(adminJs, '  function statutoryRatesFor(', '  function sanitizeStatutoryPayload('),
    sliceBetween(adminJs, '  function computeCityPrices(', '  function sanitizeCatalogMediaUrl'),
    'computeCityPrices'
  ].join('\n');
  return vm.runInNewContext(code, { state: { statutory: null } });
}

test('Price Parity 1: Customer and Admin computeCityPrices return identical ₹ for every city/spot', () => {
  const customer = loadCustomerPricing();
  const admin = loadAdminPricing();

  for (const [gold, silver, fx] of SPOTS) {
    for (const city of CITIES) {
      const c = customer(city, gold, silver, fx);
      const a = admin(city, gold, silver, fx);
      for (const key of Object.keys(c)) {
        if (key === 'cityId') continue;
        assert.equal(a[key], c[key], `${city} ${gold}/${silver}/${fx}: ${key} differs (admin ${a[key]} vs customer ${c[key]})`);
      }
      assert.equal(a.cityId, city, 'Admin must echo the city it priced');
    }
  }
});

test('Price Parity 2: both desks share GOLD_RETAIL_PREMIUM / SILVER premiums and every per-gram key', () => {
  for (const name of ['GOLD_RETAIL_PREMIUM', 'SILVER_MCX_PREMIUM', 'SILVER_RETAIL_PREMIUM']) {
    const customerConst = customerHtml.match(new RegExp(`const ${name} = ([0-9.]+);`));
    const adminConst = adminJs.match(new RegExp(`const ${name} = ([0-9.]+);`));
    assert.ok(customerConst, `Customer Desk is missing ${name}`);
    assert.ok(adminConst, `Admin Desk is missing ${name}`);
    assert.equal(adminConst[1], customerConst[1], `${name} must match across PWAs`);
  }

  const customer = loadCustomerPricing();
  const admin = loadAdminPricing();
  const c = customer('cuttack', 3200, 38, 86);
  const a = admin('cuttack', 3200, 38, 86);
  for (const key of ['gold24', 'gold999Gram', 'gold916Gram', 'silverMCXGram', 'silverMCXGstGram']) {
    assert.ok(key in c, `Customer Desk is missing ${key}`);
    assert.ok(key in a, `Admin Desk is missing ${key}`);
  }
});

test('Price Parity 3: Admin "Incl. GST · 1g" line prints the GST-inclusive gram rate the customer sees', () => {
  // The admin desk used the ex-GST per-gram value in the "Incl. GST" sub-line, so the same gold
  // read ₹9,610/g on the admin board and ₹9,899/g on the customer board. Pin the rendered text.
  const tiles = [
    ['g999', 'gold999', 'gold999Gram'],
    ['g995', 'gold995', 'gold995Gram'],
    ['g916', 'gold916', 'gold916Gram'],
    ['g750', 'gold18', 'gold18Gram'],
    ['s999', 'silver999', 'silver999Gram'],
    ['s925', 'silver925', 'silver925Gram'],
    ['s750', 'silver750', 'silver750Gram']
  ];
  for (const [tile, gstKey, gramKey] of tiles) {
    const idx = adminJs.indexOf(`setVal('r-${tile}-gst'`);
    assert.ok(idx >= 0, `Missing r-${tile}-gst tile update`);
    const line = adminJs.slice(idx, adminJs.indexOf('\n', idx));
    assert.ok(line.includes(`p.${gstKey}`), `r-${tile}-gst must show the ${gstKey} figure`);
    assert.ok(line.includes(`p.${gramKey}, 2`), `r-${tile}-gst must show the GST-inclusive per-gram rate (${gramKey})`);
  }
});

test('Price Parity 4: no admin-only price multiplier can move the board', () => {
  assert.ok(!/calibPctGold|calibPctSilver/.test(adminJs), 'Admin must not hold a spot calibration multiplier');
  const api = (() => {
    const sandbox = {
      console, Date, Math, Number, String, Array, Object, JSON, Intl, RegExp, Error, Promise,
      URL, TextEncoder, TextDecoder,
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      atob: (s) => Buffer.from(s, 'base64').toString('binary'),
      setTimeout, clearTimeout, setInterval, clearInterval
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(adminJs, sandbox, { filename: 'admin/app.js' });
    return sandbox.__ADMIN_PWA_API__;
  })();
  const plain = api.computeCityPrices('cuttack', 3200, 34.5, 86.5);
  const nudged = api.computeCityPrices('cuttack', 3200, 34.5, 86.5, { calibPctGold: 4, calibPctSilver: -4 });
  assert.deepEqual(nudged, plain);
});

test('Price Parity 5: city selection is shared between both PWAs', () => {
  const key = /satyanarayan_city_v1/;
  assert.match(customerHtml, key, 'Customer Desk must persist the shared city key');
  assert.match(adminJs, key, 'Admin Desk must read/write the shared city key');
  assert.match(adminJs, /lsSet\(STORAGE_KEYS\.city, cityId\)/);
  assert.match(customerHtml, /lsSet\(STORAGE_KEYS\.city, cityId\)/);
  // Both snapshots carry the city they were priced for.
  assert.match(customerHtml, /cityId: state\.cityId,/);
  assert.match(adminJs, /cityId: state\.cityId,/);
  // ...and both adopt it on restore so a saved board is never shown for the wrong city.
  assert.match(customerHtml, /cached\.cityId && CITIES\[cached\.cityId\]/);
  assert.match(adminJs, /cached\.cityId && CITIES\[cached\.cityId\]/);
});

test('Price Parity 6: Admin Desk surfaces a live Admin-vs-Customer parity card', () => {
  assert.match(adminHtml, /id="parity-card"/);
  assert.match(adminHtml, /id="parity-badge"/);
  assert.match(adminHtml, /id="parity-gold"/);
  assert.match(adminHtml, /id="parity-silver"/);
  assert.match(adminJs, /function computeCustomerParity\(/);
  assert.match(adminJs, /function renderParityCard\(/);
  assert.match(adminJs, /renderParityCard\(\);/);
});

test('Price Parity 7: published catalogue prices declare their basis and the storefront honours it', () => {
  assert.match(adminJs, /priceBasis: Number\(item\.price\) > 0/, 'Publish must stamp priceBasis');
  assert.match(adminJs, /priceBasis: price > 0 \?/, 'Upload form must stamp priceBasis');
  assert.match(adminJs, /priceBasis: 'metal_making_gst'/, 'Batch reprice must stamp the GST-inclusive basis');
  assert.match(customerHtml, /const priceIncludesGst = p\.priceBasis !== 'metal'/, 'Storefront must honour a metal-only price');
  assert.match(customerHtml, /const itemIncludesGst = item\.priceBasis !== 'metal'/, 'Lightbox must honour a metal-only price');
});

test('Price Parity 8: Admin catalogue shows the same ₹ string the storefront prints', () => {
  // Same grouping/rounding as the customer's formatShopPrice (en-IN, no decimals).
  assert.match(adminJs, /function formatIndianInt\(/);
  assert.match(adminJs, /priceBasisNote/);
  assert.match(adminJs, /incl\. GST · \$\{escapeHtml\(priceBasisNote\)\}/);
  // Auto-price hint exposes the ex-GST total so it can be compared with the customer calculator.
  assert.match(adminJs, /exGstTotal/);
});

test('Price Parity 9: parity audit recomputes the customer side (city switch is never "identical")', () => {
  const store = new Map();
  const sandbox = {
    console, Date, Math, Number, String, Array, Object, JSON, Intl, RegExp, Error, Promise, URL,
    TextEncoder, TextDecoder, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary')
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(adminJs, sandbox, { filename: 'admin/app.js' });
  const api = sandbox.__ADMIN_PWA_API__;

  const snapshot = { spotGold: 4100.1234, spotSilver: 48.5, usdInr: 86.42, cityId: 'delhi', ts: Date.now() - 150000 };
  store.set('satyanarayan_last_rates_v1', JSON.stringify(snapshot));

  // Same city, same spot/FX -> identical.
  const delhi = api.computeCityPrices('delhi', snapshot.spotGold, snapshot.spotSilver, snapshot.usdInr);
  const same = api.computeCustomerParity(delhi, snapshot);
  assert.equal(same.sameCity, true);
  assert.equal(same.exact, true);
  assert.equal(same.goldDiffPct, 0);

  // Admin viewing Cuttack while the customer snapshot is priced for Delhi -> NOT identical.
  const cuttack = api.computeCityPrices('cuttack', snapshot.spotGold, snapshot.spotSilver, snapshot.usdInr);
  const crossCity = api.computeCustomerParity(cuttack, snapshot);
  assert.equal(crossCity.sameCity, false);
  assert.equal(crossCity.exact, false);
  assert.equal(crossCity.cityId, 'delhi');
  assert.notEqual(crossCity.goldDiffPct, 0);

  // Fresher admin tick -> not exact, variance reported (never clamped/hidden).
  const fresher = api.computeCityPrices('delhi', 4130, 48.9, 86.5);
  const drift = api.computeCustomerParity(fresher, snapshot);
  assert.equal(drift.exact, false);
  assert.equal(api.parityIsAlarmed(drift), true);
});

test('Price Parity 10: Admin quote calculator matches the Customer calculator to the rupee', () => {
  const customer = loadCustomerPricing();

  // Lifted from admin/app.js so we exercise the real implementation, not a copy.
  const quoteCode = [
    sliceBetween(adminJs, '  const TROY_OZ_TO_GRAMS =', '  const CITIES = {'),
    sliceBetween(adminJs, '  function statutoryRatesFor(', '  function sanitizeStatutoryPayload('),
    sliceBetween(adminJs, '  function unitToGrams(', '  function computeQuoteMath('),
    sliceBetween(adminJs, '  function computeQuoteMath(', '  function computeOldExchangeMath('),
    'computeQuoteMath'
  ].join('\n');
  // fmtINR only formats the making-charge label; the ₹ math under test is unaffected.
  const adminQuote = vm.runInNewContext(quoteCode, {
    state: { statutory: null },
    fmtINR: (v) => String(v)
  });

  const prices = loadAdminPricing()('cuttack', 3200, 38, 86);
  const custPrices = customer('cuttack', 3200, 38, 86);

  // The Customer PWA's own calculator formula (computeQuote in index.html), applied to the same
  // per-gram rates: base + making, then statutory 3% GST on top, each rounded as the UI rounds.
  const customerQuote = (metal, weight, unit, makingVal, makingType, includeGst) => {
    const gramsFactor = { '10g': 10, oz: 31.1034768, kg: 1000 }[unit] || 1;
    const perGram = {
      '24K': custPrices.gold999ExGstGram,
      '995': custPrices.gold995ExGstGram,
      '22K': custPrices.gold916ExGstGram,
      '18K': custPrices.gold18ExGstGram,
      S999: custPrices.silver999ExGstGram,
      S925: custPrices.silver925ExGstGram
    }[metal];
    const grams = weight * gramsFactor;
    const base = grams * perGram;
    const making = makingType === 'per_g' ? grams * makingVal
      : makingType === 'flat' ? makingVal
        : base * (makingVal / 100);
    const gst = includeGst ? Math.round((base + making) * 0.03) : 0;
    return Math.round(base) + Math.round(making) + gst;
  };

  const cases = [
    ['22K', 12.5, '10g', 12, 'pct', true],
    ['24K', 1, 'oz', 500, 'per_g', true],
    ['18K', 0.25, 'kg', 2500, 'flat', false],
    ['S999', 250, 'g', 8, 'pct', true],
    ['S925', 5, 'g', 40, 'per_g', false]
  ];
  for (const args of cases) {
    const a = adminQuote({
      metal: args[0], weight: args[1], unit: args[2],
      makingVal: args[3], makingType: args[4], includeGst: args[5]
    }, prices);
    assert.equal(a.grandTotal, customerQuote(...args), `Quote differs for ${args.join(' / ')}`);
  }
});
