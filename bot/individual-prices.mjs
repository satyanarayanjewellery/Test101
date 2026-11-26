// Official Meta Cloud API: individually addressed, opted-in recipients only.
import { pathToFileURL } from 'node:url';
import { calculate, getQuotes } from './price-channel.mjs';

const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const rows = (base, factors, gst = false) => factors.map(([label, factor]) => `${label}: ${inr(base * factor)}${gst ? ' / ' + inr(base * factor * 1.03) : ''}`).join('; ');
const gold = [['999', 1], ['995', 995 / 999], ['916', 22 / 24], ['750', 18 / 24]];
const silver = [['999', 1], ['925', .925], ['750', .75]];
const silverSpot = [['999', 1], ['995', 995 / 999], ['916', .916], ['750', .75]];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// These seven positional parameters must match the approved body in docs/individual-messages.md.
export function templateParameters(q, now = new Date(), offset = 0) {
  const p = calculate(q, offset);
  const values = [
    new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(now) + ' IST',
    rows(p.goldBase, gold, true),
    rows(p.silverBase, silver, true) + `; MCX estimate: ${inr(p.mcxBase)} / ${inr(p.mcxBase * 1.03)}`,
    `Gold $${q.gold.toFixed(2)}/oz; silver $${q.silver.toFixed(2)}/oz; USD/INR ₹${q.fx.toFixed(2)}`,
    rows(p.goldSpot * 10, gold),
    rows(p.silverSpot * 1000, silverSpot),
    `Gold ${q.goldTime}; silver ${q.silverTime}; FX ${q.fxTime}; retail offset ${offset}%`
  ];
  if (values.some(v => !v || v.length > 1024 || /[\r\n\t]/.test(v) || /\s{5,}/.test(v))) throw new Error('Template parameter is invalid');
  return values;
}

export function parseRecipients(raw, now = Date.now()) {
  let list;
  try { list = JSON.parse(raw); } catch { throw new Error('META_RECIPIENTS_JSON must be a JSON array'); }
  if (!Array.isArray(list) || !list.length || list.length > 500) throw new Error('Recipient list must contain 1–500 opted-in entries');
  const seen = new Set();
  return list.map((entry, index) => {
    const phone = entry?.phone;
    const opted = Date.parse(entry?.opted_in_at);
    if (typeof phone !== 'string' || !/^[1-9]\d{7,14}$/.test(phone) || !Number.isFinite(opted) || opted > now || typeof entry?.consent_source !== 'string' || !entry.consent_source.trim() || entry.consent_source.length > 200 || entry.opted_in !== true) throw new Error(`Invalid recipient entry ${index + 1}; check consent and phone format`);
    if (seen.has(phone)) throw new Error(`Duplicate phone at recipient entry ${index + 1}`);
    seen.add(phone);
    return phone;
  });
}

export function validateConfig(env) {
  if (!env.META_ACCESS_TOKEN || !/^\d+$/.test(env.META_PHONE_NUMBER_ID || '')) throw new Error('Set META_ACCESS_TOKEN and numeric META_PHONE_NUMBER_ID');
  if (!/^[a-z0-9_]{1,512}$/.test(env.META_TEMPLATE_NAME || '')) throw new Error('Set META_TEMPLATE_NAME to the approved template name');
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(env.META_TEMPLATE_LANGUAGE || '')) throw new Error('Set META_TEMPLATE_LANGUAGE to the approved language code');
  if (!/^v\d{1,2}\.0$/.test(env.META_GRAPH_VERSION || '')) throw new Error('Set META_GRAPH_VERSION, e.g. v26.0');
}

export async function sendIndividual({ token, phoneNumberId, version, templateName, language, recipient, parameters }, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, type: 'template', template: { name: templateName, language: { code: language }, components: [{ type: 'body', parameters: parameters.map(text => ({ type: 'text', text })) }] } }),
      signal: AbortSignal.timeout(30000)
    });
  } catch { throw new Error('Request failed or timed out; delivery is unknown'); }
  if (!response.ok) {
    const err = new Error(`Meta returned HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  let result;
  try { result = await response.json(); } catch { throw new Error('Meta response was unreadable; delivery is unknown'); }
  if (result.error || !result.messages?.[0]?.id) throw new Error('Meta did not confirm acceptance; delivery is unknown');
}

export async function main(env = process.env, deps = {}) {
  const fetchQuotes = deps.getQuotes || getQuotes;
  const sendOne = deps.sendIndividual || sendIndividual;
  const log = deps.log || console.log;
  const delayMs = deps.delayMs ?? 150;
  const dryRun = env.DRY_RUN === 'true';
  let recipients = [];
  if (!dryRun) {
    validateConfig(env);
    recipients = parseRecipients(env.META_RECIPIENTS_JSON);
  }
  const offset = !env.PRICE_OFFSET_PERCENT?.trim() ? 0 : Number(env.PRICE_OFFSET_PERCENT);
  const q = await fetchQuotes();
  const params = templateParameters(q, new Date(), offset);
  if (dryRun) {
    log('Template parameter preview (see docs/individual-messages.md for the full body):');
    params.forEach((value, index) => log(`${index + 1}: ${value}`));
    return;
  }
  let accepted = 0;
  const rejectedEntries = [];
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    if (i > 0 && delayMs > 0) await sleep(delayMs);
    try {
      await sendOne({ token: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID, version: env.META_GRAPH_VERSION, templateName: env.META_TEMPLATE_NAME, language: env.META_TEMPLATE_LANGUAGE, recipient, parameters: params });
      accepted++;
    } catch (error) {
      // Never log a phone number, API token, or provider response body.
      if (error.status === 400) {
        rejectedEntries.push(i + 1);
        continue;
      }
      throw new Error(`Stopped at recipient entry ${i + 1} after ${accepted} accepted: ${error.message}. Check message statuses before any retry; earlier recipients may have received the update.`);
    }
  }
  if (rejectedEntries.length > 0) {
    throw new Error(`Meta accepted ${accepted} requests, but rejected recipient entries [${rejectedEntries.join(', ')}] with HTTP 400. Verify or remove those entries before the next run.`);
  }
  log(`Meta accepted ${accepted} requests. Acceptance does not guarantee delivery.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`Individual update failed: ${error.message}`); process.exitCode = 1; });
}
