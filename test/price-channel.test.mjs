import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculate, formatMessage, getQuotes, main, sendMessage } from '../bot/price-channel.mjs';

const now = Date.parse('2026-11-25T03:30:00Z');
const q = { gold: 4100, silver: 48, fx: 85, goldTime: new Date(now).toISOString(), silverTime: new Date(now).toISOString(), fxTime: new Date(now).toISOString() };
const reply = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
function mockProvider(overrides = {}) {
  return async url => {
    if (url.includes('/XAU')) return reply(overrides.gold ?? { symbol: 'XAU', currency: 'USD', price: q.gold, updatedAt: q.goldTime });
    if (url.includes('/XAG')) return reply(overrides.silver ?? { symbol: 'XAG', currency: 'USD', price: q.silver, updatedAt: q.silverTime });
    if (url.includes('open.er-api.com')) return reply(overrides.fx ?? { result: 'success', base_code: 'USD', rates: { INR: q.fx }, time_last_update_unix: now / 1000 });
    return reply({}, false, 503);
  };
}

test('fetch and validate all three timestamped quotes', async () => {
  assert.deepEqual(await getQuotes(mockProvider(), now), q);
  await assert.rejects(getQuotes(mockProvider({ gold: { symbol: 'XAU', currency: 'USD', price: 0, updatedAt: q.goldTime } }), now));
  await assert.rejects(getQuotes(mockProvider({ silver: { symbol: 'XAG', currency: 'USD', price: 48, updatedAt: '2020-01-01' } }), now), /stale/);
  await assert.rejects(getQuotes(mockProvider({ gold: { symbol: 'XAU', currency: 'USD', price: 4100, updatedAt: new Date(now + 2 * 3600e3).toISOString() } }), now), /stale/);
  await assert.rejects(getQuotes(mockProvider({ fx: { result: 'error' } }), now));
  await assert.rejects(getQuotes(async () => reply({}, false, 503), now), /503/);

  // Long holiday weekend quote (78h old) stays within the 4-day MAX_QUOTE_AGE window
  const holidayTs = new Date(now - 78 * 3600e3).toISOString();
  const holidayQuotes = await getQuotes(mockProvider({
    gold: { symbol: 'XAU', currency: 'USD', price: q.gold, updatedAt: holidayTs },
    silver: { symbol: 'XAG', currency: 'USD', price: q.silver, updatedAt: holidayTs }
  }), now);
  assert.equal(holidayQuotes.goldTime, holidayTs);
});

test('getQuotes falls back to Swissquote and Frankfurter on primary provider outages', async () => {
  const fallbackFetcher = async url => {
    if (url.includes('api.gold-api.com') || url.includes('open.er-api.com')) return reply({}, false, 503);
    if (url.includes('swissquote.com') && url.includes('XAU/USD')) {
      return reply([{ ts: now, spreadProfilePrices: [{ bid: 4099, ask: 4101 }] }]);
    }
    if (url.includes('swissquote.com') && url.includes('XAG/USD')) {
      return reply([{ ts: now, spreadProfilePrices: [{ bid: 47.9, ask: 48.1 }] }]);
    }
    if (url.includes('frankfurter.dev')) {
      return reply({ base: 'USD', date: '2026-11-25', rates: { INR: 85 } });
    }
    return reply({}, false, 404);
  };
  const res = await getQuotes(fallbackFetcher, now);
  assert.equal(res.gold, 4100);
  assert.equal(res.silver, 48);
  assert.equal(res.fx, 85);
});

test('website Cuttack calculations and constants match the bot without a retail offset', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const constantsStart = html.indexOf('    const TROY_OZ_TO_GRAMS =');
  const constantsEnd = html.indexOf('    const FX_REFRESH_MS =', constantsStart);
  const citiesStart = html.indexOf('    const CITIES = {');
  const citiesEnd = html.indexOf('    };', citiesStart) + '    };'.length;
  const fnStart = html.indexOf('    function computeCityPrices(');
  const fnEnd = html.indexOf('    function formatIndianInt(', fnStart);
  assert.ok(constantsStart >= 0 && constantsEnd > constantsStart);
  assert.ok(citiesStart >= 0 && citiesEnd > citiesStart);
  assert.ok(fnStart >= 0 && fnEnd > fnStart);

  const website = vm.runInNewContext([
    html.slice(constantsStart, constantsEnd),
    html.slice(citiesStart, citiesEnd),
    html.slice(fnStart, fnEnd),
    "computeCityPrices('cuttack', 4100, 48, 85)"
  ].join('\n'), {});

  const actual = calculate(q, 0);
  assert.equal(Math.round(actual.goldBase), website.gold999ExGst);
  assert.equal(Math.round(actual.goldBase * 1.03 * 22 / 24), website.gold916);
  assert.equal(Math.round(actual.silverBase * 0.925), website.silver925ExGst);
  assert.equal(Math.round(actual.mcxBase * 1.03), website.silverMCXGst);

  // The independent messaging bot still supports its own configured offset within safe bounds.
  assert.ok(calculate(q, 2.5).goldBase > actual.goldBase);
  assert.ok(calculate(q, -4).goldBase < actual.goldBase);
  assert.equal(calculate(q, 25).goldBase > actual.goldBase, true);
  assert.equal(calculate(q, -25).goldBase < actual.goldBase, true);
  assert.throws(() => calculate(q, NaN), /between -25 and 25/);
  assert.throws(() => calculate(q, 26), /between -25 and 25/);
  assert.throws(() => calculate(q, -26), /between -25 and 25/);
  assert.throws(() => calculate({ ...q, gold: 0 }, 0), /Invalid gold/);
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

test('main() supports DRY_RUN and live Whapi dispatch via injected deps', async () => {
  const logs = [];
  await main(
    { DRY_RUN: 'true', PRICE_OFFSET_PERCENT: '1.5' },
    { getQuotes: () => getQuotes(mockProvider(), now), log: line => logs.push(line) }
  );
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Satyanarayan Jewellers/);

  const sentLogs = [];
  const posted = [];
  await main(
    { WHAPI_TOKEN: 'tok', WHAPI_CHANNEL_ID: '123@newsletter' },
    {
      getQuotes: () => getQuotes(mockProvider(), now),
      sendMessage: async (msg, tok, ch) => {
        posted.push({ msg, tok, ch });
        return 'msg-42';
      },
      log: line => sentLogs.push(line)
    }
  );
  assert.equal(posted.length, 1);
  assert.equal(posted[0].tok, 'tok');
  assert.equal(posted[0].ch, '123@newsletter');
  assert.deepEqual(sentLogs, ['Whapi accepted the post. Verify delivery in your Channel.']);
});
