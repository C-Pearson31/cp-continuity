# Change log: fixes made during the first live install (2026-10-06)

Base: first pilot build 0.1.0. This release: 0.1.2.

1. `plugin.json`: added the missing `description` for `registryMaxAgeDays` (required by `claude plugin validate`).
2. `hooks/register.js`: helpers hoisted to top level (validator only allows `$` to be passed to top-level functions). Per-instance state lives in context object `c`.
3. **Clear is now requested from a timer** (`$.clock.after`) via `requestClear()`. Claude Code 2.1.288 rejects `$.command.run` when called from inside a `command.run` hook, which is where `/cp-handoff now` ran it ("run it from a later event"). `requestClear` re-checks freshness (new messages, mode change) and sets the resume token immediately before the request, and reports the host's rejection reason in the toast.
4. The post-clear seed (`$.prompt.submit`) is no longer awaited inside `classic.SessionStart` (it waits for idle) and a rejection is reported with the brief path.
5. Tests: the simulated host now models the guard and timers; 6 regression tests added (32 total).

Unverified on a live Desktop session until the install report says otherwise.

## 0.1.2 (same day, after the first 0.1.1 live re-test)
6. Live re-test of 0.1.1 stopped earlier with `No reset: Unknown evidence kind`: the summarizer returned an evidence label outside the fixed list and the strict label check rejected the whole checkpoint. Labels are now normalized (synonyms, the schema's pipe-joined placeholder, anything else -> `state`). The exact-quote check is unchanged and still fatal. One retry per chunk after a malformed/unsupported summary (counts toward `maxSummaryCalls`).
7. Tests: 35 total.
