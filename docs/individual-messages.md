# Official WhatsApp individual price updates

This alternative sends **individual messages**, not Channel posts, through Meta's official WhatsApp Cloud API. It does not require Whapi. No account has been connected, no customer has been enrolled, and daily sending is disabled until you enable it. The original Channel workflow remains separate; disable it if you do not want Channel posts.

## Before you send

- Obtain explicit opt-in from each customer specifically for recurring WhatsApp price updates; keep the underlying consent record securely. Do not add Channel followers unless they separately consent. Respect Meta's messaging and opt-in policies and any applicable laws. Meta may charge for template messages; check current pricing.
- This project has **no webhook, inbox, or automatic opt-out handling**. Monitor replies and opt-out requests outside this bot, and promptly remove opted-out customers from the secret below **before the next run**. Use a monitored business number or provide another clear opt-out contact. If you cannot reliably process opt-outs, do not enable sending.
- Set up a Meta business portfolio, WhatsApp Business Account, Cloud API app and registered sender phone number. Obtain a suitably scoped access token (`whatsapp_business_messaging`) and the **phone number ID** (not the number itself); manage token expiry securely. Follow [Meta's Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/).
- Submit the exact body below as a **positional-parameter** message template in WhatsApp Manager. Provide examples for every placeholder, choose the category Meta requires, and wait for approval. No header, buttons or other variable components are used by this bot. Save its exact approved name and language code. If Meta requires changes, update the bot's parameters and template together before sending.

## Template body

```text
Satyanarayan Jewellers daily price update for Cuttack, {{1}}.
Estimated retail gold per 10g (ex-GST / incl. 3% GST): {{2}}.
Estimated retail silver per kg (ex-GST / incl. 3% GST): {{3}}.
International spot and exchange rate: {{4}}.
International gold in INR per 10g: {{5}}.
International silver in INR per kg: {{6}}.
Source times (UTC): {{7}}.
Estimates only, not firm quotes; markets may be closed and prices may be last available. Making charges excluded. Reply STOP to opt out of these updates.
```

The seven placeholders receive, in order: India time, gold retail breakdown, silver retail/estimated MCX breakdown, USD/oz plus FX, gold spot INR breakdown, silver spot INR breakdown, and provider timestamps plus retail offset. Each is one line. The bot uses the same estimated Cuttack formulas and price providers described in the [main README](../README.md). Optional `PRICE_OFFSET_PERCENT` (bounded between `-25` and `25`) can be configured as an Actions variable if you want to apply a retail offset in bot messages.

## Configure GitHub Actions

1. Merge the workflow into the default branch and enable Actions. GitHub scheduled workflows run on the default branch.
2. Under **Settings → Secrets and variables → Actions → Secrets**, add:
   - `META_ACCESS_TOKEN`: Cloud API token. Never share it in chat or commit it.
   - `META_PHONE_NUMBER_ID`: your sender's numeric phone number ID.
   - `META_RECIPIENTS_JSON`: a JSON array of consented recipients, maintained privately. For example (replace with real data; do not commit it):

     ```json
     [{"phone":"919876543210","opted_in":true,"opted_in_at":"2026-11-01T10:00:00Z","consent_source":"signed price updates form"}]
     ```

     Phone numbers must include the country code and contain digits only (no plus sign). The date must be in the past. Each entry must attest to opt-in and include a consent source; this validates record shape, not actual consent. Remove people who opt out, and reject duplicates. The bot sends in list order, up to 500 entries; GitHub secrets have a size limit, so this is suited to a small list. Keep independent, secure records of consent. Never print this secret or expose it to untrusted workflows.
3. Under **Actions → Variables**, set `META_TEMPLATE_NAME` (approved template name), `META_TEMPLATE_LANGUAGE` (for example `en` or `en_US`), and `META_GRAPH_VERSION` (a currently supported Cloud API version, for example `v26.0`). Optionally set `PRICE_OFFSET_PERCENT` to match the site's retail offset.
4. In **Actions → Individual WhatsApp price updates → Run workflow**, leave **Send** unchecked to preview the seven values; no customer list or Meta credentials are needed for preview. Make sure the approved template, rates and sources are correct. For a real test, first put only an opted-in test recipient in the secret, check **Send**, run the workflow, and verify receipt. Restore the opted-in list afterward.
5. Once opt-outs can be processed reliably, set the Actions variable `META_DAILY_ENABLED` to `true`. The daily job will then send at 03:30 UTC (9:00 AM India time), subject to GitHub delays or missed runs. To stop it, set the variable to `false` or disable the workflow. Manual send remains possible even when the schedule is disabled.

## Delivery and failures

Meta accepting a request does not mean delivery; monitor message statuses through Meta's tools. The bot paces requests slightly between recipients and makes **no automatic retries**. If Meta rejects an individual recipient with HTTP `400` (for example an invalid or non-WhatsApp number), the bot records that entry index, continues sending to the remaining recipients, and exits with a summary error at the end so you can clean up the list. On systemic or ambiguous errors (`401`, `403`, `429`, `5xx`, or timeouts), the bot stops immediately because delivery may be unknown or account-wide. The log reports failing list positions and accepted counts without logging phone numbers. Check delivery status before any retry, and if needed run again with only the recipients who still need a message. Rerunning the whole list can create duplicates. No status callback or automatic delivery tracking is included.

`node --test` runs offline tests. `DRY_RUN=true node bot/individual-prices.mjs` previews using live provider requests (requires network access). Missing, invalid or stale quotes stop a run; timestamps may still represent the last available market price on closed-market days.
