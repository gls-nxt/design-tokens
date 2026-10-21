import fs from 'node:fs/promises';
import StyleDictionary from 'style-dictionary';

const WEB_DIST = 'packages/web/dist/';
const KT_PACKAGE = 'com.glsnxt.designtokens';
const KT_DIR = `packages/kotlin/src/commonMain/kotlin/${KT_PACKAGE.replaceAll('.', '/')}/`;
const HEADER = '// Generated from tokens/ by build.mjs. Do not edit.';
const KOTLIN_KEYWORDS = new Set('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while'.split(' '));
// Screen modes from Figma's Viewport collection. The web gets all three; Kotlin only gets mobile.
const SCREENS = ['desktop', 'mobile', 'locker'];

const inFile = (name) => (token) => token.filePath.endsWith(`tokens/${name}.tokens.json`);
const isPrimitive = (token) => token.filePath.includes('/primitive/');
// The css group, but px dimensions become rem (16px = 1rem) so sizes follow the user's browser font size.
const CSS_TRANSFORMS = StyleDictionary.hooks.transformGroups.css.map((t) => (t === 'size/rem' ? 'size/pxToRem' : t));
const cssFile = (selector, filter) => ({ format: 'css/variables', filter, options: { outputReferences: true, showFileHeader: false, selector } });

// `$extensions["com.glsnxt.platforms"]` sets a token per platform: `false` leaves the token (or a whole group) out,
// `{ "$value": … }` replaces its value. Platforms not listed get the token's own `$value`.
const PLATFORM_EXT = 'com.glsnxt.platforms';
const PLATFORMS = ['web', 'kotlin'];
function forPlatform(node, platform, path = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') || !child || typeof child !== 'object') continue;
    const at = [...path, key];
    const ext = child.$extensions?.[PLATFORM_EXT] ?? {};
    if (typeof ext !== 'object' || Array.isArray(ext)) throw new Error(`${at.join('.')}: ${PLATFORM_EXT} must be an object keyed by platform`);
    for (const [p, v] of Object.entries(ext)) {
      if (!PLATFORMS.includes(p) || !(v === false || ('$value' in child && v?.$value !== undefined))) {
        throw new Error(`${at.join('.')}: ${PLATFORM_EXT}.${p} must be one of ${PLATFORMS.join(', ')}, set to false or (on a token) { "$value": … }`);
      }
    }
    if (ext[platform] === false) delete node[key];
    else if (ext[platform]) child.$value = ext[platform].$value;
    else if (!('$value' in child)) forPlatform(child, platform, at);
  }
  return node;
}
const platform = (name, config) => ({ ...config, preprocessors: ['platform'], platform: name });

const sdFor = (sources, files) =>
  new StyleDictionary({
    source: ['tokens/primitive/*.tokens.json', 'tokens/semantic/font.tokens.json', ...sources],
    // The mode blocks reference primitives that only live in :root; that warning is expected.
    log: { verbosity: 'silent', warnings: 'disabled' },
    hooks: { preprocessors: { platform: (tokens, config) => forPlatform(tokens, config.platform) } },
    platforms: {
      css: platform('web', { transforms: CSS_TRANSFORMS, prefix: 'unity', files }),
      // No output files: resolved, untransformed tokens for the Kotlin and TOKENS.md writers.
      web: platform('web', { transforms: [] }),
      kotlin: platform('kotlin', { transforms: [] }),
    },
  });

// :root holds every primitive and the default modes (light, desktop). The other modes override only their own tokens.
const sds = {
  light: sdFor(
    ['tokens/semantic/color.light.tokens.json', 'tokens/screen/desktop.tokens.json'],
    [{ format: 'css/variables', options: { outputReferences: true, selector: ':root' } }],
  ),
  dark: sdFor(['tokens/semantic/color.dark.tokens.json'], [
    cssFile('[data-theme="dark"]', inFile('semantic/color.dark')),
    cssFile(['@media (prefers-color-scheme: dark)', ':root:not([data-theme="light"])'], inFile('semantic/color.dark')),
  ]),
  mobile: sdFor(['tokens/screen/mobile.tokens.json'], [cssFile('[data-viewport="mobile"]', inFile('screen/mobile'))]),
  locker: sdFor(['tokens/screen/locker.tokens.json'], [cssFile('[data-viewport="locker"]', inFile('screen/locker'))]),
};

// --- Kotlin naming: primitives `PrimitiveColors.BlueDark.BlueDark700`, `PrimitiveTokens.Spacing.Spacing4`;
// semantic `SurfaceColors.selectionDefault`, `MobileTypography.h1`, `MobileDimensions.touchTargetMin`, `FontTokens.heading`
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
  TextStyle: 'androidx.compose.ui.text.TextStyle',
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

// Screen tokens for Kotlin: a group made only of these keys (`h1.font-size`, `h1.line-height`, …) becomes one
// `TextStyle` in `MobileTypography`; every other token becomes a `Dp` in `MobileDimensions`.
const TEXT_STYLE_KEYS = ['font-size', 'line-height', 'letter-spacing'];
function screenGroups(tokens) {
  const text = new Map();
  const other = [];
  for (const [group, list] of groupBy(tokens)) {
    const isStyle = list.map((t) => t.path.length === 2 && TEXT_STYLE_KEYS.includes(t.path[1]));
    if (isStyle.every(Boolean)) text.set(group, list);
    else if (isStyle.some(Boolean)) {
      throw new Error(`Screen group "${group}" mixes text style keys (${TEXT_STYLE_KEYS.join(', ')}) with others: ${list.map((t) => t.path.join('.')).join(', ')}`);
    } else other.push(...list);
  }
  return { text, other };
}
const screenKotlinName = (t, text) => (text.has(t.path[0]) ? `MobileTypography.${camel(t.path[0])}.${camel(t.path[1])}` : `MobileDimensions.${pathField(t)}`);

function ktMobileFiles(tokens) {
  const { text, other } = screenGroups(tokens);
  const styles = [...text].map(([group, list]) => `    val ${camel(group)} = TextStyle(${list.map((t) => `${camel(t.path[1])} = ${ktValue(t)}`).join(', ')})`);
  return {
    'MobileTypography.kt': ktFile(
      KT_PACKAGE,
      '/** Mobile text styles: size, line height and letter spacing. Merge in the app\'s font family and weight. */\n' +
        `object MobileTypography {\n${styles.join('\n')}\n}\n`,
    ),
    'MobileDimensions.kt': ktFile(
      KT_PACKAGE,
      `/** Mobile sizes that aren't text, such as the minimum touch target. */\nobject MobileDimensions {\n${other.map((t) => `    val ${pathField(t)} = ${ktValue(t)}`).join('\n')}\n}\n`,
    ),
  };
}

function kotlinFiles({ colorPrimitives, otherPrimitives, light, dark, fonts, screens }) {
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
  return { ...files, ...ktMobileFiles(screens.mobile) };
}

function kotlinNames({ colorPrimitives, otherPrimitives, light, fonts, screens }) {
  const primitive = (obj) => (t) => `${obj}.${pascal(t.path[0])}.${pascal(t.path.join('-'))}`;
  return [
    ...colorPrimitives.map(primitive('PrimitiveColors')),
    ...otherPrimitives.map(primitive('PrimitiveTokens')),
    ...light.map((t) => `${pascal(t.path[0])}Colors.${groupField(t)}`),
    ...fonts.map((t) => `${pascal(t.path[0])}Tokens.${groupField(t)}`),
    // One name per text style, since `title-1.font-size` and `title1.line-height` both land in `val title1`.
    ...[...screenGroups(screens.mobile).text.keys()].map((group) => `MobileTypography.${camel(group)}`),
    ...screenGroups(screens.mobile).other.map((t) => `MobileDimensions.${pathField(t)}`),
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

function tokensMarkdown(web, kotlin, cssNames) {
  const key = (t) => t.path.join('.');
  const byPath = (list) => new Map(list.map((t) => [key(t), t]));
  const css = (t) => (cssNames.has(key(t)) ? `\`${cssNames.get(key(t))}\`` : '—');
  const withRef = (value, t) => `${value}${refOf(t) ? `<br>\`${refOf(t)}\`` : ''}`;
  const colorCell = (t) => withRef(`${swatch(hexOf(t.$value))} \`${hexOf(t.$value)}\``, t);
  const valueCell = (t) => withRef(`\`${display(t)}\``, t);
  // Every web token, then the Kotlin-only ones. Value columns show the web value, or the Kotlin one for a Kotlin-only token.
  const rows = (w, k) => [...w, ...k.filter((t) => !byPath(w).has(key(t)))];
  const mode = (label, path, w, k) => [label, w.get(path) ?? k.get(path), k.get(path)];
  // Resolved values catch an overridden primitive behind the same reference; references catch a swapped primitive with the same value.
  // A token only one platform has counts as a difference.
  const differs = (w, k) => !w || !k || JSON.stringify([w.$value, w.original.$value]) !== JSON.stringify([k.$value, k.original.$value]);
  // The Kotlin name, or `—` when Kotlin leaves the token out, plus the Kotlin value of each mode that differs from the web one.
  const ktCell = (name, modes, cell) => {
    if (!modes[0][2]) return '—';
    return [`\`${name}\``, ...modes.filter(([, w, k]) => differs(w, k)).map(([label, , k]) => `${label ? `${label}: ` : 'Kotlin: '}${cell(k)}`)].join('<br>');
  };
  const out = [
    '# Tokens',
    '',
    '> Generated by `pnpm build` from `tokens/`. Do not edit.',
    '',
    '## Semantic colours',
    '',
    'Light and dark values, with the primitive each one references. The Kotlin column lists Kotlin values only where they differ from the web ones.',
  ];
  const [wLight, wDark, kLight, kDark] = [web.light, web.dark, kotlin.light, kotlin.dark].map(byPath);
  for (const [group, tokens] of groupBy(rows(web.light, kotlin.light))) {
    out.push('', `### ${group}`, '', '| Token | Light | Dark | CSS | Kotlin |', '| --- | --- | --- | --- | --- |');
    for (const t of tokens) {
      const modes = [mode('light', key(t), wLight, kLight), mode('dark', key(t), wDark, kDark)];
      out.push(`| \`${key(t)}\` | ${modes.map(([, v]) => colorCell(v)).join(' | ')} | ${css(t)} | ${ktCell(`${pascal(group)}Colors.${groupField(t)}`, modes, colorCell)} |`);
    }
  }

  out.push(
    '',
    '## Screen sizes',
    '',
    'Text and touch sizes per screen, with the primitive each one references. On the web, desktop is the default; set `data-viewport="mobile"` or `data-viewport="locker"` to switch. Kotlin gets the mobile values only.',
    '',
    `| Token | ${SCREENS.map(pascal).join(' | ')} | CSS | Kotlin |`,
    `| --- | ${SCREENS.map(() => '---').join(' | ')} | --- | --- |`,
  );
  const [wScr, kScr] = [web, kotlin].map((set) => Object.fromEntries(SCREENS.map((v) => [v, byPath(set.screens[v])])));
  const { text } = screenGroups(kotlin.screens.mobile);
  for (const t of rows(web.screens.desktop, kotlin.screens.desktop)) {
    const modes = SCREENS.map((v) => mode(v, key(t), wScr[v], kScr[v]));
    const kt = ktCell(screenKotlinName(t, text), [mode('mobile', key(t), wScr.mobile, kScr.mobile)], valueCell);
    out.push(`| \`${key(t)}\` | ${modes.map(([, v]) => valueCell(v)).join(' | ')} | ${css(t)} | ${kt} |`);
  }

  out.push('', '## Fonts', '', '| Token | Value | CSS | Kotlin |', '| --- | --- | --- | --- |');
  const [wFonts, kFonts] = [web.fonts, kotlin.fonts].map(byPath);
  for (const t of rows(web.fonts, kotlin.fonts)) {
    const modes = [mode('', key(t), wFonts, kFonts)];
    out.push(`| \`${key(t)}\` | ${valueCell(modes[0][1])} | ${css(t)} | ${ktCell(`${pascal(t.path[0])}Tokens.${groupField(t)}`, modes, valueCell)} |`);
  }

  out.push(
    '',
    '## Primitive colours',
    '',
    'CSS `--unity-<family>-<step>`, Kotlin `PrimitiveColors.<Family>.<Family><Step>`. A Kotlin row lists Kotlin values only where they differ from the web ones.',
  );
  const [wPrim, kPrim] = [web.colorPrimitives, kotlin.colorPrimitives].map(byPath);
  for (const [family, tokens] of groupBy(rows(web.colorPrimitives, kotlin.colorPrimitives))) {
    const steps = tokens.map((t) => t.path.slice(1).join('-'));
    const modes = tokens.map((t) => mode('', key(t), wPrim, kPrim));
    const ktRow = modes.map(([, w, k]) => (!k ? 'Kotlin: —' : differs(w, k) ? `Kotlin: ${swatch(hexOf(k.$value))} \`${hexOf(k.$value)}\`` : ''));
    out.push(
      '',
      `### ${family}`,
      '',
      `| ${steps.join(' | ')} |`,
      `| ${steps.map(() => '---').join(' | ')} |`,
      `| ${modes.map(([, w]) => swatch(hexOf(w.$value))).join(' | ')} |`,
      `| ${modes.map(([, w]) => `\`${hexOf(w.$value)}\``).join(' | ')} |`,
      ...(ktRow.some(Boolean) ? [`| ${ktRow.join(' | ')} |`] : []),
    );
  }

  out.push('', '## Other primitives');
  const [wOther, kOther] = [web.otherPrimitives, kotlin.otherPrimitives].map(byPath);
  for (const [group, tokens] of groupBy(rows(web.otherPrimitives, kotlin.otherPrimitives))) {
    out.push('', `### ${group}`, '', '| Token | Value | CSS | Kotlin |', '| --- | --- | --- | --- |');
    for (const t of tokens) {
      const modes = [mode('', key(t), wOther, kOther)];
      out.push(`| \`${key(t)}\` | ${valueCell(modes[0][1])} | ${css(t)} | ${ktCell(`PrimitiveTokens.${pascal(group)}.${pascal(t.path.join('-'))}`, modes, valueCell)} |`);
    }
  }
  return out.join('\n') + '\n';
}

// Resolved tokens per mode, as one platform sees them.
const resolveFor = async (platform) =>
  Object.fromEntries(await Promise.all(Object.entries(sds).map(async ([mode, sd]) => [mode, (await sd.getPlatformTokens(platform)).allTokens])));
const tokenSets = (resolved) => {
  const primitives = resolved.light.filter(isPrimitive);
  return {
    colorPrimitives: primitives.filter((t) => t.$type === 'color'),
    otherPrimitives: primitives.filter((t) => t.$type !== 'color'),
    light: resolved.light.filter(inFile('semantic/color.light')),
    dark: resolved.dark.filter(inFile('semantic/color.dark')),
    fonts: resolved.light.filter(inFile('semantic/font')),
    screens: Object.fromEntries(SCREENS.map((v) => [v, resolved[v === 'desktop' ? 'light' : v].filter(inFile(`screen/${v}`))])),
  };
};
const resolved = { web: await resolveFor('web'), kotlin: await resolveFor('kotlin') };
const web = tokenSets(resolved.web);
const kotlin = tokenSets(resolved.kotlin);

for (const set of [web, kotlin]) {
  checkParity({ light: set.light, dark: set.dark });
  checkParity(set.screens);
}
checkNames(kotlinNames(kotlin));

await fs.rm(WEB_DIST, { recursive: true, force: true });
await fs.mkdir(WEB_DIST, { recursive: true });
const cssPlatforms = await Promise.all(Object.values(sds).map((sd) => sd.getPlatformTokens('css')));
const cssNames = new Map(cssPlatforms.flatMap((p) => p.allTokens.map((t) => [t.path.join('.'), `--${t.name}`])));
const css = (await Promise.all(Object.values(sds).map((sd) => sd.formatPlatform('css')))).flat().map((f) => f.output);
await fs.writeFile(`${WEB_DIST}tokens.css`, css.join('\n'));

await fs.rm(KT_DIR, { recursive: true, force: true });
for (const [file, source] of Object.entries(kotlinFiles(kotlin))) {
  await fs.mkdir(KT_DIR + file.replace(/[^/]*$/, ''), { recursive: true });
  await fs.writeFile(KT_DIR + file, source);
}

await fs.rm(SWATCH_DIR, { recursive: true, force: true });
await fs.mkdir(SWATCH_DIR, { recursive: true });
const hexes = new Set(Object.values(resolved).flatMap((r) => [...r.light, ...r.dark]).filter((t) => t.$type === 'color').map((t) => hexOf(t.$value)));
for (const hex of hexes) await fs.writeFile(swatchFile(hex), swatchSvg(hex));
await fs.writeFile('TOKENS.md', tokensMarkdown(web, kotlin, cssNames));
console.log(
  `Built ${web.colorPrimitives.length + web.otherPrimitives.length} primitives, ${web.light.length} colour tokens × 2 modes, ` +
    `${web.screens.desktop.length} screen tokens × ${SCREENS.length} screens, ${web.fonts.length} font tokens (web).`,
);
