import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculate, formatMessage, getQuotes, sendMessage } from '../bot/price-channel.mjs';

const now = Date.parse('2026-11-25T03:30:00Z');
const q = { gold: 4100, silver: 48, fx: 85, goldTime: new Date(now).toISOString(), silverTime: new Date(now).toISOString(), fxTime: new Date(now).toISOString() };
const reply = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
function mockProvider(overrides = {}) {
  return async url => {
    if (url.includes('/XAU')) return reply(overrides.gold ?? { symbol: 'XAU', currency: 'USD', price: q.gold, updatedAt: q.goldTime });
    if (url.includes('/XAG')) return reply(overrides.silver ?? { symbol: 'XAG', currency: 'USD', price: q.silver, updatedAt: q.silverTime });
    return reply(overrides.fx ?? { result: 'success', base_code: 'USD', rates: { INR: q.fx }, time_last_update_unix: now / 1000 });
  };
}

test('fetch and validate all three timestamped quotes', async () => {
  assert.deepEqual(await getQuotes(mockProvider(), now), q);
  await assert.rejects(getQuotes(mockProvider({ gold: { symbol: 'XAU', currency: 'USD', price: 0, updatedAt: q.goldTime } }), now));
  await assert.rejects(getQuotes(mockProvider({ silver: { symbol: 'XAG', currency: 'USD', price: 48, updatedAt: '2020-01-01' } }), now), /stale/);
  await assert.rejects(getQuotes(mockProvider({ fx: { result: 'error' } }), now));
  await assert.rejects(getQuotes(async () => reply({}, false, 503), now), /503/);
});

test('calculations match the website Cuttack function including offsets', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('    function computeCityPrices('), html.indexOf('    function formatIndianInt('));
  for (const offset of [0, 2.5, -4]) {
    const website = vm.runInNewContext(`${source}\ncomputeCityPrices('cuttack', 4100, 48, 85)`, {
      CITIES: { cuttack: { factor: 1 } }, state: { admin: { offsetPct: offset } }, TROY_OZ_TO_GRAMS: 31.1034768,
      INDIA_IMPORT_DUTY_MULTIPLIER: 1.15, INDIA_GST_MULTIPLIER: 1.03, GOLD_RETAIL_PREMIUM: 1.0317,
      SILVER_MCX_PREMIUM: 1.0802, SILVER_RETAIL_PREMIUM: 1.1462
    });
    const actual = calculate(q, offset);
    assert.equal(Math.round(actual.goldBase), website.gold999ExGst);
    assert.equal(Math.round(actual.goldBase * 1.03 * 22 / 24), website.gold916);
    assert.equal(Math.round(actual.silverBase * 0.925), website.silver925ExGst);
    assert.equal(Math.round(actual.mcxBase * 1.03), website.silverMCXGst);
  }
  assert.throws(() => calculate(q, NaN));
});

test('message labels units, source times, GST and indicative market conditions', () => {
  const message = formatMessage(q, new Date(now));
  for (const part of ['9:00 am', 'retail gold / 10g', 'retail silver / kg', 'Ex-GST / incl. 3% GST', 'International spot', 'Gold in INR / 10g', 'Silver in INR / kg', 'markets may be closed', q.goldTime]) assert.ok(message.includes(part), part);
});

test('send only to a valid newsletter using the documented Whapi request', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, 'https://gate.whapi.cloud/messages/text');
    assert.equal(options.headers.authorization, 'Bearer secret');
    assert.deepEqual(JSON.parse(options.body), { to: '123@newsletter', body: 'hello' });
    return reply({ message: { id: 'message-id' } });
  };
  assert.equal(await sendMessage('hello', 'secret', '123@newsletter', fetcher), 'message-id');
  await assert.rejects(sendMessage('hello', 'secret', '123', fetcher));
  assert.equal(calls, 1);
  await assert.rejects(sendMessage('hello', 'secret', '123@newsletter', async () => reply({}, false, 401)), /401/);
  await assert.rejects(sendMessage('hello', 'secret', '123@newsletter', async () => reply({ error: 'no' })), /did not confirm/);
  await assert.rejects(sendMessage('hello', 'secret', '123@newsletter', async () => { throw new Error('token leak'); }), /delivery is unknown/);
});
