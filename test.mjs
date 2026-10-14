// Run after `pnpm build`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const KT = 'packages/kotlin/src/commonMain/kotlin/com/glsnxt/designtokens/';

test('css has light root and dark overrides', async () => {
  const css = await readFile('packages/web/dist/tokens.css', 'utf8');
  assert.match(css, /:root \{[^}]*--unity-blue-700: #061ab1;/);
  assert.match(css, /\[data-theme="dark"\] \{[^}]*--unity-surface-selection-default: var\(--unity-blue-dark-700\);/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test('kotlin has data class with light and dark factories', async () => {
  const kt = await readFile(`${KT}color/SurfaceColors.kt`, 'utf8');
  assert.match(kt, /data class SurfaceColors\(/);
  assert.match(kt, /fun lightSurfaceColors\(\) = SurfaceColors\([^)]*selectionDefault = PrimitiveColors\.Blue\.Blue700,/);
  assert.match(kt, /fun darkSurfaceColors\(\) = SurfaceColors\([^)]*selectionDefault = PrimitiveColors\.BlueDark\.BlueDark700,/);
  const primitives = await readFile(`${KT}color/PrimitiveColors.kt`, 'utf8');
  assert.match(primitives, /val BlackAlpha1 = Color\(0x03000000\)/);
});

test('css has viewport overrides and non-colour primitives', async () => {
  const css = await readFile('packages/web/dist/tokens.css', 'utf8');
  assert.match(css, /:root \{[^}]*--unity-spacing-4: var\(--unity-scale-400\);/);
  assert.match(css, /:root \{[^}]*--unity-h1-font-size: var\(--unity-font-size-42\);/);
  assert.match(css, /\[data-viewport="locker"\] \{[^}]*--unity-h1-font-size: var\(--unity-font-size-48\);/);
  // Group-level $type must not leak across files: colours stay colours.
  assert.match(css, /--unity-black-alpha-1: rgba\(0, 0, 0, /);
});

test('kotlin has viewport factories and typed primitives', async () => {
  const kt = await readFile(`${KT}Viewport.kt`, 'utf8');
  assert.match(kt, /val h1FontSize: TextUnit,/);
  assert.match(kt, /fun lockerViewport\(\) = Viewport\([^)]*h1FontSize = PrimitiveTokens\.Font\.FontSize48,/);
  const primitives = await readFile(`${KT}PrimitiveTokens.kt`, 'utf8');
  assert.match(primitives, /val Scale400 = 16\.dp/);
  assert.match(primitives, /val FontLetterSpacing12 = \(-0\.86\)\.sp/);
});

test('token diff resolves references and reports changes', async () => {
  const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { loadTokens, diffTokens, toMarkdown } = await import('./token-diff.mjs');
  const checkout = async (blue700, darkRef) => {
    const dir = await mkdtemp(`${tmpdir()}/tokens-`);
    await mkdir(`${dir}/tokens/primitive`, { recursive: true });
    await mkdir(`${dir}/tokens/semantic`);
    const json = (o) => JSON.stringify({ $type: 'color', ...o });
    await writeFile(`${dir}/tokens/primitive/color.tokens.json`, json({ blue: { 700: { $value: blue700 }, 800: { $value: '#05168f' } } }));
    await writeFile(`${dir}/tokens/semantic/color.light.tokens.json`, json({ text: { link: { $value: '{blue.700}' } } }));
    await writeFile(`${dir}/tokens/semantic/color.dark.tokens.json`, json({ text: { link: { $value: darkRef } } }));
    return loadTokens(dir);
  };
  const rows = diffTokens(await checkout('#061ab1', '{blue.700}'), await checkout('#061AB1', '{blue.800}'));
  assert.deepEqual(rows, [['text.link (dark)', '#061ab1', '#05168f']]);
  assert.match(toMarkdown(rows), /\| `text.link \(dark\)` \| `#061ab1` \| `#05168f` \|/);
  assert.match(toMarkdown([]), /No token changes/);

  const sizes = async (px) => {
    const dir = await mkdtemp(`${tmpdir()}/tokens-`);
    await mkdir(`${dir}/tokens/primitive`, { recursive: true });
    await mkdir(`${dir}/tokens/viewport`);
    await writeFile(`${dir}/tokens/primitive/size.tokens.json`, JSON.stringify({ scale: { 400: { $value: { value: px, unit: 'px' } } }, spacing: { 4: { $value: '{scale.400}' } } }));
    await writeFile(`${dir}/tokens/viewport/viewport.mobile.tokens.json`, JSON.stringify({ gap: { $value: '{spacing.4}' } }));
    return loadTokens(dir);
  };
  assert.deepEqual(diffTokens(await sizes(16), await sizes(20)), [
    ['gap (mobile)', '16px', '20px'],
    ['scale.400', '16px', '20px'],
    ['spacing.4', '16px', '20px'],
  ]);
});
