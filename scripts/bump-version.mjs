#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');

/**
 * Increments the trailing integer segment of a dotted version string by +1.
 * Example: "1.0.0" -> "1.0.1", "1.0.9" -> "1.0.10".
 */
export function incrementTrailingVersion(version) {
  const clean = String(version || '').trim().replace(/^v/i, '').replace(/\s+Beta$/i, '');
  const match = clean.match(/^(\d+\.\d+\.)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version "${version}". Expected X.Y.Z format ending with an integer.`);
  }
  const nextPatch = Number(match[2]) + 1;
  return `${match[1]}${nextPatch}`;
}

function parseSwCacheNumber(swSource, prefix, fileLabel) {
  const re = new RegExp(`const CACHE = '${prefix}(\\d+)';`);
  const match = swSource.match(re);
  if (!match) {
    throw new Error(`Could not find CACHE constant with prefix "${prefix}" in ${fileLabel}`);
  }
  return Number(match[1]);
}

/**
 * Verifies that package.json, Customer app (vX.Y.Z), and Admin apps (vX.Y.Z Beta)
 * all share the exact same version in lockstep.
 */
export function verifyRepoVersions(rootDir = DEFAULT_ROOT) {
  const pkgPath = path.join(rootDir, 'package.json');
  const customerHtmlPath = path.join(rootDir, 'index.html');
  const adminHtmlPath = path.join(rootDir, 'admin', 'index.html');
  const adminJsPath = path.join(rootDir, 'admin', 'app.js');
  const customerSwPath = path.join(rootDir, 'sw.js');
  const adminSwPath = path.join(rootDir, 'admin', 'sw.js');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(String(pkg.version || ''))) {
    throw new Error(`package.json version "${pkg.version}" must follow X.Y.Z format`);
  }

  const version = pkg.version;
  const normalLabel = `v${version}`;
  const betaLabel = `v${version} Beta`;

  const customerHtml = fs.readFileSync(customerHtmlPath, 'utf8');
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  const customerSw = fs.readFileSync(customerSwPath, 'utf8');
  const adminSw = fs.readFileSync(adminSwPath, 'utf8');

  if (!customerHtml.includes(`const APP_VERSION = '${normalLabel}';`)) {
    throw new Error(`index.html APP_VERSION does not match expected '${normalLabel}'`);
  }
  if (!customerHtml.includes(`const ADMIN_APP_VERSION = '${betaLabel}';`)) {
    throw new Error(`index.html ADMIN_APP_VERSION does not match expected '${betaLabel}'`);
  }
  if (!adminJs.includes(`const ADMIN_APP_VERSION = '${betaLabel}';`)) {
    throw new Error(`admin/app.js ADMIN_APP_VERSION does not match expected '${betaLabel}'`);
  }

  const customerSpans = [...customerHtml.matchAll(/<span\b[^>]*\bdata-customer-version\b[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  if (customerSpans.length < 2) {
    throw new Error(`Expected at least 2 [data-customer-version] badges in index.html, found ${customerSpans.length}`);
  }
  for (const val of customerSpans) {
    if (val !== normalLabel) {
      throw new Error(`index.html [data-customer-version] badge has "${val}", expected "${normalLabel}"`);
    }
  }

  const inlineAdminSpans = [...customerHtml.matchAll(/<span\b[^>]*\bdata-admin-version\b[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  if (inlineAdminSpans.length < 5) {
    throw new Error(`Expected at least 5 [data-admin-version] badges in index.html, found ${inlineAdminSpans.length}`);
  }
  for (const val of inlineAdminSpans) {
    if (val !== betaLabel) {
      throw new Error(`index.html [data-admin-version] badge has "${val}", expected "${betaLabel}"`);
    }
  }

  const standaloneAdminSpans = [...adminHtml.matchAll(/<span\b[^>]*\bdata-admin-version\b[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  if (standaloneAdminSpans.length < 6) {
    throw new Error(`Expected at least 6 [data-admin-version] badges in admin/index.html, found ${standaloneAdminSpans.length}`);
  }
  for (const val of standaloneAdminSpans) {
    if (val !== betaLabel) {
      throw new Error(`admin/index.html [data-admin-version] badge has "${val}", expected "${betaLabel}"`);
    }
  }

  const customerSwCache = parseSwCacheNumber(customerSw, 'sj-price-desk-v', 'sw.js');
  const adminSwCache = parseSwCacheNumber(adminSw, 'sj-admin-desk-v', 'admin/sw.js');

  return {
    version,
    normalLabel,
    betaLabel,
    customerSwCache,
    adminSwCache
  };
}

/**
 * Applies a target X.Y.Z version across package.json, Customer views (vX.Y.Z),
 * and Admin views (vX.Y.Z Beta), optionally incrementing Service Worker cache numbers by +1.
 */
export function applyVersionToRepo(rootDir = DEFAULT_ROOT, targetVersion, { bumpServiceWorkers = true } = {}) {
  const cleanVersion = String(targetVersion || '').trim().replace(/^v/i, '').replace(/\s+Beta$/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(cleanVersion)) {
    throw new Error(`Invalid target version "${targetVersion}". Expected X.Y.Z.`);
  }

  const normalLabel = `v${cleanVersion}`;
  const betaLabel = `v${cleanVersion} Beta`;

  // 1. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const previousVersion = pkg.version;
  pkg.version = cleanVersion;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  // 2. index.html (Customer normal version + Inline Admin Beta version)
  const customerHtmlPath = path.join(rootDir, 'index.html');
  let customerHtml = fs.readFileSync(customerHtmlPath, 'utf8');
  customerHtml = customerHtml
    .replace(/const APP_VERSION = 'v[^']+';/, `const APP_VERSION = '${normalLabel}';`)
    .replace(/const ADMIN_APP_VERSION = 'v[^']+ Beta';/, `const ADMIN_APP_VERSION = '${betaLabel}';`)
    .replace(/(<span\b[^>]*\bdata-customer-version\b[^>]*>)[^<]*(<\/span>)/g, `$1${normalLabel}$2`)
    .replace(/(<span\b[^>]*\bdata-admin-version\b[^>]*>)[^<]*(<\/span>)/g, `$1${betaLabel}$2`);
  fs.writeFileSync(customerHtmlPath, customerHtml, 'utf8');

  // 3. admin/index.html (Standalone Admin Beta version)
  const adminHtmlPath = path.join(rootDir, 'admin', 'index.html');
  let adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  adminHtml = adminHtml.replace(/(<span\b[^>]*\bdata-admin-version\b[^>]*>)[^<]*(<\/span>)/g, `$1${betaLabel}$2`);
  fs.writeFileSync(adminHtmlPath, adminHtml, 'utf8');

  // 4. admin/app.js
  const adminJsPath = path.join(rootDir, 'admin', 'app.js');
  let adminJs = fs.readFileSync(adminJsPath, 'utf8');
  adminJs = adminJs.replace(/const ADMIN_APP_VERSION = 'v[^']+ Beta';/, `const ADMIN_APP_VERSION = '${betaLabel}';`);
  fs.writeFileSync(adminJsPath, adminJs, 'utf8');

  // 5. Service Workers (+1 cache version so installed PWAs refresh on update)
  if (bumpServiceWorkers) {
    const customerSwPath = path.join(rootDir, 'sw.js');
    const customerSw = fs.readFileSync(customerSwPath, 'utf8');
    const nextCustomerCache = parseSwCacheNumber(customerSw, 'sj-price-desk-v', 'sw.js') + 1;
    fs.writeFileSync(
      customerSwPath,
      customerSw.replace(/const CACHE = 'sj-price-desk-v\d+';/, `const CACHE = 'sj-price-desk-v${nextCustomerCache}';`),
      'utf8'
    );

    const adminSwPath = path.join(rootDir, 'admin', 'sw.js');
    const adminSw = fs.readFileSync(adminSwPath, 'utf8');
    const nextAdminCache = parseSwCacheNumber(adminSw, 'sj-admin-desk-v', 'admin/sw.js') + 1;
    fs.writeFileSync(
      adminSwPath,
      adminSw.replace(/const CACHE = 'sj-admin-desk-v\d+';/, `const CACHE = 'sj-admin-desk-v${nextAdminCache}';`),
      'utf8'
    );
  }

  const verified = verifyRepoVersions(rootDir);
  return {
    previousVersion,
    ...verified
  };
}

/**
 * Increments the current repo version by +1 at the end across all files.
 */
export function bumpRepoVersion(rootDir = DEFAULT_ROOT, options = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const nextVersion = incrementTrailingVersion(pkg.version);
  return applyVersionToRepo(rootDir, nextVersion, options);
}

/**
 * Verifies that an update branch incremented the version's last number by +1 relative to baseRef.
 */
export function checkUpdatedAgainstBase(rootDir = DEFAULT_ROOT, baseRef = 'origin/main') {
  const current = verifyRepoVersions(rootDir);

  const diffOut = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: rootDir,
    encoding: 'utf8'
  }).trim();
  const changedFiles = diffOut ? diffOut.split('\n').map((s) => s.trim()).filter(Boolean) : [];

  if (changedFiles.length === 0 || changedFiles.every((file) => file.startsWith('catalog/'))) {
    return { skipped: true, reason: 'No app files changed outside catalog/', current };
  }

  const basePkgRaw = execFileSync('git', ['show', `${baseRef}:package.json`], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  const basePkg = JSON.parse(basePkgRaw);
  const expectedVersion = incrementTrailingVersion(basePkg.version);

  if (current.version !== expectedVersion) {
    throw new Error(
      `When updating, version must add 1 at the end: ${baseRef} is v${basePkg.version}, ` +
      `expected v${expectedVersion} (Customer) / v${expectedVersion} Beta (Admin), ` +
      `but found v${current.version}. Run "npm run version:bump".`
    );
  }

  const baseCustomerSw = execFileSync('git', ['show', `${baseRef}:sw.js`], { cwd: rootDir, encoding: 'utf8' });
  const baseAdminSw = execFileSync('git', ['show', `${baseRef}:admin/sw.js`], { cwd: rootDir, encoding: 'utf8' });
  const baseCustomerCache = parseSwCacheNumber(baseCustomerSw, 'sj-price-desk-v', `${baseRef}:sw.js`);
  const baseAdminCache = parseSwCacheNumber(baseAdminSw, 'sj-admin-desk-v', `${baseRef}:admin/sw.js`);

  if (current.customerSwCache <= baseCustomerCache) {
    throw new Error(
      `Customer Service Worker CACHE (sj-price-desk-v${current.customerSwCache}) must increment above ${baseRef} (v${baseCustomerCache}). Run "npm run version:bump".`
    );
  }
  if (current.adminSwCache <= baseAdminCache) {
    throw new Error(
      `Admin Service Worker CACHE (sj-admin-desk-v${current.adminSwCache}) must increment above ${baseRef} (v${baseAdminCache}). Run "npm run version:bump".`
    );
  }

  return {
    skipped: false,
    baseVersion: basePkg.version,
    current
  };
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--verify')) {
      const res = verifyRepoVersions(DEFAULT_ROOT);
      console.log(`Verified versions in sync: Customer ${res.normalLabel} | Admin ${res.betaLabel} (SW: v${res.customerSwCache} / admin v${res.adminSwCache})`);
    } else if (args.includes('--check-updated')) {
      const idx = args.indexOf('--check-updated');
      const baseRef = args[idx + 1] || 'origin/main';
      const res = checkUpdatedAgainstBase(DEFAULT_ROOT, baseRef);
      if (res.skipped) {
        console.log(`Version check passed (${res.reason}): ${res.current.normalLabel}`);
      } else {
        console.log(
          `Version update check passed against ${baseRef}: v${res.baseVersion} -> ${res.current.normalLabel} ` +
          `(Admin: ${res.current.betaLabel}, SW: v${res.current.customerSwCache} / admin v${res.current.adminSwCache})`
        );
      }
    } else {
      const res = bumpRepoVersion(DEFAULT_ROOT);
      console.log(
        `Bumped version (+1): v${res.previousVersion} -> ${res.normalLabel} | Admin: ${res.betaLabel} ` +
        `(SW: sj-price-desk-v${res.customerSwCache}, sj-admin-desk-v${res.adminSwCache})`
      );
    }
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
