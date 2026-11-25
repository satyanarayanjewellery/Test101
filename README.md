# Daily WhatsApp Channel price bot

Prefer official individual WhatsApp messages instead of Channel posts? See the [individual messaging setup](docs/individual-messages.md).

This repository's static price desk cannot send scheduled messages by itself. The bot in `bot/price-channel.mjs` runs separately on GitHub Actions and can publish one gold and silver update daily at **9:00 AM India time**. GitHub may delay or occasionally skip scheduled runs. No post has been activated or sent just by adding these files.

## Set up

1. Create a Whapi.Cloud account, link a WhatsApp account that is an **admin of your existing Channel**, and obtain the Whapi API token. Whapi uses an unofficial linked-device connection, not Meta's official WhatsApp Business API; check its pricing, terms, and the risk of account restrictions before use. Keep your account linked.
2. Find your Channel's ID (a numeric ID ending in `@newsletter`) using Whapi's dashboard or its `GET /newsletters` API. A public Channel invite URL is not the ID. Verify the ID corresponds to your intended Channel. See [Whapi's Channel guide](https://whapi.cloud/how-to-automate-whatsapp-channels-api).
3. In GitHub repository **Settings → Secrets and variables → Actions → Secrets**, add `WHAPI_TOKEN` and `WHAPI_CHANNEL_ID`. Do not put the token in this repository, the website, workflow logs, or chat.
4. Merge these files into the repository's **default branch** and enable GitHub Actions if needed. GitHub runs scheduled workflows from the default branch, not this working branch. Check the repository's Actions settings and activity policy if schedules stop running.
5. Under **Actions → Daily WhatsApp price update → Run workflow**, leave **Post to the Channel** unchecked to preview the message in the run log. Check the values, source timestamps and wording. Then run it with the box checked for a real post and verify it appears in the intended Channel. To enable daily Channel posting, set the Actions variable `WHAPI_DAILY_ENABLED` to `true`; the scheduled run then posts every day at 03:30 UTC. To change the time, edit the cron in `.github/workflows/whatsapp-prices.yml` (GitHub cron uses UTC). To pause it, set `WHAPI_DAILY_ENABLED` to `false` or disable the workflow in Actions.

Do not rerun a failed send without checking the Channel first: a network timeout or unexpected response can occur after Whapi accepted the message. The bot deliberately does not retry automatically. HTTP/API acceptance does not guarantee WhatsApp delivery. Monitor the Actions runs and the Channel for failures; GitHub notifications depend on your account settings.

## Prices and limitations

The update includes retail gold 999/995/916/750 per 10g and silver 999/925/750 and estimated MCX per kg, both excluding and including 3% GST. It also includes USD/oz and INR international spot breakdowns. It uses gold-api.com for XAU/XAG and open.er-api.com for USD/INR, both sources used by the website. Retail estimates use the website's current Cuttack formulas and zero offset, not a separate live local retail/MCX quote. The website may use other providers or WebSocket prices, so the post will not always match the on-screen rates. Browser-local admin changes are not shared with the bot. To set the same offset, create the optional Actions **variable** `PRICE_OFFSET_PERCENT` (e.g. `2.5`); default is 0. Keep it in sync with the website manually. City is Cuttack.

Rates are indicative, exclude making charges, and are not firm quotes. The bot reports provider timestamps and rejects missing, invalid, future or older-than-three-day quotes rather than sending incomplete data. Provider timestamps may not reflect the last actual market trade, especially on weekends or holidays; the message warns that markets may be closed. Review the formulas when the website's pricing logic changes.

## Local test

Requires Node.js 22 or later; no dependencies to install.

```sh
node --test
DRY_RUN=true node bot/price-channel.mjs
```

The dry run fetches current prices and prints a preview without Whapi credentials. It requires network access to the price providers. A real local run requires `WHAPI_TOKEN` and `WHAPI_CHANNEL_ID` as environment variables; keep them out of shell history and committed files.
