// Markdown summary of token changes between two checkouts of tokens/.
// Usage: node token-diff.mjs <base-dir> <head-dir>
// Hex values in backticks render as colour chips in GitHub PR comments.
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Files with one value per mode; the mode is appended to each token name.
const MODED = {
  'semantic/color.light': 'light',
  'semantic/color.dark': 'dark',
  'semantic/font': null,
  'viewport/viewport.desktop': 'desktop',
  'viewport/viewport.mobile': 'mobile',
  'viewport/viewport.locker': 'locker',
};

const flatten = (node, path = [], out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object' && '$value' in value) out[[...path, key].join('.')] = value.$value;
    else if (value && typeof value === 'object') flatten(value, [...path, key], out);
  }
  return out;
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));

// { 'blue.700': '#061ab1', 'surface.base-1 (light)': '#ffffff', 'h1.font-size (locker)': '48px', … }, with references resolved.
export async function loadTokens(dir) {
  const primitives = {};
  for (const file of await readdir(`${dir}/tokens/primitive`).catch(() => [])) {
    Object.assign(primitives, flatten(await readJson(`${dir}/tokens/primitive/${file}`)));
  }
  const resolve = (value) => {
    while (typeof value === 'string' && /^\{.+\}$/.test(value) && value.slice(1, -1) in primitives) value = primitives[value.slice(1, -1)];
    return typeof value === 'object' ? `${value.value}${value.unit}` : `${value}`;
  };
  const tokens = Object.fromEntries(Object.entries(primitives).map(([path, value]) => [path, resolve(value)]));
  for (const [file, mode] of Object.entries(MODED)) {
    for (const [path, value] of Object.entries(flatten(await readJson(`${dir}/tokens/${file}.tokens.json`)))) {
      tokens[mode ? `${path} (${mode})` : path] = resolve(value);
    }
  }
  return tokens;
}

export function diffTokens(base, head) {
  const keys = [...new Set([...Object.keys(base), ...Object.keys(head)])].sort();
  return keys.filter((k) => base[k]?.toLowerCase() !== head[k]?.toLowerCase()).map((k) => [k, base[k], head[k]]);
}

export function toMarkdown(rows) {
  const cell = (hex) => (hex ? `\`${hex.toLowerCase()}\`` : '—');
  if (!rows.length) return '### Token changes\n\nNo token changes.\n';
  return [
    '### Token changes',
    '',
    `${rows.length} changed. Semantic values are resolved, so a primitive change also lists the tokens that use it.`,
    '',
    '| Token | Before | After |',
    '| --- | --- | --- |',
    ...rows.map(([key, before, after]) => `| \`${key}\` | ${cell(before)} | ${cell(after)} |`),
    '',
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [baseDir, headDir] = process.argv.slice(2);
  process.stdout.write(toMarkdown(diffTokens(await loadTokens(baseDir), await loadTokens(headDir))));
}
