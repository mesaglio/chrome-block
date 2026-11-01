import test from 'node:test';
import assert from 'node:assert/strict';
import { siteHostname, normalizeSettings, isProtected, recoverableUrl } from '../src/shared/policy.ts';

test('installation and corrupt settings leave every site unprotected', () => {
  for (const input of [undefined, null, 'bad', {}]) {
    const settings = normalizeSettings(input);
    assert.deepEqual(settings, { enabled: true, sites: [] });
    assert.equal(isProtected(settings, 'https://example.com/'), false);
  }
});
test('only explicitly selected exact hostnames are protected', () => {
  const settings = normalizeSettings({ enabled: true, sites: ['example.com'] });
  assert.equal(isProtected(settings, 'https://example.com/path?q=1'), true);
  assert.equal(isProtected(settings, 'http://example.com:8080/'), true);
  assert.equal(isProtected(settings, 'https://www.example.com/'), false);
  assert.equal(isProtected(settings, 'https://example.com.evil.test/'), false);
  assert.equal(isProtected(settings, 'https://other.test/?ref=example.com'), false);
});
test('global suspension preserves the user selection', () => {
  const settings = normalizeSettings({ enabled: false, sites: ['example.com'] });
  assert.deepEqual(settings.sites, ['example.com']);
  assert.equal(isProtected(settings, 'https://example.com/'), false);
});
test('hostname parser rejects privileged pages and Chrome Web Store', () => {
  for (const value of ['chrome://extensions', 'about:blank', 'file:///tmp/test.html', 'javascript:alert(1)', 'bad', 'https://chromewebstore.google.com/detail/x', 'https://chrome.google.com/webstore/detail/x', null]) {
    assert.equal(siteHostname(value), null, String(value));
  }
  assert.equal(siteHostname('https://EXAMPLE.COM:443/abc#x'), 'example.com');
  assert.equal(siteHostname('http://127.0.0.1:8765/'), '127.0.0.1');
  assert.equal(siteHostname('http://[::1]:8765/'), '[::1]');
});
test('invalid stored hosts cannot create wildcard or path-wide rules', () => {
  assert.deepEqual(normalizeSettings({ enabled: 'yes', sites: ['EXAMPLE.COM', '*.test', 'test/a', 'test:80', 'https://test', '', 1, 'example.com', 'test?x', '__proto__'] }), { enabled: true, sites: ['example.com'] });
});
test('manual recovery allows only absolute HTTP(S) without embedded credentials', () => {
  assert.equal(recoverableUrl('https://example.com/path?a=1#x'), 'https://example.com/path?a=1#x');
  for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'file:///a', 'chrome://settings', '/relative', '//example.com', 'https://user:secret@example.com', '', null, 'https://example.com\n.evil.test']) {
    assert.equal(recoverableUrl(value), null, String(value));
  }
});
