# Repository Guidelines (`satyanarayanjewellery/shop`)

## Mandatory Version Increment Rule (`+1` at end on every update)

Whenever updating any application code, styles, service workers, scripts, or tests in this repository, **always increment the trailing version number by `+1` once per update / pull request** before committing:

```bash
npm run version:bump
```

What `npm run version:bump` (`scripts/bump-version.mjs`) updates in lockstep:
- **`package.json`**: increments `"version"` by `+1` at the end (e.g. `1.0.1` → `1.0.2`, `1.0.9` → `1.0.10`).
- **Customer Storefront (`index.html`)**: updates `APP_VERSION` and all `[data-customer-version]` badges to the normal version (`v1.0.X`, never `Beta`).
- **Admin Desk PWA (`admin/index.html`, `admin/app.js`) & Inline Admin Suite (`index.html`)**: updates `ADMIN_APP_VERSION` and all `[data-admin-version]` badges to the Beta version (`v1.0.X Beta`).
- **Service Workers (`sw.js`, `admin/sw.js`)**: increments both `sj-price-desk-vN` and `sj-admin-desk-vN` cache versions by `+1` so installed PWAs refresh cleanly.

CI (`node scripts/bump-version.mjs --check-updated origin/main` and `npm test`) strictly verifies both version synchronization and the `+1` increment against `main`.
