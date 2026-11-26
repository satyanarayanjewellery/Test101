# Satyanarayan Jewellers — Live Gold & Silver Price Desk

A zero-build Progressive Web App (PWA) and automated daily WhatsApp rate-update toolkit for **Satyanarayan Jewellers (Cuttack, Odisha)**.

## Features

- **Live Bullion Price Desk (`index.html`)**
  - Real-time Gold (`999 / 24K`, `995`, `916 / 22K`, `750 / 18K`) and Silver (`999`, `925`, `750`, MCX estimate) retail estimates per gram, per 10g, and per kg — both **Ex-GST** and **incl. 3% GST**.
  - Multi-city support across India (defaulting to Cuttack) and USD international spot toggle.
  - Real-time WebSocket feeds (Binance, OKX, Bybit) calibrated against Swissquote / gold-api / FX REST feeds, with offline local-cache hydration and a `5s` exponential-backoff REST fallback.
  - Interactive historical charts (Chart.js 4.4.1 with SRI), bullion news reader (lazy-loaded), local jewellery catalog, jewellery & bullion price calculator, old gold / old silver exchange calculators, rate sharing/printing, and **Mintu** AI assistant (optional user-supplied Gemini API key).
  - Offline-ready PWA (`manifest.webmanifest` + `sw.js`).
- **Automated Daily WhatsApp Bots (`bot/`)**
  - `bot/price-channel.mjs`: Posts daily 9:00 AM IST Cuttack rate updates to a WhatsApp Channel via Whapi (`.github/workflows/whatsapp-prices.yml`).
  - `bot/individual-prices.mjs`: Sends daily template updates to explicitly opted-in customers via Meta's official WhatsApp Cloud API (`.github/workflows/whatsapp-individual-prices.yml`). See [docs/individual-messages.md](docs/individual-messages.md) for setup and compliance requirements.

## Pricing Formula (Cuttack Base)

Both `index.html` and `bot/price-channel.mjs` compute indicative retail estimates from live USD/oz spot quotes and USD/INR FX:

- **Landed parity per gram:** `(spotUSD * usdInr / 31.1034768) * 1.15` (15% customs duty + AIDC)
- **Retail Gold 999 Ex-GST / 10g:** `landedGoldPerGram * 10 * 1.0317`
- **MCX Silver Ex-GST / kg:** `landedSilverPerGram * 1000 * 1.0802`
- **Retail Silver 999 Ex-GST / kg:** `mcxSilverExGst * 1.1462`
- **GST:** `3%` (`* 1.03`)

Parity between `index.html` and `bot/price-channel.mjs` is enforced automatically by `test/price-channel.test.mjs`.

## Local Development & Testing

No build step or third-party `npm` dependencies are required — only **Node.js 22+**.

```bash
# Run the full offline test suite
npm test
# or directly:
node --test

# Preview the static PWA locally
npx serve .   # or: python3 -m http.server 8000

# Preview bot output without sending messages (requires internet access for live quotes)
npm run bot:channel:dry
npm run bot:individual:dry
```

Copy `.env.example` to `.env` if you run the bots locally (never commit `.env` or real credentials).

## Repository Layout

```text
index.html                              Single-file static PWA (HTML, CSS, vanilla JS)
manifest.webmanifest                    PWA manifest
sw.js                                   Service worker (stale-while-revalidate shell)
icons/                                  PWA app icons (192px, 512px, Apple touch icon)
bot/price-channel.mjs                   Whapi WhatsApp Channel bot
bot/individual-prices.mjs               Meta Cloud API individual template bot
docs/individual-messages.md             Meta Cloud API template & opt-in guide
test/                                   Node.js built-in test suite (node --test)
.github/workflows/ci.yml                CI test & script syntax checks
.github/workflows/whatsapp-prices.yml   Scheduled/manual Channel bot workflow
.github/workflows/whatsapp-individual-prices.yml  Scheduled/manual Cloud API workflow
```
