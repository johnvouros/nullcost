#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} is ${actual}, expected ${expected}`);
  }
}

const version = read('VERSION').trim();

assertEqual('package.json version', readJson('package.json').version, version);
assertEqual(
  'Codex plugin version',
  readJson('plugins/nullcost-catalog/.codex-plugin/plugin.json').version,
  version,
);
assertEqual(
  'Claude plugin version',
  readJson('plugins/nullcost-catalog/.claude-plugin/plugin.json').version,
  version,
);

for (const path of [
  'plugins/nullcost-catalog/skills/referiate-catalog/SKILL.md',
  'plugins/nullcost-catalog/skills/referiate-recommend/SKILL.md',
  'plugins/nullcost-catalog/skills/referiate-search/SKILL.md',
]) {
  const match = read(path).match(/^version:\s*(.+)$/m);
  assertEqual(`${path} version`, match?.[1]?.trim(), version);
}

for (const path of ['mcp/referiate-provider-server.mjs', 'mcp/render-probe-server.mjs']) {
  if (!read(path).includes(`version: "${version}"`)) {
    throw new Error(`${path} does not expose version ${version}`);
  }
}

console.log(`Version check passed: ${version}`);
