import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const htmlUrl = new URL('../index.html', import.meta.url);

async function loadHtml() {
  return readFile(htmlUrl, 'utf8');
}

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

test('rates extras UI is present (share, tola, alerts, skip link, live region)', async () => {
  const html = await loadHtml();
  for (const id of [
    'btn-share-rates', 'btn-share-whatsapp', 'btn-copy-rates', 'btn-print-rates',
    'rates-updated-label', 'rates-stale-badge',
    'tola-gold-999-exgst', 'tola-gold-999-gst', 'tola-gold-916-exgst', 'tola-silver-999-exgst',
    'alert-gold-input', 'alert-silver-input', 'btn-save-alerts', 'btn-clear-alerts', 'alert-status',
    'rates-live-region'
  ]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(html.includes('Skip to live rates'));
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('prefers-reduced-motion'));
});

test('WhatsApp channel link and its styling are preserved', async () => {
  const html = await loadHtml();
  assert.match(html, /id="whatsapp-channel-link" href="https:\/\/whatsapp\.com\/channel\/0029Vb9XXVnKgsNmtesNKy1A"/);
  assert.ok(html.includes('.bg-emerald-500\\/20{background-color:rgba(16,185,129,0.2)}'));
  assert.ok(html.includes('S.browser_fallback_url='));
});

test('manifest and service worker are valid and referenced', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'Satyanarayan Jewellers — Live Gold & Silver Price Desk');
  assert.equal(manifest.theme_color, '#090607');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.ok(manifest.icons.some(i => i.sizes === '192x192'));
  assert.ok(manifest.icons.some(i => i.sizes === '512x512'));
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /sj-price-desk-v1/);
  assert.match(sw, /index\.html/);
  assert.match(sw, /skipWaiting/);
  const html = await loadHtml();
  assert.ok(html.includes("navigator.serviceWorker.register('sw.js')"));
});

test('relative-age helper formats ages correctly', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function formatRelativeAge(');
  const end = html.indexOf('    function updateTolaTiles(', start);
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

test('share-text builder includes tola, GST and spot lines', async () => {
  const html = await loadHtml();
  const start = html.indexOf('    function buildRatesShareText()');
  const end = html.indexOf('    function announceRates()', start);
  assert.ok(start >= 0 && end > start);
  const source = html.slice(start, end);
  const prices = {
    gold999ExGst: 131000, gold999: 134930, gold995ExGst: 130869, gold995: 134795,
    gold916ExGst: 120083, gold916: 123686, gold18ExGst: 98250, gold18: 101177,
    gold999ExGstGram: 13100, gold999Gram: 13493,
    silver999ExGst: 124000, silver999: 127720, silver925ExGst: 114700, silver925: 118141,
    silver750ExGst: 93000, silver750: 95790, silverMCX: 108000, silverMCXGst: 111240,
    spotGold: 4100, spotSilver: 48, usdInr: 85
  };
  const context = {
    state: { prices, live: { lastSync: new Date('2026-11-25T03:30:00Z') } },
    getCurrentCity: () => ({ name: 'Cuttack', state: 'Odisha' }),
    fmtINR: (n) => '₹' + Math.round(n).toLocaleString('en-IN'),
    fmtUSD: (n) => '$' + Number(n).toFixed(2),
    TOLA_GRAMS: 11.66
  };
  const build = vm.runInNewContext(`${source}\nbuildRatesShareText`, context);
  const text = build();
  for (const part of ['Satyanarayan Jewellers', 'Cuttack', 'Gold (per 10g', '999:', '916 (22K):', 'per tola (11.66g)', 'Silver (per kg', 'MCX estimate', 'Spot:', 'Indicative estimates']) {
    assert.ok(text.includes(part), part);
  }
  assert.match(text, /₹1,52,7/); // 13100 * 11.66 = 152,746 ex-GST per tola
});
