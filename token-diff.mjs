// Markdown summary of colour changes between two checkouts of tokens/.
// Usage: node token-diff.mjs <base-dir> <head-dir>
// Hex values in backticks render as colour chips in GitHub PR comments.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MODES = ['light', 'dark'];

const flatten = (node, path = [], out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object' && '$value' in value) out[[...path, key].join('.')] = value.$value;
    else if (value && typeof value === 'object') flatten(value, [...path, key], out);
  }
  return out;
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));

// { 'blue.700': '#061ab1', 'surface.base-1 (light)': '#ffffff', … }, with semantic references resolved.
export async function loadTokens(dir) {
  const primitives = flatten(await readJson(`${dir}/tokens/primitive/color.tokens.json`));
  const tokens = { ...primitives };
  for (const mode of MODES) {
    const semantic = flatten(await readJson(`${dir}/tokens/semantic/color.${mode}.tokens.json`));
    for (const [path, value] of Object.entries(semantic)) {
      tokens[`${path} (${mode})`] = value.replace(/^\{(.+)\}$/, (ref, target) => primitives[target] ?? ref);
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
  if (!rows.length) return '### Token changes\n\nNo colour changes.\n';
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
