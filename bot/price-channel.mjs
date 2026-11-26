// Scheduled WhatsApp Channel updates. No credentials are used in the browser.
import { pathToFileURL } from 'node:url';

const OZ = 31.1034768;
const DAY = 24 * 60 * 60 * 1000;
const MAX_QUOTE_AGE = 4 * DAY; // Covers standard weekends and 3-day market holidays.
const MAX_OFFSET_PERCENT = 25;
const fetchOptions = () => ({ signal: AbortSignal.timeout(15000), cache: 'no-store' });

function positive(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${name}`);
  return value;
}
function checkedTime(value, name, now, maxAge) {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > now + 5 * 60 * 1000 || now - time > maxAge) throw new Error(`Missing, future, or stale ${name} timestamp`);
  return new Date(time).toISOString();
}
async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, fetchOptions());
  if (!response.ok) throw new Error(`Price provider request failed (${response.status})`);
  return response.json();
}
function parseSwissquote(json) {
  if (!Array.isArray(json)) return null;
  for (const item of json) {
    const list = item?.spreadProfilePrices;
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const bid = Number(row?.bid);
      const ask = Number(row?.ask);
      if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
        const ts = Number(item?.ts);
        return {
          price: (bid + ask) / 2,
          updatedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : ''
        };
      }
    }
  }
  return null;
}

async function fetchMetalQuote(symbol, name, fetchImpl, now) {
  try {
    const data = await getJson(`https://api.gold-api.com/price/${symbol}`, fetchImpl);
    if (data.symbol !== symbol || data.currency !== 'USD') throw new Error('Unexpected price provider response');
    return {
      price: positive(data.price, `${name} price`),
      time: checkedTime(data.updatedAt, name, now, MAX_QUOTE_AGE)
    };
  } catch (primaryError) {
    // Only fall back to Swissquote on network/HTTP errors; propagate explicit validation errors.
    if (!/Price provider request failed|fetch|timeout|abort/i.test(primaryError.message || '')) throw primaryError;
    try {
      const sq = parseSwissquote(await getJson(`https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${symbol}/USD`, fetchImpl));
      if (!sq) throw new Error('Unexpected Swissquote response');
      return {
        price: positive(sq.price, `${name} price`),
        time: checkedTime(sq.updatedAt, name, now, MAX_QUOTE_AGE)
      };
    } catch {
      throw primaryError;
    }
  }
}

async function fetchFxQuote(fetchImpl, now) {
  try {
    const fx = await getJson('https://open.er-api.com/v6/latest/USD', fetchImpl);
    if (fx.result !== 'success' || fx.base_code !== 'USD') throw new Error('Unexpected price provider response');
    return {
      fx: positive(fx.rates?.INR, 'USD/INR rate'),
      fxTime: checkedTime(Number.isFinite(fx.time_last_update_unix) ? new Date(fx.time_last_update_unix * 1000).toISOString() : '', 'FX', now, MAX_QUOTE_AGE)
    };
  } catch (primaryError) {
    if (!/Price provider request failed|fetch|timeout|abort/i.test(primaryError.message || '')) throw primaryError;
    try {
      const fb = await getJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR', fetchImpl);
      if (fb.base !== 'USD') throw new Error('Unexpected Frankfurter response');
      return {
        fx: positive(fb.rates?.INR, 'USD/INR rate'),
        fxTime: checkedTime(typeof fb.date === 'string' ? `${fb.date}T00:00:00Z` : '', 'FX', now, MAX_QUOTE_AGE)
      };
    } catch {
      throw primaryError;
    }
  }
}

export async function getQuotes(fetchImpl = fetch, now = Date.now()) {
  const [gold, silver, fx] = await Promise.all([
    fetchMetalQuote('XAU', 'gold', fetchImpl, now),
    fetchMetalQuote('XAG', 'silver', fetchImpl, now),
    fetchFxQuote(fetchImpl, now)
  ]);
  return {
    gold: gold.price, silver: silver.price, fx: fx.fx,
    goldTime: gold.time, silverTime: silver.time, fxTime: fx.fxTime
  };
}

// Mirrors index.html's Cuttack, computeCityPrices calculation.
export function calculate(q, offset = 0) {
  if (!Number.isFinite(offset) || offset < -MAX_OFFSET_PERCENT || offset > MAX_OFFSET_PERCENT) {
    throw new Error(`PRICE_OFFSET_PERCENT must be between -${MAX_OFFSET_PERCENT} and ${MAX_OFFSET_PERCENT}`);
  }
  const adjustment = 1 + offset / 100;
  const goldSpot = positive(q.gold, 'gold') * positive(q.fx, 'FX') / OZ;
  const silverSpot = positive(q.silver, 'silver') * q.fx / OZ;
  const goldBase = positive(goldSpot * 1.15 * 10 * 1.0317 * adjustment, 'gold base');
  const mcxBase = positive(silverSpot * 1.15 * 1000 * 1.0802, 'MCX silver base');
  const silverBase = positive(mcxBase * 1.1462 * adjustment, 'silver base');
  return { goldSpot, silverSpot, goldBase, mcxBase, silverBase };
}
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const usd = n => '$' + n.toFixed(2);
function lines(base, factors) {
  return factors.map(([label, factor]) => `${label}: ${inr(base * factor)} / ${inr(base * factor * 1.03)}`).join('\n');
}
function spotLines(base, factors) {
  return factors.map(([label, factor]) => `${label}: ${inr(base * factor)}`).join('\n');
}
export function formatMessage(q, now = new Date(), offset = 0) {
  const p = calculate(q, offset);
  const goldFactors = [['999', 1], ['995', 995 / 999], ['916 (22K)', 22 / 24], ['750 (18K)', 18 / 24]];
  const silverFactors = [['999', 1], ['925', 0.925], ['750', 0.75]];
  const silverSpotFactors = [['999', 1], ['995', 995 / 999], ['916', 0.916], ['750', 0.75]];
  return `*Satyanarayan Jewellers — Daily price update*\nCuttack | ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(now)} IST\n\n*Estimated retail gold / 10g*\nEx-GST / incl. 3% GST\n${lines(p.goldBase, goldFactors)}\n\n*Estimated retail silver / kg*\nEx-GST / incl. 3% GST\n${lines(p.silverBase, silverFactors)}\nMCX estimate: ${inr(p.mcxBase)} / ${inr(p.mcxBase * 1.03)}\n\n*International spot estimates*\nGold: ${usd(q.gold)}/oz | Silver: ${usd(q.silver)}/oz\nUSD/INR: ₹${q.fx.toFixed(2)}\nGold in INR / 10g:\n${spotLines(p.goldSpot * 10, goldFactors)}\nSilver in INR / kg:\n${spotLines(p.silverSpot * 1000, silverSpotFactors)}\n\nSources: gold-api.com (gold ${q.goldTime}, silver ${q.silverTime}); open.er-api.com (FX ${q.fxTime}). Times UTC.\nIndicative estimates, not firm quotes; markets may be closed and prices may be last available. Retail prices exclude making charges. Retail offset: ${offset}%.`;
}

export async function sendMessage(message, token, channel, fetchImpl = fetch) {
  if (!token || !/^\d+@newsletter$/.test(channel || '')) throw new Error('Set WHAPI_TOKEN and a valid WHAPI_CHANNEL_ID ending in @newsletter');
  // No automatic retry: an ambiguous timeout could otherwise create duplicate posts.
  let response;
  try {
    response = await fetchImpl('https://gate.whapi.cloud/messages/text', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to: channel, body: message }), signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw new Error('Whapi request failed or timed out; delivery is unknown. Check the Channel before retrying.');
  }
  if (!response.ok) throw new Error(`Whapi returned HTTP ${response.status}; check the Channel before retrying`);
  let data;
  try { data = await response.json(); } catch { throw new Error('Whapi returned an unreadable response; check the Channel before retrying'); }
  if (data.error || data.sent === false || !(data.message?.id || data.sent_message?.id)) throw new Error('Whapi did not confirm acceptance; check the Channel before retrying');
  return data.message?.id || data.sent_message.id;
}

export async function main(env = process.env, deps = {}) {
  const fetchQuotes = deps.getQuotes || getQuotes;
  const postMessage = deps.sendMessage || sendMessage;
  const log = deps.log || console.log;
  const dryRun = env.DRY_RUN === 'true';
  if (!dryRun && (!env.WHAPI_TOKEN || !/^\d+@newsletter$/.test(env.WHAPI_CHANNEL_ID || ''))) throw new Error('Set WHAPI_TOKEN and a valid WHAPI_CHANNEL_ID ending in @newsletter');
  const offset = env.PRICE_OFFSET_PERCENT == null || env.PRICE_OFFSET_PERCENT.trim() === '' ? 0 : Number(env.PRICE_OFFSET_PERCENT);
  const quotes = await fetchQuotes();
  const message = formatMessage(quotes, new Date(), offset);
  if (dryRun) log(message);
  else {
    await postMessage(message, env.WHAPI_TOKEN, env.WHAPI_CHANNEL_ID);
    log('Whapi accepted the post. Verify delivery in your Channel.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`Price update failed: ${error.message}`); process.exitCode = 1; });
}
