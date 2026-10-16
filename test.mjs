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
  assert.match(css, /:root \{[^}]*--unity-spacing-4: 1rem;/);
  assert.match(css, /:root \{[^}]*--unity-h1-font-size: var\(--unity-font-size-42\);/);
  assert.match(css, /\[data-viewport="locker"\] \{[^}]*--unity-h1-font-size: var\(--unity-font-size-48\);/);
  assert.match(css, /--unity-spacing-0: 0;/);
  assert.doesNotMatch(css, /--unity-scale-/);
  assert.match(css, /--unity-font-letter-spacing-12: -0\.05375rem;/);
  assert.doesNotMatch(css, /\dpx;/);
  // Group-level $type must not leak across files: colours stay colours.
  assert.match(css, /--unity-black-alpha-1: rgba\(0, 0, 0, /);
});

test('kotlin has viewport factories and typed primitives', async () => {
  const kt = await readFile(`${KT}Viewport.kt`, 'utf8');
  assert.match(kt, /val h1FontSize: TextUnit,/);
  assert.match(kt, /fun lockerViewport\(\) = Viewport\([^)]*h1FontSize = PrimitiveTokens\.Font\.FontSize48,/);
  const primitives = await readFile(`${KT}PrimitiveTokens.kt`, 'utf8');
  assert.match(primitives, /val Spacing4 = 16\.dp/);
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

  const dir = await mkdtemp(`${tmpdir()}/tokens-`);
  await mkdir(`${dir}/tokens/semantic`, { recursive: true });
  await writeFile(`${dir}/tokens/semantic/color.light.tokens.json`, JSON.stringify({ text: { hover: { $value: '#000000', $extensions: { 'com.glsnxt.platforms': { kotlin: false } } } } }));
  assert.equal((await loadTokens(dir))['text.hover [kotlin] (light)'], 'excluded');

  // A Kotlin primitive value reaches the semantic tokens that reference it, through primitive references too.
  const kotlinBlue = async (hex) => {
    const dir = await mkdtemp(`${tmpdir()}/tokens-`);
    await mkdir(`${dir}/tokens/primitive`, { recursive: true });
    await mkdir(`${dir}/tokens/semantic`);
    const blue = { 800: { $value: '#05168f', $extensions: { 'com.glsnxt.platforms': { kotlin: { $value: hex } } } }, brand: { $value: '{blue.800}' } };
    await writeFile(`${dir}/tokens/primitive/color.tokens.json`, JSON.stringify({ $type: 'color', blue }));
    await writeFile(`${dir}/tokens/semantic/color.light.tokens.json`, JSON.stringify({ text: { link: { $value: '{blue.brand}' } } }));
    return loadTokens(dir);
  };
  assert.deepEqual(diffTokens(await kotlinBlue('#112233'), await kotlinBlue('#445566')), [
    ['blue.800 [kotlin]', '#112233', '#445566'],
    ['blue.brand [kotlin]', '#112233', '#445566'],
    ['text.link [kotlin] (light)', '#112233', '#445566'],
  ]);

  const sizes = async (px) => {
    const dir = await mkdtemp(`${tmpdir()}/tokens-`);
    await mkdir(`${dir}/tokens/primitive`, { recursive: true });
    await mkdir(`${dir}/tokens/viewport`);
    await writeFile(`${dir}/tokens/primitive/size.tokens.json`, JSON.stringify({ spacing: { 4: { $value: { value: px, unit: 'px' } } } }));
    await writeFile(`${dir}/tokens/viewport/viewport.mobile.tokens.json`, JSON.stringify({ gap: { $value: '{spacing.4}' } }));
    return loadTokens(dir);
  };
  assert.deepEqual(diffTokens(await sizes(16), await sizes(20)), [
    ['gap (mobile)', '16px', '20px'],
    ['spacing.4', '16px', '20px'],
  ]);
});

test('platform overrides drop or replace a token on one platform only', async () => {
  const { cp, mkdtemp, symlink, writeFile } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(`${tmpdir()}/tokens-`);
  await cp('tokens', `${dir}/tokens`, { recursive: true });
  await cp('build.mjs', `${dir}/build.mjs`);
  await symlink(`${process.cwd()}/node_modules`, `${dir}/node_modules`);
  const edit = async (file, fn) => {
    const json = JSON.parse(await readFile(`${dir}/tokens/${file}.tokens.json`, 'utf8'));
    fn(json);
    await writeFile(`${dir}/tokens/${file}.tokens.json`, JSON.stringify(json));
  };
  const ext = (platforms) => ({ 'com.glsnxt.platforms': platforms });
  for (const mode of ['light', 'dark']) await edit(`semantic/color.${mode}`, (j) => (j.surface['brand-hover'].$extensions = ext({ kotlin: false })));
  await edit('primitive/color', (j) => (j.blue['700'].$extensions = ext({ kotlin: { $value: '#112233' } })));
  for (const v of ['desktop', 'mobile', 'locker']) await edit(`viewport/viewport.${v}`, (j) => (j.h1['font-size'].$extensions = ext({ kotlin: { $value: '{font.size.24}' } })));
  execFileSync('node', ['build.mjs'], { cwd: dir });

  const css = await readFile(`${dir}/packages/web/dist/tokens.css`, 'utf8');
  assert.match(css, /--unity-surface-brand-hover:/);
  assert.match(css, /--unity-h1-font-size: var\(--unity-font-size-42\);/);
  assert.doesNotMatch(await readFile(`${dir}/${KT}color/SurfaceColors.kt`, 'utf8'), /brandHover/);
  assert.match(await readFile(`${dir}/${KT}Viewport.kt`, 'utf8'), /fun desktopViewport\(\) = Viewport\([^)]*h1FontSize = PrimitiveTokens\.Font\.FontSize24,/);
  const md = await readFile(`${dir}/TOKENS.md`, 'utf8');
  assert.match(md, /\| `surface\.brand-hover` \|.*\| — \|$/m);
  // The overridden primitive shows in its own table and in every semantic token that references it.
  assert.match(md, /\| Kotlin: !\[#112233\]\(docs\/swatches\/112233\.svg\) `#112233` \|/);
  assert.match(md, /\| `surface\.selection-default` \|.*`SurfaceColors\.selectionDefault`<br>light: .*`#112233`/);

  await edit('semantic/color.light', (j) => (j.surface['brand-default'].$extensions = ext({ kotiln: false })));
  assert.throws(() => execFileSync('node', ['build.mjs'], { cwd: dir, stdio: 'pipe' }), /com\.glsnxt\.platforms\.kotiln/);

  await edit('semantic/color.light', (j) => (j.surface['brand-default'].$extensions = { 'com.glsnxt.platforms': [] }));
  assert.throws(() => execFileSync('node', ['build.mjs'], { cwd: dir, stdio: 'pipe' }), /com\.glsnxt\.platforms must be an object/);
});
