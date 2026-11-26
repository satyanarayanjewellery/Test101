import test from 'node:test';
import assert from 'node:assert/strict';
import { main, parseRecipients, sendIndividual, templateParameters, validateConfig } from '../bot/individual-prices.mjs';

const now = Date.parse('2026-11-25T03:30:00Z');
const quote = { gold: 4100, silver: 48, fx: 85, goldTime: '2026-11-25T03:29:00.000Z', silverTime: '2026-11-25T03:29:00.000Z', fxTime: '2026-11-25T00:00:00.000Z' };
const valid = { phone: '919876543210', opted_in: true, opted_in_at: '2026-11-01T00:00:00Z', consent_source: 'signed form' };
const valid2 = { phone: '919876543211', opted_in: true, opted_in_at: '2026-11-02T00:00:00Z', consent_source: 'signed form' };
const config = { META_ACCESS_TOKEN: 'secret', META_PHONE_NUMBER_ID: '12345', META_TEMPLATE_NAME: 'daily_prices', META_TEMPLATE_LANGUAGE: 'en_US', META_GRAPH_VERSION: 'v26.0' };

test('parameters cover all requested prices and remain valid template variables', () => {
  const p = templateParameters(quote, new Date(now));
  assert.equal(p.length, 7);
  assert.match(p[0], /9:00 am IST/);
  assert.match(p[1], /916: ₹/);
  assert.match(p[2], /MCX estimate/);
  assert.match(p[3], /Gold \$4100.00\/oz/);
  assert.match(p[4], /995: ₹/);
  assert.match(p[5], /916: ₹/);
  assert.match(p[6], /2026-11-25T03:29:00.000Z/);
  assert.ok(p.every(v => v.length <= 1024 && !/[\n\r\t]/.test(v) && !/\s{5,}/.test(v)));

  // Meta rejects >4 consecutive spaces in template text parameters
  assert.throws(() => templateParameters({ ...quote, goldTime: '2026-11-25     03:29' }, new Date(now)), /Template parameter is invalid/);
});

test('only unique, explicitly opted-in recipients with consent evidence are accepted', () => {
  assert.deepEqual(parseRecipients(JSON.stringify([valid]), now), [valid.phone]);
  for (const bad of [[], [valid, valid], [{ ...valid, opted_in: false }], [{ ...valid, phone: '+919876543210' }], [{ ...valid, consent_source: '' }], [{ ...valid, opted_in_at: '2027-01-01' }]]) {
    assert.throws(() => parseRecipients(JSON.stringify(bad), now));
  }
  assert.throws(() => parseRecipients('not json', now));
});

test('config is validated before sending', () => {
  validateConfig(config);
  for (const bad of [{ META_GRAPH_VERSION: 'v26.0/evil' }, { META_PHONE_NUMBER_ID: '../x' }, { META_ACCESS_TOKEN: '' }, { META_TEMPLATE_NAME: 'bad name' }, { META_TEMPLATE_LANGUAGE: 'english' }]) {
    assert.throws(() => validateConfig({ ...config, ...bad }));
  }
});

test('uses official Meta template payload and reports failures without leaking details', async () => {
  const args = { token: 'secret', phoneNumberId: '12345', version: 'v26.0', templateName: 'daily_prices', language: 'en_US', recipient: valid.phone, parameters: ['one', 'two'] };
  let calls = 0;
  await sendIndividual(args, async (url, options) => {
    calls++;
    assert.equal(url, 'https://graph.facebook.com/v26.0/12345/messages');
    assert.equal(options.headers.authorization, 'Bearer secret');
    const body = JSON.parse(options.body);
    assert.equal(body.to, valid.phone);
    assert.equal(body.recipient_type, 'individual');
    assert.deepEqual(body.template.components[0].parameters, [{ type: 'text', text: 'one' }, { type: 'text', text: 'two' }]);
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.123' }] }) };
  });
  assert.equal(calls, 1);
  await assert.rejects(sendIndividual(args, async () => ({ ok: false, status: 401 })), e => e.status === 401 && /HTTP 401/.test(e.message));
  await assert.rejects(sendIndividual(args, async () => ({ ok: true, json: async () => ({}) })), /did not confirm/);
  await assert.rejects(sendIndividual(args, async () => { throw new Error('secret'); }), e => !e.message.includes('secret') && /unknown/.test(e.message));
});

test('main() handles DRY_RUN, continues past per-recipient HTTP 400, and stops immediately on 401', async () => {
  const baseEnv = { ...config, META_RECIPIENTS_JSON: JSON.stringify([valid, valid2]) };
  const deps = {
    getQuotes: async () => quote,
    delayMs: 0,
    log: () => {}
  };

  // DRY_RUN prints parameters without calling Meta or leaking phone numbers
  const dryLogs = [];
  await main({ ...baseEnv, DRY_RUN: 'true' }, { ...deps, log: line => dryLogs.push(line) });
  assert.equal(dryLogs.length, 8);
  assert.ok(dryLogs.every(line => !line.includes(valid.phone)), 'DRY_RUN log does not leak phone numbers');

  // HTTP 400 on first recipient still delivers to second recipient, then throws summary without PII
  const delivered = [];
  await assert.rejects(
    main(baseEnv, {
      ...deps,
      sendIndividual: async (args) => sendIndividual(args, async (_url, options) => {
        const to = JSON.parse(options.body).to;
        if (to === valid.phone) return { ok: false, status: 400 };
        delivered.push(to);
        return { ok: true, json: async () => ({ messages: [{ id: 'wamid.ok' }] }) };
      })
    }),
    err => /accepted 1 requests.*\[1\]/.test(err.message) && !err.message.includes(valid.phone) && !err.message.includes(valid2.phone)
  );
  assert.deepEqual(delivered, [valid2.phone]);

  // Systemic HTTP 401 stops immediately without attempting second recipient
  let callsOn401 = 0;
  await assert.rejects(
    main(baseEnv, {
      ...deps,
      sendIndividual: async (args) => sendIndividual(args, async () => {
        callsOn401++;
        return { ok: false, status: 401 };
      })
    }),
    /HTTP 401/
  );
  assert.equal(callsOn401, 1);
});
