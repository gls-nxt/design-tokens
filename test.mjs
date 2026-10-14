// Run after `pnpm build`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as light from './packages/web/dist/light.js';
import * as dark from './packages/web/dist/dark.js';

const KT = 'packages/kotlin/src/commonMain/kotlin/com/glsnxt/designtokens/color/';

test('js exports resolve per mode', () => {
  assert.equal(light.surfaceSelectionDefault, '#061ab1');
  assert.equal(dark.surfaceSelectionDefault, '#1238d2');
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
});

test('css has light root and dark overrides', async () => {
  const css = await readFile('packages/web/dist/tokens.css', 'utf8');
  assert.match(css, /:root \{[^}]*--unity-blue-700: #061ab1;/);
  assert.match(css, /\[data-theme="dark"\] \{[^}]*--unity-surface-selection-default: var\(--unity-blue-dark-700\);/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test('kotlin has data class with light and dark factories', async () => {
  const kt = await readFile(`${KT}SurfaceColors.kt`, 'utf8');
  assert.match(kt, /data class SurfaceColors\(/);
  assert.match(kt, /fun lightSurfaceColors\(\) = SurfaceColors\([^)]*selectionDefault = PrimitiveColors\.Blue\.Blue700,/);
  assert.match(kt, /fun darkSurfaceColors\(\) = SurfaceColors\([^)]*selectionDefault = PrimitiveColors\.BlueDark\.BlueDark700,/);
  const primitives = await readFile(`${KT}PrimitiveColors.kt`, 'utf8');
  assert.match(primitives, /val BlackAlpha1 = Color\(0x03000000\)/);
});
