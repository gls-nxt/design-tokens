import fs from 'node:fs/promises';
import StyleDictionary from 'style-dictionary';

const WEB_DIST = 'packages/web/dist/';
const KT_PACKAGE = 'com.glsnxt.designtokens.color';
const KT_DIR = `packages/kotlin/src/commonMain/kotlin/${KT_PACKAGE.replaceAll('.', '/')}/`;
const HEADER = '// Generated from tokens/ by build.mjs. Do not edit.';
const KOTLIN_KEYWORDS = new Set('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while'.split(' '));

const isSemantic = (token) => token.filePath.includes('/semantic/');

const sdFor = (mode) =>
  new StyleDictionary({
    source: ['tokens/primitive/*.tokens.json', `tokens/semantic/color.${mode}.tokens.json`],
    // The dark CSS block references primitives that only live in :root; that warning is expected.
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: {
      css: {
        transformGroup: 'css',
        prefix: 'unity',
        files:
          mode === 'light'
            ? [{ format: 'css/variables', options: { outputReferences: true, selector: ':root' } }]
            : [
                { format: 'css/variables', filter: isSemantic, options: { outputReferences: true, showFileHeader: false, selector: '[data-theme="dark"]' } },
                { format: 'css/variables', filter: isSemantic, options: { outputReferences: true, showFileHeader: false, selector: ['@media (prefers-color-scheme: dark)', ':root:not([data-theme="light"])'] } },
              ],
      },
      // No output files: resolved, untransformed tokens for the Kotlin and TOKENS.md writers.
      resolved: { transforms: [] },
    },
  });

// --- Kotlin naming: primitives `PrimitiveColors.BlueDark.BlueDark700`, semantic `SurfaceColors.selectionDefault`
const pascal = (s) => s.replace(/(?:^|-)(\w)/g, (_, c) => c.toUpperCase());
const camel = (s) => pascal(s).replace(/^./, (c) => c.toLowerCase());
const primitiveRef = (path) => `PrimitiveColors.${pascal(path[0])}.${pascal(path.join('-'))}`;
const ktColor = (hex) => {
  const h = hex.slice(1);
  return `Color(0x${(h.slice(6) || 'ff').toUpperCase()}${h.slice(0, 6).toUpperCase()})`;
};
const ktValue = (token) => {
  const ref = /^\{(.+)\}$/.exec(token.original.$value);
  return ref ? primitiveRef(ref[1].split('.')) : ktColor(token.original.$value);
};
const groupBy = (tokens) => Map.groupBy(tokens, (t) => t.path[0]);

function checkNames(names) {
  const bad = names.filter((n) => !/^[A-Za-z][A-Za-z0-9]*$/.test(n) || KOTLIN_KEYWORDS.has(n));
  if (bad.length) throw new Error(`Invalid generated names (must start with a letter, no Kotlin keywords): ${bad.join(', ')}`);
}

function checkParity(light, dark) {
  const keys = (tokens) => new Set(tokens.map((t) => t.path.join('.')));
  const [l, d] = [keys(light), keys(dark)];
  const diff = [...l.symmetricDifference(d)];
  if (diff.length) throw new Error(`Light and dark modes must define the same tokens. Mismatch: ${diff.join(', ')}`);
}

function kotlinFiles(primitives, light, dark) {
  const files = {};
  const head = `${HEADER}\npackage ${KT_PACKAGE}\n\nimport androidx.compose.ui.graphics.Color\n`;

  const objects = [...groupBy(primitives)].map(
    ([group, tokens]) =>
      `    object ${pascal(group)} {\n${tokens.map((t) => `        val ${pascal(t.path.join('-'))} = ${ktColor(t.original.$value)}`).join('\n')}\n    }`,
  );
  files['PrimitiveColors.kt'] = `${head}\nobject PrimitiveColors {\n${objects.join('\n\n')}\n}\n`;

  const darkGroups = groupBy(dark);
  for (const [group, tokens] of groupBy(light)) {
    const cls = `${pascal(group)}Colors`;
    const field = (t) => camel(t.path.slice(1).join('-'));
    const factory = (mode, list) =>
      `fun ${mode}${cls}() = ${cls}(\n${list.map((t) => `    ${field(t)} = ${ktValue(t)},`).join('\n')}\n)`;
    files[`${cls}.kt`] =
      `${head}\ndata class ${cls}(\n${tokens.map((t) => `    val ${field(t)}: Color,`).join('\n')}\n)\n\n` +
      `${factory('light', tokens)}\n\n${factory('dark', darkGroups.get(group))}\n`;
  }
  return files;
}

// --- Repo preview: TOKENS.md + one SVG per unique colour value. Committed, so GitHub renders it in place.
const SWATCH_DIR = 'docs/swatches/';
const hexOf = (value) => value.toLowerCase().replace(/^(#[0-9a-f]{6})ff$/, '$1');
const swatchFile = (hex) => `${SWATCH_DIR}${hex.slice(1)}.svg`;
const swatch = (hex) => `![${hex}](${swatchFile(hex)})`;

function swatchSvg(hex) {
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
  // Transparent colours sit on a checkerboard so their alpha is visible.
  const checker =
    alpha < 1
      ? '<defs><pattern id="c" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><path d="M0 0h4v4H0zM4 4h4v4H4z" fill="#ccc"/></pattern></defs><rect width="40" height="20" rx="4" fill="url(#c)"/>'
      : '';
  // The neutral border keeps white and near-black swatches visible on both GitHub themes.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">${checker}<rect x=".5" y=".5" width="39" height="19" rx="3.5" fill="${hex.slice(0, 7)}" fill-opacity="${+alpha.toFixed(3)}" stroke="#808080" stroke-opacity=".5"/></svg>\n`;
}

function tokensMarkdown(primitives, light, dark) {
  const ref = (t) => /^\{(.+)\}$/.exec(t.original.$value)?.[1];
  const cell = (t) => `${swatch(hexOf(t.$value))} \`${hexOf(t.$value)}\`${ref(t) ? `<br>\`${ref(t)}\`` : ''}`;
  const out = [
    '# Tokens',
    '',
    '> Generated by `npm run build` from `tokens/`. Do not edit.',
    '',
    '## Semantic colours',
    '',
    'Light and dark values, with the primitive each one references.',
  ];
  const darkByPath = new Map(dark.map((t) => [t.path.join('.'), t]));
  for (const [group, tokens] of groupBy(light)) {
    out.push('', `### ${group}`, '', '| Token | Light | Dark | CSS | Kotlin |', '| --- | --- | --- | --- | --- |');
    for (const t of tokens) {
      const path = t.path.join('.');
      out.push(
        `| \`${path}\` | ${cell(t)} | ${cell(darkByPath.get(path))} | \`--unity-${t.path.join('-')}\` | \`${pascal(group)}Colors.${camel(t.path.slice(1).join('-'))}\` |`,
      );
    }
  }
  out.push('', '## Primitives', '', 'CSS `--unity-<family>-<step>`, Kotlin `PrimitiveColors.<Family>.<Family><Step>`.');
  for (const [family, tokens] of groupBy(primitives)) {
    const steps = tokens.map((t) => t.path.slice(1).join('-'));
    out.push(
      '',
      `### ${family}`,
      '',
      `| ${steps.join(' | ')} |`,
      `| ${steps.map(() => '---').join(' | ')} |`,
      `| ${tokens.map((t) => swatch(hexOf(t.$value))).join(' | ')} |`,
      `| ${tokens.map((t) => `\`${hexOf(t.$value)}\``).join(' | ')} |`,
    );
  }
  return out.join('\n') + '\n';
}

const [light, dark] = [sdFor('light'), sdFor('dark')];
const lightTokens = (await light.getPlatformTokens('resolved')).allTokens;
const darkTokens = (await dark.getPlatformTokens('resolved')).allTokens;
const [lightSemantic, darkSemantic] = [lightTokens.filter(isSemantic), darkTokens.filter(isSemantic)];
const primitives = lightTokens.filter((t) => !isSemantic(t));

checkParity(lightSemantic, darkSemantic);
checkNames([
  ...primitives.flatMap((t) => [pascal(t.path[0]), pascal(t.path.join('-'))]),
  ...lightSemantic.flatMap((t) => [`${pascal(t.path[0])}Colors`, camel(t.path.slice(1).join('-'))]),
]);

await fs.rm(WEB_DIST, { recursive: true, force: true });
await fs.rm(KT_DIR, { recursive: true, force: true });
await fs.mkdir(KT_DIR, { recursive: true });

await fs.mkdir(WEB_DIST, { recursive: true });
const css = [...(await light.formatPlatform('css')), ...(await dark.formatPlatform('css'))].map((f) => f.output);
await fs.writeFile(`${WEB_DIST}tokens.css`, css.join('\n'));

for (const [file, source] of Object.entries(kotlinFiles(primitives, lightSemantic, darkSemantic))) {
  await fs.writeFile(KT_DIR + file, source);
}

await fs.rm(SWATCH_DIR, { recursive: true, force: true });
await fs.mkdir(SWATCH_DIR, { recursive: true });
const hexes = new Set([...lightTokens, ...darkTokens].map((t) => hexOf(t.$value)));
for (const hex of hexes) await fs.writeFile(swatchFile(hex), swatchSvg(hex));
await fs.writeFile('TOKENS.md', tokensMarkdown(primitives, lightSemantic, darkSemantic));
console.log(`Built ${primitives.length} primitives, ${lightSemantic.length} semantic tokens × 2 modes.`);
