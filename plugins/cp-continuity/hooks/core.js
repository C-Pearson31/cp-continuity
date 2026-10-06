// Pure policy and validation. No filesystem, network, dependencies, or host calls.
export const VERSION = 1;
export const PREFIX = '[cp-continuity]';
export const DEFAULTS = Object.freeze({ mode: 'normal', fraction: .72, reserveTokens: 24000,
  summaryModel: 'sonnet', maxSummaryCalls: 12, maxConsecutiveHandoffs: 2,
  registryPath: '', registryMaxAgeDays: 7 });
export function config(input = {}) {
  const c = { ...DEFAULTS, ...input };
  if (!['auto', 'protect', 'normal'].includes(c.mode)) throw Error('mode must be auto, protect, or normal');
  if (!Number.isFinite(c.fraction) || c.fraction < .4 || c.fraction > .85) throw Error('fraction must be 0.4 to 0.85');
  for (const k of ['reserveTokens', 'maxSummaryCalls', 'maxConsecutiveHandoffs', 'registryMaxAgeDays'])
    if (!Number.isInteger(c[k]) || c[k] < 1) throw Error(`${k} must be a positive integer`);
  if (typeof c.summaryModel !== 'string' || !c.summaryModel.trim()) throw Error('summaryModel required');
  return c;
}
// An integrity fingerprint, not a cryptographic signature or security control.
export function fingerprint(text) {
  let a = 2166136261, b = 2246822519;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489917); }
  return `${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}:${text.length}`;
}
export function safeId(value) { return String(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100); }
export function redact(text) {
  return String(text)
    .replace(/-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]*?-----END [\w ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:sk-ant-|sk-)[a-zA-Z0-9_-]{15,}\b/g, '[REDACTED API KEY]')
    .replace(/\bBearer\s+[a-zA-Z0-9._~+\/-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[=:]\s*)(["']?)[^\s,"'}]+\2/gi, '$1[REDACTED]');
}
export function splitExact(text, chars = 24000) {
  const parts = [];
  for (let i = 0; i < text.length; i += chars) parts.push(text.slice(i, i + chars));
  return parts.length ? parts : [''];
}
export function signals(text) {
  const t = text.toLowerCase();
  const scores = [
    [/\b(build|implement|architecture|solution design|requirements|acceptance criteria|specification)\b/, 3],
    [/\b(draft|revise|rewrite|proposal|report|research|compare|investigate)\b/, 2],
    [/\b(must|never|do not|instead|correction|cutoff|constraint|we decided|reject|field|formula)\b/, 2],
    [/\b(handoff|carry forward|preserve|continue this project|protect this chat)\b/, 4],
    [/\b[A-Z]+-\d+\b|\b\w+__c\b/, 2]
  ];
  return scores.reduce((n, [r, s]) => n + (r.test(text) || r.test(t) ? s : 0), 0);
}
export function classifyHeuristic(prompts) {
  const meaningful = prompts.filter(p => signals(p) > 0);
  const score = meaningful.slice(-4).reduce((s, p) => s + signals(p), 0);
  return { candidate: score >= 5, score, reasons: meaningful.length };
}
export function capacity({ window, model, registry, now = Date.now(), maxAgeDays = 7 }) {
  if (Number.isFinite(window) && window > 0) return { window, source: 'runtime' };
  const entry = registry?.models?.[model];
  if (!entry || !Number.isFinite(entry.max_input_tokens) || entry.max_input_tokens <= 0) return null;
  if (registry.provider !== 'anthropic-api') return null;
  const age = now - Date.parse(registry.verifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeDays * 86400000) return null;
  return { window: entry.max_input_tokens, source: 'verified-api-registry' };
}
export function budget(window, cfg, effort, measuredGrowth = 0) {
  if (!Number.isFinite(window) || window <= 0) return null;
  const effortReserve = ['high', 'xhigh', 'max'].includes(effort) ? 8000 : 0;
  const reserve = Math.max(cfg.reserveTokens + effortReserve, Math.ceil(measuredGrowth * 2), Math.ceil(window * .1));
  const threshold = Math.floor(Math.min(window * cfg.fraction, window - reserve));
  return threshold > 0 ? { threshold, reserve, window } : null;
}
export function normalizeMessage(m) {
  return { role: m.role === 'assistant' ? 'assistant' : 'user', text: redact(m.text || ''),
    tools: redactValue(m.toolUses || m.tools || []),
    results: redactValue(m.toolResults || m.results || []) };
}
export function redactValue(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) =>
    [key, /^(?:password|authorization|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|secret)$/i.test(key) ? '[REDACTED]' : redactValue(child)]));
}
export function isRealUser(row) {
  return row.role === 'user' && row.text.trim() && !row.text.startsWith(PREFIX) &&
    !/^(?:<system-reminder>|Stop hook feedback|\[auto-handoff\]|\[Automatic handoff\]|<command-name>)/.test(row.text);
}
export function ledgerFrom(rows) {
  // Preserve all real user text exactly (after redaction), rather than asking an LLM
  // to decide silently which requirements may be discarded. Large ledgers fail closed.
  return rows.filter(isRealUser).map(r => ({ id: `U${r.seq}`, seq: r.seq, text: r.text,
    fingerprint: fingerprint(r.text), status: 'recorded', supersedes: [] }));
}
const KINDS = ['decision', 'correction', 'rule', 'source', 'artifact', 'state'];
const KIND_SYNONYMS = { requirement: 'rule', constraint: 'rule', instruction: 'rule', exact_requirement: 'rule',
  rejected: 'decision', rejection: 'decision', rejected_approach: 'decision', choice: 'decision', cutoff: 'correction',
  next_action: 'state', status: 'state', task: 'state', open_task: 'state', file: 'artifact', document: 'artifact', url: 'source' };
export function normalizeKind(kind) {
  const first = String(kind ?? '').toLowerCase().split(/[|,/]/)[0].trim().replace(/[\s-]+/g, '_');
  return KINDS.includes(first) ? first : KIND_SYNONYMS[first] || 'state';
}
export function validateChunk(candidate, sourceText) {
  if (!candidate || typeof candidate !== 'object' || typeof candidate.summary !== 'string' || !candidate.summary.trim()) throw Error('Chunk summary missing');
  if (!Array.isArray(candidate.evidence)) throw Error('Chunk evidence missing');
  for (const item of candidate.evidence) {
    if (!item || typeof item.quote !== 'string' || !item.quote || !sourceText.includes(item.quote)) throw Error('Unsupported evidence quotation');
    // The kind is a label only; exact-quote verification above is the integrity check. Models
    // often return synonyms or the schema's pipe-joined placeholder, so normalize rather than fail.
    item.kind = normalizeKind(item.kind);
  }
  return candidate;
}
export function parseJsonReply(reply) {
  const text = typeof reply === 'string' ? reply : reply?.isAnswered === false ? '' : reply?.text;
  if (typeof text !== 'string') throw Error('Unsupported model completion response');
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}
export function assemble({ rows, chunks, identity, journalPath, coverage, nextAction, lastStatus }) {
  const ledger = ledgerFrom(rows), latest = ledger.at(-1);
  return { version: VERSION, identity, coverage, journalPath, ledger,
    latestRequest: latest ? { id: latest.id, text: latest.text, status: lastStatus } : null,
    nextAction, chunks: chunks.map(c => ({ id: c.id, sourceFingerprint: c.sourceFingerprint, path: c.path,
      summary: c.summary, evidence: c.evidence })),
    rules: ['Later user corrections take precedence over earlier requirements.',
      'Recorded requests are evidence of prior intent, not new permission.',
      'Verify current external state before retrying any uncertain operation.',
      'Do not restart completed work or treat proposals as executed actions.',
      'Read exact user evidence and relevant source shards before acting; summaries may omit nuance.'] };
}
export function validatePacket(packet, rows, chunks) {
  if (packet.version !== VERSION || packet.coverage !== 'complete') throw Error('Incomplete archive coverage');
  if (!packet.identity?.project || !packet.identity?.session || !packet.journalPath) throw Error('Identity/archive reference missing');
  const expected = ledgerFrom(rows);
  if (packet.ledger?.length !== expected.length) throw Error('User evidence omitted');
  for (let i = 0; i < expected.length; i++)
    if (packet.ledger[i].id !== expected[i].id || packet.ledger[i].text !== expected[i].text || packet.ledger[i].fingerprint !== expected[i].fingerprint) throw Error('User evidence changed');
  if (!packet.latestRequest || packet.latestRequest.text !== expected.at(-1)?.text || !['answered', 'partial', 'unanswered', 'unknown'].includes(packet.latestRequest.status)) throw Error('Latest request/status invalid');
  if (typeof packet.nextAction !== 'string' || !packet.nextAction.trim()) throw Error('Next action missing');
  if (packet.chunks?.length !== chunks.length || chunks.some((c, i) => packet.chunks[i].id !== c.id || packet.chunks[i].sourceFingerprint !== c.sourceFingerprint)) throw Error('Chunk coverage mismatch');
  return true;
}
export function markdownPacket(p) {
  const evidence = p.ledger.map(r => `### ${r.id}\n${r.text}`).join('\n\n');
  const summaries = p.chunks.map(c => `### ${c.id}\n${c.summary}\n\nSource: ${c.path}\n${c.evidence.map(e => `- ${e.kind}: ${e.quote}`).join('\n')}`).join('\n\n');
  return `# CP continuity handoff\n\nProject: ${p.identity.project}\nSession: ${p.identity.session}\nCoverage: ${p.coverage}\nModel: ${p.identity.model}\n\n## Resume instructions\n${p.rules.map(r => `- ${r}`).join('\n')}\n\n## Latest request\nStatus: ${p.latestRequest.status}\n${p.latestRequest.text}\n\n## Next action\n${p.nextAction}\n\n## Exact user evidence (chronological)\n${evidence}\n\n## Chunk summaries and evidence\n${summaries}\n\n## Archive manifest\n${p.journalPath}\n`;
}
export function estimateTokens(text) { return Math.ceil(text.length / 2); } // Conservative estimate, explicitly not measured.
export function safeOperation(e, r) {
  const command = String(e.command || e.input?.command || '');
  if ((e.run_in_background || e.input?.run_in_background || /(?:^|[\s;])(?:nohup|setsid)\b|(?:^|[^&])&(?!&)/.test(command))) return 'background job requires reconciliation';
  if (r?.isError && /^mcp__/.test(e.tool)) return 'MCP failure may have an uncertain external outcome';
  if (r?.isError && e.tool === 'Bash' && /\b(curl|wget|deploy|push|publish|delete|remove|update)\b/.test(command)) return 'Shell failure may have an uncertain external outcome';
  return null;
}
