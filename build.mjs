import fs from 'node:fs/promises';
import StyleDictionary from 'style-dictionary';

const WEB_DIST = 'packages/web/dist/';
const KT_PACKAGE = 'com.glsnxt.designtokens';
const KT_DIR = `packages/kotlin/src/commonMain/kotlin/${KT_PACKAGE.replaceAll('.', '/')}/`;
const HEADER = '// Generated from tokens/ by build.mjs. Do not edit.';
const KOTLIN_KEYWORDS = new Set('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while'.split(' '));
const VIEWPORTS = ['desktop', 'mobile', 'locker'];

const inFile = (name) => (token) => token.filePath.endsWith(`tokens/${name}.tokens.json`);
const isPrimitive = (token) => token.filePath.includes('/primitive/');
const cssFile = (selector, filter) => ({ format: 'css/variables', filter, options: { outputReferences: true, showFileHeader: false, selector } });

const sdFor = (sources, files) =>
  new StyleDictionary({
    source: ['tokens/primitive/*.tokens.json', 'tokens/semantic/font.tokens.json', ...sources],
    // The mode blocks reference primitives that only live in :root; that warning is expected.
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: {
      css: { transformGroup: 'css', prefix: 'unity', files },
      // No output files: resolved, untransformed tokens for the Kotlin and TOKENS.md writers.
      resolved: { transforms: [] },
    },
  });

// :root holds every primitive and the default modes (light, desktop). The other modes override only their own tokens.
const sds = {
  light: sdFor(
    ['tokens/semantic/color.light.tokens.json', 'tokens/viewport/viewport.desktop.tokens.json'],
    [{ format: 'css/variables', options: { outputReferences: true, selector: ':root' } }],
  ),
  dark: sdFor(['tokens/semantic/color.dark.tokens.json'], [
    cssFile('[data-theme="dark"]', inFile('semantic/color.dark')),
    cssFile(['@media (prefers-color-scheme: dark)', ':root:not([data-theme="light"])'], inFile('semantic/color.dark')),
  ]),
  mobile: sdFor(['tokens/viewport/viewport.mobile.tokens.json'], [cssFile('[data-viewport="mobile"]', inFile('viewport/viewport.mobile'))]),
  locker: sdFor(['tokens/viewport/viewport.locker.tokens.json'], [cssFile('[data-viewport="locker"]', inFile('viewport/viewport.locker'))]),
};

// --- Kotlin naming: primitives `PrimitiveColors.BlueDark.BlueDark700`, `PrimitiveTokens.Spacing.Spacing4`;
// semantic `SurfaceColors.selectionDefault`, `Viewport.h1FontSize`, `FontTokens.heading`
const pascal = (s) => s.replace(/(?:^|-)(\w)/g, (_, c) => c.toUpperCase());
const camel = (s) => pascal(s).replace(/^./, (c) => c.toLowerCase());
const primitiveObject = (token) => (token.$type === 'color' ? 'PrimitiveColors' : 'PrimitiveTokens');
const refOf = (token) => (typeof token.original.$value === 'string' ? /^\{(.+)\}$/.exec(token.original.$value)?.[1] : undefined);
// Text sizes are `sp` so they follow the user's font scale; every other dimension is `dp`.
const isText = (token) => token.path.some((p) => /^(font|line-height|letter-spacing)/.test(p));
const ktColor = (hex) => {
  const h = hex.slice(1);
  return `Color(0x${(h.slice(6) || 'ff').toUpperCase()}${h.slice(0, 6).toUpperCase()})`;
};
const ktLiteral = (token) => {
  const v = token.original.$value;
  switch (token.$type) {
    case 'color': return ktColor(v);
    case 'dimension': return `${v.value < 0 ? `(${v.value})` : v.value}.${isText(token) ? 'sp' : 'dp'}`;
    case 'fontWeight': return `FontWeight(${v})`;
    case 'fontFamily': return JSON.stringify(v);
    case 'number': return `${v}`;
  }
  throw new Error(`No Kotlin mapping for $type "${token.$type}" (${token.path.join('.')})`);
};
const ktType = (token) =>
  ({ color: 'Color', fontWeight: 'FontWeight', fontFamily: 'String', number: 'Int' })[token.$type] ?? (isText(token) ? 'TextUnit' : 'Dp');
const ktValue = (token) => {
  const ref = refOf(token)?.split('.');
  return ref ? `${primitiveObject(token)}.${pascal(ref[0])}.${pascal(ref.join('-'))}` : ktLiteral(token);
};
const groupBy = (tokens) => Map.groupBy(tokens, (t) => t.path[0]);

const KT_IMPORTS = {
  Color: 'androidx.compose.ui.graphics.Color',
  FontWeight: 'androidx.compose.ui.text.font.FontWeight',
  Dp: 'androidx.compose.ui.unit.Dp',
  TextUnit: 'androidx.compose.ui.unit.TextUnit',
  dp: 'androidx.compose.ui.unit.dp',
  sp: 'androidx.compose.ui.unit.sp',
};
const ktFile = (pkg, body) => {
  const imports = Object.entries(KT_IMPORTS).filter(([name]) => new RegExp(`\\b${name}\\b`).test(body));
  return `${HEADER}\npackage ${pkg}\n\n${imports.map(([, fq]) => `import ${fq}\n`).join('')}\n${body}`;
};

const ktPrimitives = (name, tokens) => {
  const objects = [...groupBy(tokens)].map(
    ([group, list]) => `    object ${pascal(group)} {\n${list.map((t) => `        val ${pascal(t.path.join('-'))} = ${ktValue(t)}`).join('\n')}\n    }`,
  );
  return `object ${name} {\n${objects.join('\n\n')}\n}\n`;
};

// One data class, with a `<mode><Class>()` factory per mode.
const ktDataClass = (cls, field, modes) => {
  const factory = ([mode, list]) => `fun ${mode}${cls}() = ${cls}(\n${list.map((t) => `    ${field(t)} = ${ktValue(t)},`).join('\n')}\n)`;
  return (
    `data class ${cls}(\n${Object.values(modes)[0].map((t) => `    val ${field(t)}: ${ktType(t)},`).join('\n')}\n)\n\n` +
    `${Object.entries(modes).map(factory).join('\n\n')}\n`
  );
};

const groupField = (t) => camel(t.path.slice(1).join('-'));
const pathField = (t) => camel(t.path.join('-'));

function kotlinFiles({ colorPrimitives, otherPrimitives, light, dark, fonts, viewports }) {
  const color = `${KT_PACKAGE}.color`;
  const files = { 'color/PrimitiveColors.kt': ktFile(color, ktPrimitives('PrimitiveColors', colorPrimitives)) };
  const darkGroups = groupBy(dark);
  for (const [group, tokens] of groupBy(light)) {
    const cls = `${pascal(group)}Colors`;
    files[`color/${cls}.kt`] = ktFile(color, ktDataClass(cls, groupField, { light: tokens, dark: darkGroups.get(group) }));
  }
  files['PrimitiveTokens.kt'] = ktFile(KT_PACKAGE, ktPrimitives('PrimitiveTokens', otherPrimitives));
  for (const [group, tokens] of groupBy(fonts)) {
    const obj = `${pascal(group)}Tokens`;
    files[`${obj}.kt`] = ktFile(KT_PACKAGE, `object ${obj} {\n${tokens.map((t) => `    val ${groupField(t)} = ${ktValue(t)}`).join('\n')}\n}\n`);
  }
  files['Viewport.kt'] = ktFile(KT_PACKAGE, ktDataClass('Viewport', pathField, viewports));
  return files;
}

function kotlinNames({ colorPrimitives, otherPrimitives, light, fonts, viewports }) {
  const primitive = (obj) => (t) => `${obj}.${pascal(t.path[0])}.${pascal(t.path.join('-'))}`;
  return [
    ...colorPrimitives.map(primitive('PrimitiveColors')),
    ...otherPrimitives.map(primitive('PrimitiveTokens')),
    ...light.map((t) => `${pascal(t.path[0])}Colors.${groupField(t)}`),
    ...fonts.map((t) => `${pascal(t.path[0])}Tokens.${groupField(t)}`),
    ...viewports.desktop.map((t) => `Viewport.${pathField(t)}`),
  ];
}

function checkNames(qualified) {
  const bad = qualified.flatMap((q) => q.split('.')).filter((n) => !/^[A-Za-z][A-Za-z0-9]*$/.test(n) || KOTLIN_KEYWORDS.has(n));
  if (bad.length) throw new Error(`Invalid generated names (must start with a letter, no Kotlin keywords): ${[...new Set(bad)].join(', ')}`);
  const dupes = qualified.filter((q, i) => qualified.indexOf(q) !== i);
  if (dupes.length) throw new Error(`Generated names collide: ${dupes.join(', ')}`);
}

function checkParity(modes) {
  const keys = (tokens) => new Set(tokens.map((t) => t.path.join('.')));
  const [[first, base], ...rest] = Object.entries(modes);
  for (const [mode, tokens] of rest) {
    const diff = [...keys(base).symmetricDifference(keys(tokens))];
    if (diff.length) throw new Error(`Modes ${first} and ${mode} must define the same tokens. Mismatch: ${diff.join(', ')}`);
  }
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

const display = (t) => (typeof t.$value === 'object' ? `${t.$value.value}${t.$value.unit}` : `${t.$value}`);

function tokensMarkdown({ colorPrimitives, otherPrimitives, light, dark, fonts, viewports }, cssNames) {
  const css = (t) => `\`${cssNames.get(t.path.join('.'))}\``;
  const withRef = (value, t) => `${value}${refOf(t) ? `<br>\`${refOf(t)}\`` : ''}`;
  const colorCell = (t) => withRef(`${swatch(hexOf(t.$value))} \`${hexOf(t.$value)}\``, t);
  const valueCell = (t) => withRef(`\`${display(t)}\``, t);
  const out = [
    '# Tokens',
    '',
    '> Generated by `pnpm build` from `tokens/`. Do not edit.',
    '',
    '## Semantic colours',
    '',
    'Light and dark values, with the primitive each one references.',
  ];
  const darkByPath = new Map(dark.map((t) => [t.path.join('.'), t]));
  for (const [group, tokens] of groupBy(light)) {
    out.push('', `### ${group}`, '', '| Token | Light | Dark | CSS | Kotlin |', '| --- | --- | --- | --- | --- |');
    for (const t of tokens) {
      out.push(`| \`${t.path.join('.')}\` | ${colorCell(t)} | ${colorCell(darkByPath.get(t.path.join('.')))} | ${css(t)} | \`${pascal(group)}Colors.${groupField(t)}\` |`);
    }
  }

  out.push(
    '',
    '## Viewport',
    '',
    'Sizes per viewport, with the primitive each one references. Desktop is the default; set `data-viewport="mobile"` or `data-viewport="locker"` to switch on the web.',
    '',
    `| Token | ${VIEWPORTS.map(pascal).join(' | ')} | CSS | Kotlin |`,
    `| --- | ${VIEWPORTS.map(() => '---').join(' | ')} | --- | --- |`,
  );
  const byPath = Object.fromEntries(VIEWPORTS.map((v) => [v, new Map(viewports[v].map((t) => [t.path.join('.'), t]))]));
  for (const t of viewports.desktop) {
    const path = t.path.join('.');
    out.push(`| \`${path}\` | ${VIEWPORTS.map((v) => valueCell(byPath[v].get(path))).join(' | ')} | ${css(t)} | \`Viewport.${pathField(t)}\` |`);
  }

  out.push('', '## Fonts', '', '| Token | Value | CSS | Kotlin |', '| --- | --- | --- | --- |');
  for (const t of fonts) out.push(`| \`${t.path.join('.')}\` | ${valueCell(t)} | ${css(t)} | \`${pascal(t.path[0])}Tokens.${groupField(t)}\` |`);

  out.push('', '## Primitive colours', '', 'CSS `--unity-<family>-<step>`, Kotlin `PrimitiveColors.<Family>.<Family><Step>`.');
  for (const [family, tokens] of groupBy(colorPrimitives)) {
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

  out.push('', '## Other primitives');
  for (const [group, tokens] of groupBy(otherPrimitives)) {
    out.push('', `### ${group}`, '', '| Token | Value | CSS | Kotlin |', '| --- | --- | --- | --- |');
    for (const t of tokens) out.push(`| \`${t.path.join('.')}\` | ${valueCell(t)} | ${css(t)} | \`PrimitiveTokens.${pascal(group)}.${pascal(t.path.join('-'))}\` |`);
  }
  return out.join('\n') + '\n';
}

const resolved = Object.fromEntries(
  await Promise.all(Object.entries(sds).map(async ([mode, sd]) => [mode, (await sd.getPlatformTokens('resolved')).allTokens])),
);
const primitives = resolved.light.filter(isPrimitive);
const tokens = {
  colorPrimitives: primitives.filter((t) => t.$type === 'color'),
  otherPrimitives: primitives.filter((t) => t.$type !== 'color'),
  light: resolved.light.filter(inFile('semantic/color.light')),
  dark: resolved.dark.filter(inFile('semantic/color.dark')),
  fonts: resolved.light.filter(inFile('semantic/font')),
  viewports: Object.fromEntries(VIEWPORTS.map((v) => [v, resolved[v === 'desktop' ? 'light' : v].filter(inFile(`viewport/viewport.${v}`))])),
};

checkParity({ light: tokens.light, dark: tokens.dark });
checkParity(tokens.viewports);
checkNames(kotlinNames(tokens));

await fs.rm(WEB_DIST, { recursive: true, force: true });
await fs.mkdir(WEB_DIST, { recursive: true });
const cssPlatforms = await Promise.all(Object.values(sds).map((sd) => sd.getPlatformTokens('css')));
const cssNames = new Map(cssPlatforms.flatMap((p) => p.allTokens.map((t) => [t.path.join('.'), `--${t.name}`])));
const css = (await Promise.all(Object.values(sds).map((sd) => sd.formatPlatform('css')))).flat().map((f) => f.output);
await fs.writeFile(`${WEB_DIST}tokens.css`, css.join('\n'));

await fs.rm(KT_DIR, { recursive: true, force: true });
for (const [file, source] of Object.entries(kotlinFiles(tokens))) {
  await fs.mkdir(KT_DIR + file.replace(/[^/]*$/, ''), { recursive: true });
  await fs.writeFile(KT_DIR + file, source);
}

await fs.rm(SWATCH_DIR, { recursive: true, force: true });
await fs.mkdir(SWATCH_DIR, { recursive: true });
const hexes = new Set([...resolved.light, ...resolved.dark].filter((t) => t.$type === 'color').map((t) => hexOf(t.$value)));
for (const hex of hexes) await fs.writeFile(swatchFile(hex), swatchSvg(hex));
await fs.writeFile('TOKENS.md', tokensMarkdown(tokens, cssNames));
console.log(
  `Built ${primitives.length} primitives, ${tokens.light.length} colour tokens × 2 modes, ` +
    `${tokens.viewports.desktop.length} viewport tokens × ${VIEWPORTS.length} viewports, ${tokens.fonts.length} font tokens.`,
);
