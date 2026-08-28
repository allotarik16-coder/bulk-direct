import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Where a credential is allowed to come from, and in which order.
 *
 * The point of this file is that a key is configured ONCE per machine, not
 * once per project: `~/.free-llm/keys.env` is read by every install of this
 * gateway, so a new project inherits the same providers with zero setup and
 * a rotated key takes effect everywhere at once.
 *
 * Precedence, highest first:
 *   1. the real process environment  — CI secrets and one-off overrides win,
 *      so a workflow that injects GROQ_API_KEY is never shadowed by a stale
 *      file on a developer's disk;
 *   2. ./.env                        — a project that deliberately wants a
 *      different account than the machine default;
 *   3. ~/.free-llm/keys.env          — the machine-wide default (this is the
 *      one `npm run keys:set` writes).
 *
 * $FREE_LLM_KEYS relocates step 3, for setups that keep credentials on a
 * mounted volume or in a shared home.
 */

export const GLOBAL_KEYS_DIR = path.join(os.homedir(), '.free-llm');
export const GLOBAL_KEYS_FILE = path.join(GLOBAL_KEYS_DIR, 'keys.env');

/** The machine-wide file, honouring the $FREE_LLM_KEYS relocation. */
export function globalKeysPath(): string {
  const override = process.env.FREE_LLM_KEYS?.trim();
  return override ? override : GLOBAL_KEYS_FILE;
}

/** Every file consulted, nearest-wins order, for `npm run keys` to report. */
export function keyFileChain(): string[] {
  return [path.resolve(process.cwd(), '.env'), globalKeysPath()];
}

/**
 * A deliberately small dotenv parser rather than the dependency: this package
 * ships zero runtime deps, and the format we write is the one we read.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // `export FOO=bar` is what people paste out of a shell profile.
    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;

    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();

    // Strip one matching pair of quotes; a key with a `#` in it is legal, so
    // only strip a trailing comment on unquoted values.
    const quoted = value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0];
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }

    if (key) out[key] = value;
  }

  return out;
}

let cache: Record<string, string> | null = null;

/**
 * Read the file chain once and merge it, nearest file winning. Cached because
 * hasApiKey() runs at module-evaluation time for every provider in the catalog
 * and would otherwise stat the same two paths a dozen times per process.
 */
function fileValues(): Record<string, string> {
  if (cache) return cache;

  const merged: Record<string, string> = {};

  // Walk furthest-first so nearer files overwrite.
  for (const file of [...keyFileChain()].reverse()) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // absent or unreadable is the normal case, not an error
    }
    Object.assign(merged, parseEnvFile(text));
  }

  cache = merged;
  return merged;
}

/** Drop the cached files — for tests, and after `keys:set` writes. */
export function resetKeyStore(): void {
  cache = null;
}

/** Resolve one variable across the whole chain. */
export function readEnvVar(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  const fromFile = fileValues()[name]?.trim();
  return fromFile ? fromFile : undefined;
}

/** Which source a variable resolved from, for `npm run keys` to explain. */
export function sourceOf(name: string): 'environment' | string | undefined {
  if (process.env[name]?.trim()) return 'environment';

  for (const file of keyFileChain()) {
    try {
      const values = parseEnvFile(fs.readFileSync(file, 'utf8'));
      if (values[name]?.trim()) return file;
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * Upsert one variable in the machine-wide file, preserving everything else in
 * it (comments and unrelated keys included) so an edit is never destructive.
 *
 * The file is created 0600 and the directory 0700: it holds live credentials,
 * and a default-umask 0644 would expose them to every account on the box.
 */
export function writeGlobalKey(name: string, value: string): string {
  const file = globalKeysPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });

  let lines: string[] = [];
  try {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    lines = [
      '# free-llm-gateway credentials — read by every project on this machine.',
      '# Written by `npm run keys:set`. Safe to edit by hand.',
      '',
    ];
  }

  const assignment = `${name}=${value}`;
  const index = lines.findIndex((l) => {
    const t = l.trim().replace(/^export\s+/, '');
    return t.startsWith(`${name}=`);
  });

  if (index >= 0) {
    lines[index] = assignment;
  } else {
    if (lines.length > 0 && lines.at(-1)?.trim() !== '') lines.push('');
    lines.push(assignment);
  }

  fs.writeFileSync(file, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
  fs.chmodSync(file, 0o600); // writeFileSync's mode is ignored on an existing file
  resetKeyStore();

  return file;
}
