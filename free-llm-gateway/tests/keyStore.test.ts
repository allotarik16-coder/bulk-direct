import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseEnvFile,
  readEnvVar,
  resetKeyStore,
  writeGlobalKey,
  globalKeysPath,
} from '../src/providers/keyStore';
import { getApiKey } from '../src/providers/apiKeys';

/**
 * The promise this file guards: a credential is configured once per machine
 * and every project reads it. If precedence or parsing regress, the symptom
 * is a silent 401 in an unrelated repo, which is very hard to trace back.
 */

let tmpDir: string;
let previousOverride: string | undefined;

test.before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'free-llm-keys-'));
  previousOverride = process.env.FREE_LLM_KEYS;
  process.env.FREE_LLM_KEYS = path.join(tmpDir, 'keys.env');
  resetKeyStore();
});

test.after(() => {
  if (previousOverride === undefined) delete process.env.FREE_LLM_KEYS;
  else process.env.FREE_LLM_KEYS = previousOverride;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  resetKeyStore();
});

test('the parser accepts the shapes people actually paste', () => {
  const parsed = parseEnvFile(
    [
      '# a comment',
      '',
      'PLAIN=abc123',
      'export EXPORTED=def456',
      'QUOTED="ghi789"',
      "SINGLE='jkl012'",
      'TRAILING=mno345 # inline note',
      'HASH_IN_VALUE=pqr#678',
      'SPACED = stu901 ',
    ].join('\n')
  );

  assert.equal(parsed.PLAIN, 'abc123');
  assert.equal(parsed.EXPORTED, 'def456', '`export FOO=` is what a shell profile looks like');
  assert.equal(parsed.QUOTED, 'ghi789');
  assert.equal(parsed.SINGLE, 'jkl012');
  assert.equal(parsed.TRAILING, 'mno345', 'an inline comment is not part of the key');
  assert.equal(parsed.HASH_IN_VALUE, 'pqr#678', 'a # inside a key must survive');
  assert.equal(parsed.SPACED, 'stu901');
});

test('a key in the machine file is visible with nothing in the environment', () => {
  delete process.env.TEST_ONLY_KEY;
  writeGlobalKey('TEST_ONLY_KEY', 'from-file');

  assert.equal(readEnvVar('TEST_ONLY_KEY'), 'from-file');
});

test('the process environment outranks the machine file', () => {
  writeGlobalKey('TEST_PRECEDENCE', 'from-file');
  process.env.TEST_PRECEDENCE = 'from-environment';
  resetKeyStore();

  try {
    // CI injects secrets as real environment variables; a stale file on a
    // developer box must never shadow them.
    assert.equal(readEnvVar('TEST_PRECEDENCE'), 'from-environment');
  } finally {
    delete process.env.TEST_PRECEDENCE;
  }
});

test('writing one key preserves the others and the comments', () => {
  writeGlobalKey('FIRST_KEY', 'one');
  writeGlobalKey('SECOND_KEY', 'two');
  writeGlobalKey('FIRST_KEY', 'one-rotated');

  const text = fs.readFileSync(globalKeysPath(), 'utf8');
  const parsed = parseEnvFile(text);

  assert.equal(parsed.FIRST_KEY, 'one-rotated', 'an update must replace, not append');
  assert.equal(parsed.SECOND_KEY, 'two', 'an unrelated key must survive the write');
  assert.ok(text.includes('#'), 'the explanatory header must not be destroyed');
  assert.equal(
    text.split(/\r?\n/).filter((l) => l.startsWith('FIRST_KEY=')).length,
    1,
    'no duplicate assignment: the last one silently wins and confuses debugging'
  );
});

test('the credentials file is not readable by other accounts', () => {
  writeGlobalKey('PERMISSION_KEY', 'secret');

  const mode = fs.statSync(globalKeysPath()).mode & 0o077;
  assert.equal(mode, 0, 'a live credential must not be group- or world-readable');
});

test('a provider resolves its key through the machine file', () => {
  delete process.env.GROQ_API_KEY;
  writeGlobalKey('GROQ_API_KEY', 'gsk-machine-wide');

  try {
    // This is the whole feature: no per-repo secret, no export in a shell.
    assert.equal(getApiKey('groq'), 'gsk-machine-wide');
  } finally {
    writeGlobalKey('GROQ_API_KEY', '');
    resetKeyStore();
  }
});

test('an empty value reads as unconfigured, not as an empty credential', () => {
  delete process.env.EMPTY_KEY;
  writeGlobalKey('EMPTY_KEY', '');

  // Sending `Bearer ` upstream is a worse failure than sending nothing.
  assert.equal(readEnvVar('EMPTY_KEY'), undefined);
});
