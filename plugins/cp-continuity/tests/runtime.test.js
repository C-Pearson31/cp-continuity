import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../hooks/register.js';

function host(options = {}) {
  const hooks = new Map(), files = new Map(), store = new Map(), calls = [], notices = [];
  let session = options.session || 'old', project = options.project || '/project', injected = false;
  const h = { files, store, calls, notices, hooks, queuedClear: null, config: options,
    usage: { context: { tokens: 10000, window: 200000 } }, agents: [], completions: 0,
    holding: 0, guardViolations: 0, timers: [] };
  const $ = {
    fs: { write: async (path, text) => { if (h.failWrite) throw Error('disk unavailable'); files.set(path, text); },
      read: async path => { if (!files.has(path)) throw Error('missing file ' + path); return h.corruptRead ? 'corrupted' : files.get(path); } },
    store: { get: async k => store.get(k), set: async (k, v) => store.set(k, structuredClone(v)), delete: async k => store.delete(k) },
    env: { get: async k => k === 'HOME' ? '/private-home' : undefined },
    session: { id: async () => session, cwd: async () => project, model: async () => h.model || 'sonnet',
      usage: async () => h.usage, messages: async () => options.bootstrap || [] },
    // Models Claude Code 2.1.288: $.command.run rejects when called from inside a command.run hook
    // (the turn is waiting on it), and $.clock.after callbacks run outside every event.
    clock: { after: (ms, fn) => { h.timers.push(fn); return { cancel() {} }; } },
    command: { register: async s => { calls.push(['register', s.name]); }, run: async e => {
      if (h.holding > 0) { h.guardViolations++; throw Error('$.command.run: called from a command.run hook, it would wait on the turn this hook is holding'); }
      if (h.rejectRun) throw Error(h.rejectRun);
      calls.push(['clear-request', e.command]);
      const execute = async () => { calls.push(['clear-executed']); session = 'fresh';
        await h.fire('classic.SessionStart', { source: 'clear' }); return {}; };
      h.queuedClear = async () => h.skipClearHook ? execute()
        : h.fire('command.run', { command: 'clear', args: '', origin: { kind: 'plugin' } }, execute);
    } },
    ui: { toast: async t => notices.push(t) }, agent: { list: async () => h.agents },
    prompt: { submit: async e => { if (e.text.trimStart().startsWith('/')) throw Error('text beginning with / would run a command'); if (h.rejectSubmit) throw Error(h.rejectSubmit); calls.push(['seed', e.text]); } },
    model: { complete: async e => {
      h.completions++;
      if (h.failModel) throw Error('model unavailable');
      if (h.headingOnly) return '# Work in progress';
      const p = JSON.parse(e.prompt);
      if (p.schema?.approved) return JSON.stringify({ approved: !h.rejectReview, issues: h.rejectReview ? ['unsupported state'] : [] });
      if (p.schema?.protect) return JSON.stringify({ protect: true, reason: 'project' });
      if (p.schema?.status) return JSON.stringify({ status: 'unanswered', nextAction: 'Add acceptance criteria' });
      if (h.latePrompt && !injected) { injected = true; await h.fire('prompt.submit', { text: 'Correction: July 3', origin: { kind: 'composer' } }); }
      if (h.evidenceReplies?.length) return JSON.stringify({ summary: 'Continue the project.', evidence: h.evidenceReplies.shift() });
      return JSON.stringify({ summary: 'Continue the project; execution status unknown.', evidence: [] });
    } }
  };
  register((name, handler) => hooks.set(name, handler), options);
  h.fire = async (name, e = {}, next = async () => ({})) => {
    const handler = hooks.get(name); if (!handler) return next(e);
    const r = handler($, e, next); return r;
  };
  h.step = async (answer = 'A draft.', usage = null, e = {}) => {
    async function* next() { return { answer, usage, toolUses: [] }; }
    const g = hooks.get('turn.step')($, { index: 0, model: h.model || 'sonnet', turnId: 't', ...e }, next);
    let result; do { result = await g.next(); } while (!result.done); return result.value;
  };
  h.start = () => h.fire('session.start');
  h.prompt = text => h.fire('prompt.submit', { text, origin: { kind: 'composer' } });
  h.command = async args => { h.holding++; try { return await h.fire('command.run', { command: 'cp-handoff', args, origin: { kind: 'composer' } }); } finally { h.holding--; } };
  h.flush = async () => { while (h.timers.length) await h.timers.shift()(); await new Promise(r => setTimeout(r, 0)); };
  return h;
}

test('casual normal/auto chats make no classifier or summary calls', async () => {
  const h = host({ mode: 'auto' }); await h.start(); await h.prompt('What is a group of turtles?'); await h.step('A bale.');
  assert.equal(h.completions, 0); assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
});
test('project auto activation, full original requirement and sources in checkpoint', async () => {
  const h = host({ mode: 'auto' }); await h.start();
  await h.prompt('Build a solution. ' + 'detail '.repeat(500) + 'Contract_Loaded_Date__c must survive. Cutoff July 1, not July 2. DESK-67.');
  await h.step('Draft at https://example.org/source');
  const r = await h.command('checkpoint'); assert.match(r.text, /Verified checkpoint/);
  const brief = [...h.files].find(([p]) => /handoff-.*\.md$/.test(p))[1];
  assert.match(brief, /Contract_Loaded_Date__c/); assert.match(brief, /July 1, not July 2/);
  assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
});
test('manual handoff validates, clears, and seeds with carried exact history', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build requirements; cutoff July 1.'); await h.step();
  const r = await h.command('now'); assert.match(r.text, /handoff queued/);
  assert.equal(h.calls.some(c => c[0] === 'clear-request'), false, 'no clear request while the command hook is still running');
  await h.flush(); await h.queuedClear(); await h.flush(); assert.equal(h.calls.filter(c => c[0] === 'clear-executed').length, 1);
  assert.equal(h.calls.filter(c => c[0] === 'seed').length, 1);
  const status = await h.command('status'); assert.match(status.text, /"exactUserEntries": 1/);
});
for (const failure of ['failModel', 'headingOnly', 'failWrite', 'corruptRead', 'rejectReview']) {
  test(`${failure} prevents clear`, async () => {
    const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build requirements, cutoff July 1.'); await h.step();
    h[failure] = true; const r = await h.command('now'); assert.match(r.text, /No reset/);
    assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
  });
}
test('late correction during summarization invalidates checkpoint', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build using July 1.'); await h.step(); h.latePrompt = true;
  const r = await h.command('now'); assert.match(r.text, /regenerated|changed|omitted|coverage/);
  assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
});
test('user correction after clear queued cancels clear', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build using July 1.'); await h.step(); await h.command('now'); await h.flush();
  await h.prompt('Correction: July 3.'); const result = await h.queuedClear(); assert.match(result.text, /cancelled/);
  assert.equal(h.calls.some(c => c[0] === 'clear-executed'), false);
});
test('background agents and uncertain write block reset until explicit reconciliation', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build a project.'); await h.step();
  h.agents = [{ id: 'a', status: 'running' }]; assert.match((await h.command('now')).text, /agent/);
  h.agents = []; await h.fire('tool.call', { tool: 'mcp__jira__update', tool_use_id: 'w' }, async () => ({ result: 'timeout', isError: true }));
  assert.match((await h.command('now')).text, /Unresolved/); await h.command('reconcile'); assert.match((await h.command('checkpoint')).text, /Verified/);
});
test('runtime capacity updates on model switch; normal mode restores native compact', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build a project.');
  h.model = 'new-model'; h.usage.context.window = 100000;
  const status = await h.command('status'); assert.match(status.text, /"window": 100000/); assert.match(status.text, /new-model/);
  await h.command('normal'); let native = false;
  await h.fire('session.compact', { trigger: 'auto' }, async () => { native = true; return {}; }); assert.equal(native, true);
});
test('unknown capacity prevents reset; capped old-history snapshot prevents reset', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build a project.'); h.usage.context.window = null;
  assert.match((await h.command('now')).text, /capacity unknown/);
  const b = host({ mode: 'protect', bootstrap: Array.from({ length: 4096 }, () => ({ role: 'assistant', text: 'old', toolUses: [] })) });
  await b.start(); await b.prompt('Build a project.'); assert.match((await b.command('now')).text, /coverage/);
});
test('parallel sessions in same project have distinct pending transactions and archives', async () => {
  const a = host({ mode: 'protect', session: 'a' }), b = host({ mode: 'protect', session: 'b' });
  await a.start(); await b.start(); await a.prompt('Build A'); await b.prompt('Build B');
  await a.command('now'); await b.command('now');
  const ak = [...a.store.keys()].filter(k => k.includes(':pending:')), bk = [...b.store.keys()].filter(k => k.includes(':pending:'));
  assert.notEqual(ak[0], bk[0]); assert.notEqual([...a.files.keys()][0], [...b.files.keys()][0]);
});
test('non-text attachments prevent falsely complete handoff', async () => {
  const h = host({ mode: 'protect' }); await h.start();
  await h.fire('prompt.submit', { text: 'Build from this image', attachments: [{ type: 'image' }], origin: { kind: 'composer' } });
  assert.match((await h.command('now')).text, /coverage/);
  assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
});

// --- Local regression tests for the Claude Code 2.1.288 command.run guard and re-seeding ---
test('manual handoff never calls command.run from inside the command hook', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build requirements; cutoff July 1.'); await h.step();
  await h.command('now'); assert.equal(h.guardViolations, 0);
  assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
  await h.flush(); assert.equal(h.guardViolations, 0);
  assert.equal(h.calls.filter(c => c[0] === 'clear-request').length, 1);
});
test('fresh session is seeded with the brief even if the host skips the mod\'s own clear hook', async () => {
  const h = host({ mode: 'protect' }); h.skipClearHook = true; await h.start();
  await h.prompt('Build requirements; cutoff July 1. Contract_Loaded_Date__c must survive.'); await h.step();
  await h.command('now'); await h.flush(); await h.queuedClear(); await h.flush();
  const seed = h.calls.find(c => c[0] === 'seed'); assert.ok(seed, 'seed prompt submitted');
  assert.match(seed[1], /handoff-.*\.md/); assert.equal(seed[1].startsWith('/'), false);
  assert.equal([...h.store.keys()].some(k => k.includes(':pending:')), false, 'pending record consumed');
});
test('correction typed before the clear request is made cancels it', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build using July 1.'); await h.step();
  await h.command('now'); await h.prompt('Correction: July 3.'); await h.flush();
  assert.equal(h.calls.some(c => c[0] === 'clear-request'), false);
  assert.ok(h.notices.some(n => /Clear failed.*invalidated/.test(n)));
  assert.equal([...h.store.keys()].some(k => k.includes(':pending:')), false);
});
test('rejected clear keeps the session, reports the reason and the brief path, and unwinds state', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build using July 1.'); await h.step();
  h.rejectRun = 'no command named /clear in this session'; await h.command('now'); await h.flush();
  assert.ok(h.notices.some(n => /Clear failed \(.*no command named \/clear.*\).*handoff-.*\.md/.test(n)));
  assert.equal([...h.store.keys()].some(k => k.includes(':pending:')), false);
  assert.match((await h.command('status')).text, /"mode": "protect"/);
  h.rejectRun = null; assert.match((await h.command('now')).text, /handoff queued/);
});
test('a rejected seed is reported with the brief path instead of failing silently', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build using July 1.'); await h.step();
  await h.command('now'); await h.flush(); h.rejectSubmit = 'session busy'; await h.queuedClear(); await h.flush();
  assert.ok(h.notices.some(n => /Could not seed.*session busy.*handoff-.*\.md/.test(n)));
});
test('automatic reset from turn.complete requests the clear once, outside any command hook', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build requirements; cutoff July 1.'); await h.step();
  h.usage.context.tokens = 800000;
  await h.fire('turn.complete', { turnId: 't' }); await h.flush();
  assert.equal(h.calls.filter(c => c[0] === 'clear-request').length, 1); assert.equal(h.guardViolations, 0);
});

test('summarizer label outside the fixed list is normalized, not fatal; quotes stay strict', async () => {
  const h = host({ mode: 'protect' }); await h.start(); await h.prompt('Build requirements; cutoff July 1.'); await h.step();
  h.evidenceReplies = [[{ kind: 'requirement', quote: 'cutoff July 1' }, { kind: 'decision|correction|rule', quote: 'Build requirements' }, { quote: 'July' }]];
  const r = await h.command('checkpoint'); assert.match(r.text, /Verified checkpoint/);
  const brief = [...h.files].find(([p]) => /handoff-.*.md$/.test(p))[1];
  assert.match(brief, /- rule: cutoff July 1/); assert.match(brief, /- decision: Build requirements/); assert.match(brief, /- state: July/);
});
test('one retry after an unsupported quote; a second unsupported quote blocks the checkpoint', async () => {
  const bad = [{ kind: 'rule', quote: 'text that was never said' }];
  const ok = host({ mode: 'protect' }); await ok.start(); await ok.prompt('Build requirements; cutoff July 1.'); await ok.step();
  ok.evidenceReplies = [bad, []]; assert.match((await ok.command('checkpoint')).text, /Verified checkpoint/);
  const no = host({ mode: 'protect' }); await no.start(); await no.prompt('Build requirements; cutoff July 1.'); await no.step();
  no.evidenceReplies = [bad, bad]; assert.match((await no.command('checkpoint')).text, /No reset: Unsupported evidence quotation/);
  assert.equal(no.calls.some(c => c[0] === 'clear-request'), false);
});
