import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isIosSafari, isStandaloneMode, loadPwaDismissed, savePwaDismissed } from '../src/pwa.mjs';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

test('PWA manifest, icons, service worker and index.html tags align with GitHub Pages base path', () => {
  const manifest = JSON.parse(read('../public/manifest.webmanifest'));
  assert.equal(manifest.start_url, '/language-exchange-diary/');
  assert.equal(manifest.scope, '/language-exchange-diary/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('/language-exchange-diary/icons/'));
    const localFile = new URL(`../public${icon.src.replace('/language-exchange-diary', '')}`, import.meta.url);
    assert.ok(fs.existsSync(localFile), `missing icon file ${icon.src}`);
  }
  assert.ok(fs.existsSync(new URL('../public/icons/apple-touch-icon.png', import.meta.url)));
  const sw = read('../public/sw.js');
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /led-pwa-v\d+/);
  const html = read('../index.html');
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /viewport-fit=cover/);
});

test('PWA detection helpers classify iOS Safari, standalone mode and dismissal storage safely', () => {
  assert.equal(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), true);
  assert.equal(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1'), false);
  assert.equal(isIosSafari('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), false);
  assert.equal(isStandaloneMode({ matchMedia: () => ({ matches: true }), navigator: {} }), true);
  assert.equal(isStandaloneMode({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true);
  assert.equal(isStandaloneMode({ matchMedia: () => ({ matches: false }), navigator: {} }), false);

  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(loadPwaDismissed(() => storage), false);
  savePwaDismissed(() => storage);
  assert.equal(loadPwaDismissed(() => storage), true);
});
