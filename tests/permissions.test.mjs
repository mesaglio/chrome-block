import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { siteOrigins } from '../src/shared/permissions.ts';

const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

test('a runtime site request is covered by the declared optional permission schemes', () => {
  const origins = siteOrigins('redirectus.net');
  for (const origin of origins) {
    const [scheme, hostPath] = origin.split('://');
    assert.ok(manifest.optional_host_permissions.includes(`${scheme}://*/*`),
      `Only permissions specified in the manifest may be requested: ${origin}`);
    assert.equal(hostPath, 'redirectus.net/*', 'access stays scoped to the chosen hostname');
  }
  assert.ok(origins.some(origin => origin.startsWith('http://')), 'HTTP is supported');
  assert.ok(origins.some(origin => origin.startsWith('https://')), 'HTTPS is supported');
});
