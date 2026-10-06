import test from 'node:test';
import assert from 'node:assert/strict';
import { config, budget, capacity, classifyHeuristic, splitExact, redact, fingerprint,
  ledgerFrom, assemble, validatePacket, validateChunk, parseJsonReply, safeOperation, normalizeMessage } from '../hooks/core.js';

test('casual conversation stays lightweight; substantive project qualifies', () => {
  assert.equal(classifyHeuristic(['What is a group of turtles called?', 'Thanks']).candidate, false);
  assert.equal(classifyHeuristic(['Build a Salesforce solution design. Contract_Loaded_Date__c must survive.']).candidate, true);
});
test('capacity uses runtime instead of larger public model limit', () => {
  const registry = { provider: 'anthropic-api', verifiedAt: new Date().toISOString(), models: { x: { max_input_tokens: 1000000 } } };
  assert.equal(capacity({ window: 200000, model: 'x', registry }).window, 200000);
  assert.equal(capacity({ model: 'x', registry }).window, 1000000);
  registry.verifiedAt = '2020-01-01'; assert.equal(capacity({ model: 'x', registry }), null);
  assert.equal(capacity({ model: 'unknown', registry }), null);
});
test('smaller window and higher effort change reserves, not fictitious memory', () => {
  const c = config();
  assert.equal(budget(200000, c, 'low').threshold, 144000);
  assert.equal(budget(1000000, c, 'high').window, 1000000);
  assert.ok(budget(100000, c, 'max').reserve > budget(100000, c, 'low').reserve);
});
test('no original text is discarded by segmentation', () => {
  const original = '😃 Contract_Loaded_Date__c '.repeat(20000);
  assert.equal(splitExact(original).join(''), original);
});
test('earliest and long user requirements remain exact after 5000 rows', () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({ seq: i + 1, role: 'assistant', text: 'work' }));
  rows[0] = { seq: 1, role: 'user', text: 'x'.repeat(2500) + ' Contract_Loaded_Date__c cutoff July 1. Never July 2.' };
  rows[4999] = { seq: 5000, role: 'user', text: 'Correction: use July 3 for this new scenario.' };
  assert.equal(ledgerFrom(rows)[0].text, rows[0].text);
  assert.equal(ledgerFrom(rows).at(-1).text, rows[4999].text);
});
function fixture() {
  const rows = [{ seq: 1, role: 'user', text: 'Use July 1, not July 2; DESK-67; Contract_Loaded_Date__c.' }];
  const chunks = [{ id: 'C1', sourceFingerprint: 'abc', path: '/archive/c1', summary: 'work', evidence: [] }];
  const packet = assemble({ rows, chunks, identity: { project: '/project', session: 'a' }, journalPath: '/archive', coverage: 'complete', nextAction: 'Add acceptance criteria', lastStatus: 'unanswered' });
  return { rows, chunks, packet };
}
test('missing requirement and latest request fail validation', () => {
  const f = fixture(); assert.equal(validatePacket(f.packet, f.rows, f.chunks), true);
  f.packet.ledger[0].text = 'Use July 2'; assert.throws(() => validatePacket(f.packet, f.rows, f.chunks), /changed/);
});
test('heading-only summary, hallucinated quote, and incomplete archive fail', () => {
  assert.throws(() => validateChunk({ summary: '' }, 'source'));
  assert.throws(() => validateChunk({ summary: 'ok', evidence: [{ kind: 'rule', quote: 'invented' }] }, 'source'));
  const f = fixture(); f.packet.coverage = 'unknown'; assert.throws(() => validatePacket(f.packet, f.rows, f.chunks), /coverage/);
});
test('completion adapter supports documented string and current structured form', () => {
  assert.deepEqual(parseJsonReply('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(parseJsonReply({ isAnswered: true, text: '{"ok":true}' }), { ok: true });
  assert.throws(() => parseJsonReply({ isAnswered: false, text: '{"ok":true}' }));
});
test('common secrets redacted; fingerprints detect ordinary content changes', () => {
  assert.ok(!redact('key sk-ant-abcdefghijklmnop12345').includes('sk-ant-'));
  assert.ok(!redact('password=secretvalue').includes('secretvalue'));
  assert.notEqual(fingerprint('July 1'), fingerprint('July 2'));
});
test('background job and uncertain MCP failure hold reset', () => {
  assert.ok(safeOperation({ tool: 'Bash', command: 'nohup task &' }, {}));
  assert.ok(safeOperation({ tool: 'mcp__jira__update' }, { isError: true }));
  assert.equal(safeOperation({ tool: 'Read' }, {}), null);
});
test('structured credentials are redacted before archive and summary', () => {
  const m = normalizeMessage({ role: 'assistant', text: '', tools: [{ input: { password: 'sensitive', client_secret: 'hidden', ordinary: 'July 1' } }] });
  assert.equal(m.tools[0].input.password, '[REDACTED]');
  assert.equal(m.tools[0].input.client_secret, '[REDACTED]');
  assert.equal(m.tools[0].input.ordinary, 'July 1');
});
