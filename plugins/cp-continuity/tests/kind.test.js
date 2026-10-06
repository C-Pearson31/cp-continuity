import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKind, validateChunk } from '../hooks/core.js';

test('evidence labels normalize; quotes remain exact-substring verified', () => {
  for (const [input, want] of [['decision', 'decision'], ['Correction', 'correction'], ['decision|correction|rule|source|artifact|state', 'decision'],
    ['requirement', 'rule'], ['Rejected approach', 'decision'], ['next-action', 'state'], ['unheard-of', 'state'], [undefined, 'state'], [42, 'state']])
    assert.equal(normalizeKind(input), want, String(input));
  const ok = validateChunk({ summary: 's', evidence: [{ kind: 'requirement', quote: 'abc' }] }, 'xxabcxx');
  assert.equal(ok.evidence[0].kind, 'rule');
  assert.throws(() => validateChunk({ summary: 's', evidence: [{ kind: 'rule', quote: 'not in source' }] }, 'xxabcxx'), /Unsupported evidence quotation/);
});
